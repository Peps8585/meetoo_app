-- Lista d'attesa con precedenza (richiesta di Mattia e Giorgia, 11/11/2026).
--
-- Prima: quando si liberava un posto l'avviso arrivava a tutta la lista e il
-- posto andava a chi confermava per prima. Ora conta l'ordine di iscrizione:
-- 1. il posto liberato resta tenuto per la prima in lista (nel palinsesto
--    risulta pieno, nessun'altra lo puo' prendere di passaggio);
-- 2. l'avviso arriva solo a lei, con "Lo prendo" e "Questa volta no";
-- 3. ha 30 minuti per rispondere, contati solo dalle 8 alle 21: se la mezz'ora
--    scade di sera riprende la mattina dopo;
-- 4. se dice no o il tempo scade, il posto passa subito alla seconda;
-- 5. due posti liberi = due offerte insieme, alla prima e alla seconda;
-- 6. si scala dal pacchetto solo con "Lo prendo"; le offerte si chiudono
--    12 ore prima della lezione, come le prenotazioni.

alter table public.bookings
  -- posto tenuto per lei (offerta in corso): conta nei posti occupati
  add column offered_at timestamptz,
  -- fino a quando puo' rispondere; si fissa quando parte l'avviso
  add column offer_expires_at timestamptz;

alter table public.bookings drop constraint if exists bookings_response_check;
alter table public.bookings add constraint bookings_response_check
  check (response in ('ci_sono','non_vengo','lascia','scaduta'));

create index idx_bookings_offerte on public.bookings (schedule_id) where offered_at is not null;

-- Scadenza dell'offerta: 30 minuti contati solo fra le 8 e le 21 (ora italiana),
-- mai oltre la chiusura delle prenotazioni (12 ore prima della lezione).
create or replace function public._scadenza_offerta(p_da timestamptz, p_starts timestamptz)
returns timestamptz
language plpgsql stable set search_path to 'public'
as $$
declare
  v_local timestamp := p_da at time zone 'Europe/Rome';
  v_resto interval := interval '30 minutes';
  v_fine_giorno timestamp;
  v_fine timestamp;
begin
  if v_local::time >= time '21:00' then
    v_local := v_local::date + 1 + time '08:00';
  elsif v_local::time < time '08:00' then
    v_local := v_local::date + time '08:00';
  end if;
  v_fine_giorno := v_local::date + time '21:00';
  if v_local + v_resto > v_fine_giorno then
    v_resto := v_resto - (v_fine_giorno - v_local);
    v_fine := v_local::date + 1 + time '08:00' + v_resto;
  else
    v_fine := v_local + v_resto;
  end if;
  return least(v_fine at time zone 'Europe/Rome', p_starts - interval '12 hours');
end;
$$;

-- Offre i posti liberi, uno per persona, in ordine di iscrizione alla lista.
create or replace function public._offer_next(p_schedule_id uuid)
returns int
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_s schedules; v_id uuid; v_n int := 0;
begin
  select * into v_s from schedules where id = p_schedule_id for update;
  if not found or coalesce(v_s.is_cancelled, false) or coalesce(v_s.bookings_locked, false) then return 0; end if;
  if v_s.starts_at - now() < interval '12 hours' then return 0; end if;

  while coalesce(v_s.current_bookings, 0) < v_s.max_spots loop
    select id into v_id
    from bookings
    where schedule_id = p_schedule_id and status = 'waitlist' and offered_at is null
    order by booked_at, id
    limit 1
    for update;
    exit when v_id is null;

    update bookings
      set offered_at = now(), offer_expires_at = null, waitlist_notified_at = null
    where id = v_id;
    update schedules set current_bookings = coalesce(current_bookings, 0) + 1
    where id = p_schedule_id
    returning * into v_s;
    v_n := v_n + 1;
    v_id := null;
  end loop;
  return v_n;
end;
$$;

-- Un posto si e' liberato: lo si offre alla prossima in lista.
create or replace function public._spot_freed(p_schedule_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update schedules set spot_freed_at = now()
  where id = p_schedule_id
    and starts_at - now() >= interval '12 hours'
    and exists (select 1 from bookings where schedule_id = p_schedule_id and status = 'waitlist');
  perform _offer_next(p_schedule_id);
end;
$$;

-- Un'offerta si chiude senza che lei prenda il posto (dice no, scade, esce
-- dalla lista, la riga sparisce): il posto tenuto si libera e passa avanti.
-- "Lo prendo" segnala con meetoo.lista_presa che il posto e' suo.
create or replace function public._lista_offerta_chiusa()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if coalesce(current_setting('meetoo.lista_presa', true), '') = '1' then
    return null;
  end if;
  if old.status = 'waitlist' and old.offered_at is not null
     and (tg_op = 'DELETE' or new.status <> 'waitlist' or new.offered_at is null) then
    update schedules
      set current_bookings = greatest(0, coalesce(current_bookings, 0) - 1)
    where id = old.schedule_id;
    perform _offer_next(old.schedule_id);
  end if;
  return null;
end;
$$;

create trigger trg_lista_offerta_chiusa
  after update or delete on public.bookings
  for each row execute function public._lista_offerta_chiusa();

drop function if exists public.posti_fissi_avvisi_lista();

