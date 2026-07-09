-- ============================================================================
-- MEE TOO — Sessione 10 — Migrazione VERSIONATA (2/2)
-- Blocco vivo sotto-soglia: flag schedules + sweep rilevazione/scadenza
--                           + RPC transizione C (refund) e A (reschedule)
--
-- Naming Supabase: rinominare in <YYYYMMDDHHMMSS>_s10_subthreshold_live.sql
-- DIPENDE da: s10_subthreshold_foundation (subthreshold_decisions,
--             refund_booking_full) GIA' applicata.
--
-- TESTATO su PostgreSQL 16: detect 0/1/2+, sweep scadenza (C auto),
-- RPC C, RPC A felice, RPC A rollback atomico (target pieno).
--
-- NON incluso (passi successivi, di proposito):
--   - cron.schedule(): si attiva DOPO verifica manuale in produzione
--   - invio push (VAPID/pg_net): blocco separato
--   - mapping errori IT nuovi + card decisione nel frontend
-- ============================================================================


-- 1) Flag "già controllata a T-12h" su schedules -------------------------------
-- Garantisce controllo UNA volta sola (regola di Giorgia) + elimina la corsa col
-- cutoff 12h di book_lesson (dopo il flag il conteggio puo' solo CALARE).
alter table public.schedules
  add column if not exists subthreshold_checked boolean not null default false;

create index if not exists idx_sched_subthreshold_pending
  on public.schedules (starts_at)
  where subthreshold_checked = false and is_cancelled = false;

-- 2) SWEEP RILEVAZIONE (T-12h) -- cron ogni ~10 min --------------------------
create or replace function public.sweep_subthreshold_detect()
returns int language plpgsql security definer set search_path to 'public'
as $function$
declare
  r_sched record; v_count int; v_booking_id uuid; v_client_id uuid;
  v_processed int := 0;
begin
  for r_sched in
    select id, studio_id from schedules
    where subthreshold_checked = false and is_cancelled = false
      and starts_at > now() and starts_at <= now() + interval '12 hours'
    for update skip locked
  loop
    select count(*) into v_count
    from bookings where schedule_id = r_sched.id and status = 'confirmed';

    if v_count = 0 then
      insert into subthreshold_decisions
        (studio_id, schedule_id, booking_id, client_id, state,
         bookings_at_check, detected_at, resolved_at, auto_applied)
      values (r_sched.studio_id, r_sched.id, null, null, 'cancelled_empty',
              0, now(), now(), true)
      on conflict (schedule_id) do nothing;
      update schedules set is_cancelled = true where id = r_sched.id;

    elsif v_count = 1 then
      select id, client_id into v_booking_id, v_client_id
      from bookings where schedule_id = r_sched.id and status = 'confirmed';
      insert into subthreshold_decisions
        (studio_id, schedule_id, booking_id, client_id, state,
         bookings_at_check, detected_at, decision_deadline)
      values (r_sched.studio_id, r_sched.id, v_booking_id, v_client_id, 'pending',
              1, now(), now() + interval '1 hour')
      on conflict (schedule_id) do nothing;
    -- v_count >= 2: confermata, nessuna riga
    end if;

    update schedules set subthreshold_checked = true where id = r_sched.id;
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$function$;

-- 3) SWEEP SCADENZA -- cron ogni ~5 min --------------------------------------
-- pending oltre deadline senza risposta -> C automatica (rimborso pieno).
create or replace function public.sweep_subthreshold_deadline()
returns int language plpgsql security definer set search_path to 'public'
as $function$
declare r_dec record; v_processed int := 0;
begin
  for r_dec in
    select id, schedule_id, booking_id from subthreshold_decisions
    where state = 'pending' and decision_deadline is not null
      and decision_deadline <= now()
    for update skip locked
  loop
    perform refund_booking_full(r_dec.booking_id);  -- idempotente
    update schedules set is_cancelled = true where id = r_dec.schedule_id;
    update subthreshold_decisions
      set state = 'resolved_refunded', auto_applied = true, resolved_at = now()
    where id = r_dec.id;
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$function$;

-- 4) RPC IN-APP — Opzione C (rimborso scelto dalla cliente) -------------------
create or replace function public.resolve_subthreshold_refund(p_decision_id uuid)
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_client uuid := auth.uid();
  v_owner uuid; v_state text; v_schedule_id uuid; v_booking_id uuid;
begin
  if v_client is null then raise exception 'not_authenticated'; end if;
  select client_id, state, schedule_id, booking_id
    into v_owner, v_state, v_schedule_id, v_booking_id
  from subthreshold_decisions where id = p_decision_id for update;
  if not found then raise exception 'decision_not_found'; end if;
  if v_owner <> v_client then raise exception 'not_owner'; end if;
  if v_state <> 'pending' then raise exception 'decision_not_pending'; end if;

  perform refund_booking_full(v_booking_id);
  update schedules set is_cancelled = true where id = v_schedule_id;
  update subthreshold_decisions
    set state = 'resolved_refunded', auto_applied = false, resolved_at = now()
  where id = p_decision_id;
  return json_build_object('resolved', true, 'choice', 'refund');
end;
$function$;

-- 5) RPC IN-APP — Opzione A (sposta su altra lezione) ------------------------
-- Ordine: rimborsa/libera l'originale PRIMA, poi prenota il target.
-- La funzione e' atomica: se book_lesson solleva, l'INTERA tx fa rollback
-- (originale ripristinato, credito non perso). Il rimborso-prima evita anche
-- il falso 'no_credits' quando il saldo e' tirato.
create or replace function public.resolve_subthreshold_reschedule(
  p_decision_id uuid, p_target_schedule_id uuid)
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_client uuid := auth.uid();
  v_owner uuid; v_state text; v_orig_schedule_id uuid; v_orig_booking_id uuid;
  v_new_booking_id uuid;
begin
  if v_client is null then raise exception 'not_authenticated'; end if;
  select client_id, state, schedule_id, booking_id
    into v_owner, v_state, v_orig_schedule_id, v_orig_booking_id
  from subthreshold_decisions where id = p_decision_id for update;
  if not found then raise exception 'decision_not_found'; end if;
  if v_owner <> v_client then raise exception 'not_owner'; end if;
  if v_state <> 'pending' then raise exception 'decision_not_pending'; end if;
  if p_target_schedule_id = v_orig_schedule_id then raise exception 'same_schedule'; end if;

  perform refund_booking_full(v_orig_booking_id);
  update schedules set is_cancelled = true where id = v_orig_schedule_id;

  v_new_booking_id := book_lesson(p_target_schedule_id);  -- legge auth.uid()

  update subthreshold_decisions
    set state = 'resolved_rescheduled', resolved_at = now()
  where id = p_decision_id;
  return json_build_object('resolved', true, 'choice', 'reschedule',
                           'new_booking_id', v_new_booking_id);
end;
$function$;

-- 6) Permessi --------------------------------------------------------------
-- Sweep: solo cron/servizio, mai client.
revoke all on function public.sweep_subthreshold_detect()   from public, anon, authenticated;
revoke all on function public.sweep_subthreshold_deadline()  from public, anon, authenticated;
-- RPC in-app: chiamabili dalla cliente.
grant execute on function public.resolve_subthreshold_refund(uuid)              to authenticated;
grant execute on function public.resolve_subthreshold_reschedule(uuid, uuid)    to authenticated;
