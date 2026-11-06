-- ============================================================
-- Prova — azioni dello studio su una lezione (S33, 6/11/2026)
-- Non distruttiva: finisce con un errore voluto, la transazione si annulla.
--   supabase db query --linked -f supabase/tests/azioni_lezione.sql
-- Esito atteso: "ESITO 16/16 ok".
-- ============================================================

do $$
declare
  v_studio uuid; v_admin uuid; v_a uuid; v_b uuid; v_c uuid; v_ins uuid; v_altra_ins uuid; v_class uuid; v_pkg uuid;
  v_s uuid; v_vuota uuid; v_dup uuid; v_slot uuid; v_id uuid; v_res json; v_txt text; v_n int;
  v_out text := ''; v_ok int := 0; v_tot int := 0;
begin
  select id into v_studio from studios order by created_at limit 1;
  select id into v_admin from profiles where studio_id = v_studio and role = 'admin' limit 1;
  select id into v_a from profiles where studio_id = v_studio and role = 'client' order by created_at limit 1;
  select id into v_b from profiles where studio_id = v_studio and role = 'client' and id <> v_a order by created_at limit 1;
  select id into v_c from profiles where studio_id = v_studio and role = 'client' and id not in (v_a, v_b) order by created_at limit 1;
  select id into v_ins from profiles where studio_id = v_studio and role = 'instructor' order by created_at limit 1;
  select id into v_altra_ins from profiles where studio_id = v_studio and role = 'instructor' and id <> v_ins limit 1;
  select id into v_class from classes where studio_id = v_studio and is_active order by name limit 1;
  select id into v_pkg from packages where studio_id = v_studio limit 1;

  update client_packages set is_active = false where client_id in (v_a, v_b, v_c);
  insert into client_packages (studio_id, client_id, package_id, credits_total, amount_initial, amount_remaining, expires_at, late_cancel_used)
  values (v_studio, v_a, v_pkg, 10, 100, 100, now() + interval '90 days', true),
         (v_studio, v_b, v_pkg, 10, 100, 100, now() + interval '90 days', true),
         (v_studio, v_c, v_pkg, 10, 100, 100, now() + interval '90 days', true);

  -- lezione tra 6 ore (iscrizioni gia' chiuse per le clienti), 2 posti, insegnante v_ins
  insert into schedules (studio_id, class_id, instructor_id, starts_at, ends_at, max_spots, current_bookings)
  values (v_studio, v_class, v_ins, now() + interval '6 hours', now() + interval '7 hours', 2, 0) returning id into v_s;
  insert into schedules (studio_id, class_id, starts_at, ends_at, max_spots, current_bookings)
  values (v_studio, v_class, now() + interval '3 days', now() + interval '3 days 50 minutes', 4, 0) returning id into v_vuota;

  -- 1. lo studio aggiunge una cliente anche a iscrizioni chiuse, e si scala
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_id := studio_aggiungi_cliente(v_s, v_a);
  reset role;
  v_tot := v_tot + 1;
  if (select booked_by from bookings where id = v_id) = 'studio' and _client_balance(v_a) = 100 - _booking_price(v_s)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  1 lo studio aggiunge (anche a iscrizioni chiuse) e la lezione si scala';
  else v_out := v_out || E'\nNO  1'; end if;

  -- 2. una cliente non puo' usare le azioni dello studio
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  begin perform studio_aggiungi_cliente(v_s, v_b); v_txt := 'permesso'; exception when others then v_txt := sqlerrm; end;
  reset role;
  v_tot := v_tot + 1;
  if v_txt = 'not_admin' then v_ok := v_ok + 1; v_out := v_out || E'\nok  2 una cliente non aggiunge nessuno';
  else v_out := v_out || E'\nNO  2 ' || v_txt; end if;

  -- 3. lo studio toglie dentro le 24 ore: lezione restituita intera
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_res := studio_togli_prenotazione(v_id);
  reset role;
  v_tot := v_tot + 1;
  if (v_res->>'refunded')::boolean and _client_balance(v_a) = 100 and (select current_bookings from schedules where id = v_s) = 0
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  3 tolta dallo studio dentro le 24 ore: lezione restituita intera';
  else v_out := v_out || E'\nNO  3 ' || v_res::text; end if;

  -- 4. iscrizioni bloccate: la cliente non prenota, lo studio si'
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform studio_blocca_iscrizioni(v_vuota, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  begin perform book_lesson(v_vuota); v_txt := 'prenotata'; exception when others then v_txt := sqlerrm; end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_id := studio_aggiungi_cliente(v_vuota, v_b);
  reset role;
  v_tot := v_tot + 1;
  if v_txt = 'booking_locked' and v_id is not null
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  4 iscrizioni bloccate: la cliente no, lo studio si''';
  else v_out := v_out || E'\nNO  4 ' || v_txt; end if;

  -- 5. posti sotto le iscritte: non si puo'
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform studio_blocca_iscrizioni(v_vuota, false);
  begin
    perform studio_modifica_lezione(v_vuota, now() + interval '3 days', now() + interval '3 days 50 minutes', null, 0, null);
    v_txt := 'modificata';
  exception when others then v_txt := sqlerrm; end;
  reset role;
  v_tot := v_tot + 1;
  if v_txt = 'posti_sotto_iscritte' then v_ok := v_ok + 1; v_out := v_out || E'\nok  5 non si scende sotto le iscritte';
  else v_out := v_out || E'\nNO  5 ' || v_txt; end if;

  -- 6. modifica: piu' posti con qualcuna in lista -> la lista viene avvisata; cambio ora segnalato
  update schedules set max_spots = 1 where id = v_vuota;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
  perform join_waitlist(v_vuota);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_res := studio_modifica_lezione(v_vuota, now() + interval '3 days 1 hour', now() + interval '3 days 1 hour 50 minutes', v_ins, 2, ' livello base ');
  reset role;
  v_tot := v_tot + 1;
  if (v_res->>'ora_cambiata')::boolean and (select spot_freed_at is not null and max_spots = 2 and notes = 'livello base' and instructor_id = v_ins from schedules where id = v_vuota)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  6 modifica: ora, insegnante, posti, note; con piu'' posti la lista viene avvisata';
  else v_out := v_out || E'\nNO  6 ' || v_res::text; end if;

  -- 7. un'insegnante non modifica
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ins, 'role', 'authenticated')::text, true);
  begin perform studio_blocca_iscrizioni(v_vuota, true); v_txt := 'permesso'; exception when others then v_txt := sqlerrm; end;
  reset role;
  v_tot := v_tot + 1;
  if v_txt = 'not_admin' then v_ok := v_ok + 1; v_out := v_out || E'\nok  7 un''insegnante non modifica la lezione';
  else v_out := v_out || E'\nNO  7 ' || v_txt; end if;

  -- 8-9. presenze: studio e insegnante della lezione si', cliente e altra insegnante no
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ins, 'role', 'authenticated')::text, true);
  perform segna_presenza(v_id, 'presente');
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  begin perform segna_presenza(v_id, 'assente'); v_txt := 'permesso'; exception when others then v_txt := sqlerrm; end;
  if v_altra_ins is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_altra_ins, 'role', 'authenticated')::text, true);
    begin perform segna_presenza(v_id, 'assente'); v_txt := v_txt || '/permesso'; exception when others then v_txt := v_txt || '/' || sqlerrm; end;
  else v_txt := v_txt || '/not_allowed'; end if;
  reset role;
  v_tot := v_tot + 1;
  if (select presenza from bookings where id = v_id) = 'presente' and (select status from bookings where id = v_id) = 'confirmed'
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  8 l''insegnante della lezione segna presente (la prenotazione resta valida)';
  else v_out := v_out || E'\nNO  8'; end if;
  v_tot := v_tot + 1;
  if v_txt = 'not_allowed/not_allowed' then v_ok := v_ok + 1; v_out := v_out || E'\nok  9 cliente e altra insegnante non segnano presenze';
  else v_out := v_out || E'\nNO  9 ' || v_txt; end if;

  -- 10. duplica
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_dup := studio_duplica_lezione(v_vuota, now() + interval '10 days');
  reset role;
  v_tot := v_tot + 1;
  if (select class_id = v_class and max_spots = 2 and current_bookings = 0 and ends_at - starts_at = interval '50 minutes' from schedules where id = v_dup)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 10 duplica: stessa lezione su un altro giorno, senza iscritte';
  else v_out := v_out || E'\nNO 10'; end if;

  -- 11-12. annulla con iscritta, posto fisso tenuto e lista d'attesa
  insert into fixed_slots (studio_id, client_id, class_id, weekday, start_time)
  values (v_studio, v_a, v_class, 1, time '06:00') returning id into v_slot;
  insert into bookings (studio_id, client_id, schedule_id, status, fixed_slot_id) values (v_studio, v_a, v_vuota, 'held', v_slot);
  update schedules set current_bookings = current_bookings + 1 where id = v_vuota;
  v_tot := v_tot + 1;
  if (select booked_by from bookings where schedule_id = v_vuota and client_id = v_a and status = 'held') = 'fisso'
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 11 il posto fisso risulta messo dal posto fisso';
  else v_out := v_out || E'\nNO 11'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select count(*) into v_n from studio_annulla_lezione(v_vuota);
  reset role;
  v_tot := v_tot + 1;
  if v_n = 3 and _client_balance(v_b) = 100
     and not exists (select 1 from bookings where schedule_id = v_vuota and status <> 'cancelled')
     and (select is_cancelled and current_bookings = 0 from schedules where id = v_vuota)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 12 annullata: iscritta rimborsata intera, posto fisso e lista liberati';
  else v_out := v_out || E'\nNO 12 righe ' || v_n; end if;

  -- 13. le clienti non prenotano una lezione annullata
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
  begin perform book_lesson(v_vuota); v_txt := 'prenotata'; exception when others then v_txt := sqlerrm; end;
  reset role;
  v_tot := v_tot + 1;
  if v_txt = 'schedule_cancelled' then v_ok := v_ok + 1; v_out := v_out || E'\nok 13 lezione annullata non prenotabile';
  else v_out := v_out || E'\nNO 13 ' || v_txt; end if;

  -- 14-15. eliminare: no se ci sono stati pagamenti, si' se e' vuota
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin perform studio_elimina_lezione(v_vuota); v_txt := 'eliminata'; exception when others then v_txt := sqlerrm; end;
  perform studio_elimina_lezione(v_dup);
  reset role;
  v_tot := v_tot + 1;
  if v_txt = 'has_payments' then v_ok := v_ok + 1; v_out := v_out || E'\nok 14 una lezione con pagamenti non si cancella (si annulla)';
  else v_out := v_out || E'\nNO 14 ' || v_txt; end if;
  v_tot := v_tot + 1;
  if not exists (select 1 from schedules where id = v_dup) then v_ok := v_ok + 1; v_out := v_out || E'\nok 15 una lezione vuota si cancella';
  else v_out := v_out || E'\nNO 15'; end if;

  -- 16. prenotazione normale della cliente invariata
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
  begin perform book_lesson(v_s); v_txt := 'prenotata'; exception when others then v_txt := sqlerrm; end;
  reset role;
  v_tot := v_tot + 1;
  if v_txt = 'booking_closed' then v_ok := v_ok + 1; v_out := v_out || E'\nok 16 la cliente resta fuori dalle 12 ore come sempre';
  else v_out := v_out || E'\nNO 16 ' || v_txt; end if;

  raise exception 'ESITO %/% ok%', v_ok, v_tot, v_out;
end $$;
