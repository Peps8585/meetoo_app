-- Interruttore "Prenotazioni dall'app" per lo studio (Mattia 24/11/2026).
--
-- Fase di prova: le clienti si iscrivono, Giorgia le conferma con calma, ma si
-- prenota ancora da App Palestre, cosi' non ci sono due agende sugli stessi posti.
-- Con l'interruttore chiuso una cliente non puo' prenotare ne' entrare in lista
-- d'attesa da sola; lo studio puo' sempre prenotare per lei (prova con poche persone).
-- Di base resta aperto: non cambia niente finche' lo studio non lo chiude.

begin;

alter table public.studios add column if not exists prenotazioni_app boolean not null default true;

-- stesso cancello delle clienti non confermate: vale per ogni prenotazione che la
-- cliente fa per se' (prenota, lista d'attesa, posto offerto dalla lista)
create or replace function public.bookings_solo_confermate()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
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
  return new;
end;
$$;

create or replace function public.prenotazioni_app()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select st.prenotazioni_app from studios st
                   join profiles p on p.studio_id = st.id
                   where p.id = auth.uid()), true)
$$;

revoke all on function public.prenotazioni_app() from public, anon;
grant execute on function public.prenotazioni_app() to authenticated;

create or replace function public.imposta_prenotazioni_app(p_aperte boolean)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  update studios set prenotazioni_app = p_aperte
  where id = (select studio_id from profiles where id = auth.uid());
end;
$$;

revoke all on function public.imposta_prenotazioni_app(boolean) from public, anon;
grant execute on function public.imposta_prenotazioni_app(boolean) to authenticated;

commit;