-- Avvisi alla lista: solo a chi ha un posto tenuto, solo dalle 8 alle 21.
-- Quando parte l'avviso parte anche la mezz'ora per rispondere.
create or replace function public.posti_fissi_avvisi_lista()
returns table (booking_id uuid, client_id uuid, studio_id uuid, action_token text, starts_at timestamptz,
               class_name text, offer_expires_at timestamptz)
language sql security definer set search_path to 'public'
as $$
  update bookings b
    set waitlist_notified_at = now(),
        offer_expires_at = _scadenza_offerta(now(), s.starts_at)
  from schedules s join classes c on c.id = s.class_id
  where s.id = b.schedule_id
    and b.status = 'waitlist'
    and b.offered_at is not null
    and b.waitlist_notified_at is null
    and (now() at time zone 'Europe/Rome')::time >= time '08:00'
    and (now() at time zone 'Europe/Rome')::time < time '21:00'
    and s.starts_at - now() >= interval '12 hours'
    and not coalesce(s.is_cancelled, false)
  returning b.id, b.client_id, b.studio_id, b.action_token, s.starts_at, c.name, b.offer_expires_at
$$;

-- Offerte scadute: il posto passa alla prossima (lo fa il trigger).
-- Offerte rimaste senza avviso quando le prenotazioni chiudono: il posto si libera.
create or replace function public.lista_scadenze()
returns int
language plpgsql security definer set search_path to 'public'
as $$
declare r record; v_n int := 0;
begin
  for r in
    select b.id from bookings b join schedules s on s.id = b.schedule_id
    where b.status = 'waitlist' and b.offered_at is not null
      and ((b.offer_expires_at is not null and b.offer_expires_at <= now())
           or s.starts_at - now() < interval '12 hours')
    for update of b
  loop
    update bookings
      set status = 'cancelled', cancelled_at = now(), response = 'scaduta', responded_at = now()
    where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- La risposta all'offerta (dalla pagina del link, con la service role).
-- p_prende = true: prenota scalando dal pacchetto. false: passa alla prossima.
create or replace function public.lista_rispondi(p_booking_id uuid, p_prende boolean)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_b bookings; v_nuova uuid;
begin
  select * into v_b from bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_b.status <> 'waitlist' then raise exception 'not_waitlist'; end if;
  if v_b.offered_at is null then raise exception 'not_offered'; end if;
  if v_b.offer_expires_at is not null and v_b.offer_expires_at <= now() then raise exception 'offer_expired'; end if;

  perform 1 from schedules where id = v_b.schedule_id for update;

  if p_prende then
    begin
      perform set_config('meetoo.lista_presa', '1', true);
      -- il posto tenuto per lei torna libero un istante e lo prende lei
      update schedules set current_bookings = greatest(0, coalesce(current_bookings, 0) - 1)
      where id = v_b.schedule_id;
      update bookings set offered_at = null where id = p_booking_id;
      v_nuova := book_lesson_for(v_b.client_id, v_b.schedule_id);
      perform set_config('meetoo.lista_presa', '', true);
      return json_build_object('preso', true, 'booking_id', v_nuova);
    exception when others then
      perform set_config('meetoo.lista_presa', '', true);
      if sqlerrm <> 'no_credits' then raise; end if;
    end;
    -- pacchetto che non basta: il posto passa alla prossima
    update bookings
      set status = 'cancelled', cancelled_at = now(), response = 'lascia', responded_at = now()
    where id = p_booking_id;
    return json_build_object('preso', false, 'motivo', 'no_credits');
  end if;

  update bookings
    set status = 'cancelled', cancelled_at = now(), response = 'lascia', responded_at = now()
  where id = p_booking_id;
  return json_build_object('preso', false);
end;
$$;

-- Posizione in lista, per la pagina della cliente.
create or replace function public.lista_posizione(p_booking_id uuid)
returns int
language sql stable security definer set search_path to 'public'
as $$
  select count(*)::int + 1
  from bookings b, bookings me
  where me.id = p_booking_id
    and b.schedule_id = me.schedule_id and b.status = 'waitlist'
    and (b.booked_at, b.id) < (me.booked_at, me.id)
$$;

-- Le righe della lista che oggi aspettano l'avviso col vecchio sistema
-- passano al nuovo: si offrono i posti liberi in ordine.
do $$
declare r record;
begin
  for r in select distinct schedule_id from bookings b join schedules s on s.id = b.schedule_id
           where b.status = 'waitlist' and s.starts_at > now() loop
    perform _offer_next(r.schedule_id);
  end loop;
end;
$$;

revoke all on function public._scadenza_offerta(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public._offer_next(uuid) from public, anon, authenticated;
revoke all on function public._lista_offerta_chiusa() from public, anon, authenticated;
revoke all on function public.posti_fissi_avvisi_lista() from public, anon, authenticated;
revoke all on function public.lista_scadenze() from public, anon, authenticated;
revoke all on function public.lista_rispondi(uuid, boolean) from public, anon, authenticated;
revoke all on function public.lista_posizione(uuid) from public, anon, authenticated;
grant execute on function public.posti_fissi_avvisi_lista() to service_role;
grant execute on function public.lista_scadenze() to service_role;
grant execute on function public.lista_rispondi(uuid, boolean) to service_role;
grant execute on function public.lista_posizione(uuid) to service_role;
