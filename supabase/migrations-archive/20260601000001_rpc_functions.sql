-- =============================================================================
-- RPC FUNCTIONS — Mee Too Pilates
-- Definizioni estratte dal DB con pg_get_functiondef il 2026-06-17.
-- Tutte le funzioni sono SECURITY DEFINER: girano con i permessi del
-- proprietario (postgres), non del chiamante. Il search_path è bloccato
-- su 'public' per prevenire search_path injection.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- get_user_role() → text
-- Restituisce il role dell'utente corrente dalla tabella profiles.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid();
$function$;

-- -----------------------------------------------------------------------------
-- get_user_studio_id() → uuid
-- Restituisce lo studio_id dell'utente corrente dalla tabella profiles.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_studio_id()
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
AS $function$
  SELECT studio_id FROM profiles WHERE id = auth.uid();
$function$;

-- -----------------------------------------------------------------------------
-- book_lesson(p_schedule_id uuid) → uuid
-- Prenota un posto in modo atomico:
--   1. Blocca la riga in schedules (FOR UPDATE) → serializza concorrenza
--   2. Controlla capienza, stato, orario futuro, duplicati
--   3. Sceglie il client_package valido con scadenza più vicina
--   4. Inserisce in bookings, scala credits_used, incrementa current_bookings
-- Restituisce l'UUID della booking creata.
-- Eccezioni: not_authenticated | schedule_not_found | schedule_cancelled |
--            schedule_past | full | already_booked | no_credits
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_lesson(p_schedule_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
declare
  v_client uuid := auth.uid();
  v_studio uuid; v_max int; v_current int;
  v_cancelled boolean; v_starts timestamptz;
  v_cp_id uuid; v_booking_id uuid;
begin
  if v_client is null then raise exception 'not_authenticated'; end if;

  -- blocca la riga lezione: serializza prenotazioni concorrenti
  select studio_id, max_spots, coalesce(current_bookings,0), is_cancelled, starts_at
    into v_studio, v_max, v_current, v_cancelled, v_starts
  from schedules where id = p_schedule_id for update;

  if not found then raise exception 'schedule_not_found'; end if;
  if v_cancelled then raise exception 'schedule_cancelled'; end if;
  if v_starts <= now() then raise exception 'schedule_past'; end if;
  if v_current >= v_max then raise exception 'full'; end if;

  if exists (select 1 from bookings
    where schedule_id = p_schedule_id and client_id = v_client
      and status = 'confirmed') then
    raise exception 'already_booked';
  end if;

  -- pacchetto valido: attivo, non scaduto, con crediti residui;
  -- scelgo quello che scade prima
  select id into v_cp_id
  from client_packages
  where client_id = v_client and is_active = true
    and (expires_at is null or expires_at > now())
    and coalesce(credits_used,0) < credits_total
  order by expires_at asc nulls last
  limit 1 for update;

  if v_cp_id is null then raise exception 'no_credits'; end if;

  insert into bookings (studio_id, client_id, schedule_id, client_package_id, status)
  values (v_studio, v_client, p_schedule_id, v_cp_id, 'confirmed')
  returning id into v_booking_id;

  update client_packages
    set credits_used = coalesce(credits_used,0) + 1 where id = v_cp_id;

  update schedules
    set current_bookings = coalesce(current_bookings,0) + 1
  where id = p_schedule_id;

  return v_booking_id;
end;
$function$;

-- -----------------------------------------------------------------------------
-- cancel_booking(p_booking_id uuid) → json
-- Cancella una prenotazione in modo atomico:
--   1. Blocca la riga in bookings e schedules (FOR UPDATE)
--   2. Verifica proprietà e stato 'confirmed'
--   3. Rimborsa il credito SOLO se mancano ≥ 24 ore all'inizio
--   4. Libera sempre il posto in current_bookings
-- Restituisce: {"cancelled": true, "refunded": true|false}
-- Eccezioni: not_authenticated | booking_not_found | not_owner | not_active
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
declare
  v_client uuid := auth.uid();
  v_owner uuid; v_status text; v_cp_id uuid;
  v_schedule_id uuid; v_starts timestamptz;
  v_refunded boolean := false;
begin
  if v_client is null then raise exception 'not_authenticated'; end if;

  select client_id, status, client_package_id, schedule_id
    into v_owner, v_status, v_cp_id, v_schedule_id
  from bookings where id = p_booking_id for update;

  if not found then raise exception 'booking_not_found'; end if;
  if v_owner <> v_client then raise exception 'not_owner'; end if;
  if v_status <> 'confirmed' then raise exception 'not_active'; end if;

  select starts_at into v_starts
  from schedules where id = v_schedule_id for update;

  -- rimborso solo con almeno 24h di anticipo
  if v_starts - now() >= interval '24 hours' then
    v_refunded := true;
  end if;

  update bookings
    set status = 'cancelled', cancelled_at = now() where id = p_booking_id;

  if v_refunded and v_cp_id is not null then
    update client_packages
      set credits_used = greatest(0, coalesce(credits_used,0) - 1)
    where id = v_cp_id;
  end if;

  -- il posto si libera sempre, anche se il credito è bruciato
  update schedules
    set current_bookings = greatest(0, coalesce(current_bookings,0) - 1)
  where id = v_schedule_id;

  return json_build_object('cancelled', true, 'refunded', v_refunded);
end;
$function$;
