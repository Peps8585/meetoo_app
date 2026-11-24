-- Interruttore "prenotazioni con crediti" per lo studio (piano di lancio del 24/11/2026).
--
-- Febbraio: le clienti prenotano dall'app come oggi in App Palestre, senza crediti
-- (le lezioni si segnano ancora sui cartellini). Marzo: si accendono i crediti.
--
-- Tutti i punti che scalano (prenotare, lista d'attesa, posto fisso confermato,
-- promozione dalla lista) chiedono il prezzo a _booking_price: con i crediti
-- spenti vale 0, quindi non serve saldo e non si scala niente. La disdetta
-- rimborsa solo cio' che e' stato davvero scalato, quindi resta giusta anche a
-- cavallo del cambio. Di base i crediti restano accesi: non cambia niente finche'
-- lo studio non spegne l'interruttore.

begin;

alter table public.studios add column if not exists crediti_attivi boolean not null default true;

create or replace function public._booking_price(p_schedule_id uuid)
returns numeric
language sql stable security definer set search_path to 'public'
as $$
  select case when st.crediti_attivi then coalesce(s.price_override, c.price) else 0 end
  from schedules s
  join classes c on c.id = s.class_id
  join studios st on st.id = s.studio_id
  where s.id = p_schedule_id
$$;

revoke all on function public._booking_price(uuid) from public, anon, authenticated;

-- lo stato dell'interruttore per lo studio di chi e' collegato (cliente o studio)
create or replace function public.crediti_attivi()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select st.crediti_attivi from studios st
                   join profiles p on p.studio_id = st.id
                   where p.id = auth.uid()), true)
$$;

revoke all on function public.crediti_attivi() from public, anon;
grant execute on function public.crediti_attivi() to authenticated;

-- solo l'admin dello studio lo cambia
create or replace function public.imposta_crediti(p_attivi boolean)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  update studios set crediti_attivi = p_attivi
  where id = (select studio_id from profiles where id = auth.uid());
end;
$$;

revoke all on function public.imposta_crediti(boolean) from public, anon;
grant execute on function public.imposta_crediti(boolean) to authenticated;

commit;
