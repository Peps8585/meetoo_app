-- Prenotazioni di prova (Mattia 24/11/2026, sì alle 15.01).
--
-- Terzo stato dell'interruttore "Prenotazioni dall'app": chiuse / di prova / aperte.
-- Di prova: le clienti provano a prenotare e disdire, ma le prenotazioni non valgono
-- (si prenota ancora da App Palestre). Senza crediti, niente lista d'attesa (manderebbe
-- avvisi), ogni prenotazione nata in prova e' segnata di_prova. Il giorno del lancio
-- lo studio le annulla tutte insieme con annulla_prenotazioni_prova(), senza avvisi.
-- Di base la prova e' spenta: non cambia niente finche' lo studio non la sceglie.

begin;

alter table public.studios add column if not exists prenotazioni_prova boolean not null default false;
alter table public.bookings add column if not exists di_prova boolean not null default false;

-- in prova non si scala niente: come con i crediti spenti
create or replace function public._booking_price(p_schedule_id uuid)
returns numeric
language sql stable security definer set search_path to 'public'
as $$
  select case when st.crediti_attivi and not st.prenotazioni_prova
              then coalesce(s.price_override, c.price) else 0 end
  from schedules s
  join classes c on c.id = s.class_id
  join studios st on st.id = s.studio_id
  where s.id = p_schedule_id
$$;

revoke all on function public._booking_price(uuid) from public, anon, authenticated;

create or replace function public.crediti_attivi()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select st.crediti_attivi and not st.prenotazioni_prova from studios st
                   join profiles p on p.studio_id = st.id
                   where p.id = auth.uid()), true)
$$;

create or replace function public.prenotazioni_prova()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select st.prenotazioni_prova from studios st
                   join profiles p on p.studio_id = st.id
                   where p.id = auth.uid()), false)
$$;

revoke all on function public.prenotazioni_prova() from public, anon;
grant execute on function public.prenotazioni_prova() to authenticated;

-- il cancello sulle prenotazioni: non confermate, app chiusa, e ora anche la prova
create or replace function public.bookings_solo_confermate()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_prova boolean;
begin
  if auth.uid() is not null and new.client_id = auth.uid()
     and exists (select 1 from profiles
                 where id = new.client_id and role = 'client' and approvata_at is null)
  then
    raise exception 'not_approved';
  end if;
  if auth.uid() is not null and new.client_id = auth.uid()
     and exists (select 1 from profiles p join studios st on st.id = p.studio_id
                 where p.id = new.client_id and p.role = 'client' and not st.prenotazioni_app)
  then
    raise exception 'app_in_prova';
  end if;

  select prenotazioni_prova into v_prova from studios where id = new.studio_id;
  if coalesce(v_prova, false) then
    if new.status = 'waitlist' then raise exception 'lista_in_prova'; end if;
    new.di_prova := true;
  end if;
  return new;
end;
$$;

-- lo stato per la pagina dello studio: 'chiuse', 'prova' o 'aperte'
create or replace function public.modo_prenotazioni()
returns text
language sql stable security definer set search_path to 'public'
as $$
  select case when not st.prenotazioni_app then 'chiuse'
              when st.prenotazioni_prova then 'prova' else 'aperte' end
  from studios st join profiles p on p.studio_id = st.id
  where p.id = auth.uid()
$$;

revoke all on function public.modo_prenotazioni() from public, anon;
grant execute on function public.modo_prenotazioni() to authenticated;

create or replace function public.imposta_modo_prenotazioni(p_modo text)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  if p_modo not in ('chiuse', 'prova', 'aperte') then raise exception 'modo_sconosciuto'; end if;
  update studios
    set prenotazioni_app = (p_modo <> 'chiuse'),
        prenotazioni_prova = (p_modo = 'prova')
  where id = (select studio_id from profiles where id = auth.uid());
end;
$$;

revoke all on function public.imposta_modo_prenotazioni(text) from public, anon;
grant execute on function public.imposta_modo_prenotazioni(text) to authenticated;

-- il giorno del lancio: via tutte le prenotazioni di prova ancora attive, senza avvisi
create or replace function public.annulla_prenotazioni_prova()
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_studio uuid; v_n integer := 0; r record;
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  select studio_id into v_studio from profiles where id = auth.uid();
  for r in
    select b.id, b.schedule_id, b.status from bookings b
    where b.studio_id = v_studio and b.di_prova and b.status in ('confirmed', 'held', 'waitlist')
    for update
  loop
    update bookings set status = 'cancelled', cancelled_at = now() where id = r.id;
    if r.status in ('confirmed', 'held') then
      update schedules set current_bookings = greatest(0, coalesce(current_bookings, 0) - 1)
      where id = r.schedule_id;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.annulla_prenotazioni_prova() from public, anon;
grant execute on function public.annulla_prenotazioni_prova() to authenticated;

commit;
