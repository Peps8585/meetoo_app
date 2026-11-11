-- ============================================================
-- Prova — posti fissi, lista d'attesa, promemoria (S33, 6/11/2026)
-- Non distruttiva: tutto in un blocco DO che finisce con un errore voluto,
-- cosi' la transazione si annulla e il risultato esce nel messaggio.
--
-- COME ESEGUIRE (database di prova, repo collegato a MeeToo_Dev):
--   supabase db query --linked -f supabase/tests/posti_fissi.sql
-- Esito atteso: "ESITO 30/30 ok" seguito dal dettaglio.
--
-- PREREQUISITI: lo studio ha almeno un admin e tre clienti; usa la prima
-- disciplina attiva. I crediti delle clienti si impostano qui dentro.
-- ============================================================

do $$
declare
  v_studio uuid; v_admin uuid; v_fissa uuid; v_jolly uuid; v_altra uuid; v_class uuid;
  v_a uuid; v_a2 uuid; v_a3 uuid; v_d uuid; v_e uuid; v_f uuid; v_g uuid;
  v_slot_a uuid; v_slot_d uuid; v_slot_f uuid;
  v_t timestamptz; v_res json; v_id uuid; v_txt text;
  v_out text := ''; v_ok int := 0; v_tot int := 0;
  v_pkg uuid;

begin
  select id into v_studio from studios order by created_at limit 1;
  select id into v_admin from profiles where studio_id = v_studio and role = 'admin' limit 1;
  select id into v_fissa from profiles where studio_id = v_studio and role = 'client' order by created_at limit 1;
  select id into v_jolly from profiles where studio_id = v_studio and role = 'client' and id <> v_fissa order by created_at limit 1;
  select id into v_altra from profiles where studio_id = v_studio and role = 'client' and id not in (v_fissa, v_jolly) order by created_at limit 1;
  select id into v_class from classes where studio_id = v_studio and is_active order by name limit 1;
  select id into v_pkg from packages where studio_id = v_studio limit 1;

  -- crediti di prova: fissa 160, jolly 50, altra 160
  update client_packages set is_active = false where client_id in (v_fissa, v_jolly, v_altra);
  insert into client_packages (studio_id, client_id, package_id, credits_total, amount_initial, amount_remaining, expires_at)
  values (v_studio, v_fissa, v_pkg, 10, 160, 160, now() + interval '90 days'),
         (v_studio, v_jolly, v_pkg, 3, 50, 50, now() + interval '90 days'),
         (v_studio, v_altra, v_pkg, 10, 160, 160, now() + interval '90 days');

  -- lezioni di prova (2 posti): A tra 10 giorni e A2 la settimana dopo, D tra 5 giorni,
  -- E tra 20 ore, F tra 4 giorni. Ore piene in ora italiana.
  v_t := date_trunc('hour', (now() + interval '10 days') at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  insert into schedules (studio_id, class_id, starts_at, ends_at, max_spots, current_bookings)
  values (v_studio, v_class, v_t, v_t + interval '50 minutes', 2, 0) returning id into v_a;
  insert into schedules (studio_id, class_id, starts_at, ends_at, max_spots, current_bookings)
  values (v_studio, v_class, v_t + interval '7 days', v_t + interval '7 days 50 minutes', 2, 0) returning id into v_a2;
  -- A3: 14 settimane dopo A, oltre la scadenza del pacchetto (90 giorni)
  insert into schedules (studio_id, class_id, starts_at, ends_at, max_spots, current_bookings)
  values (v_studio, v_class, v_t + interval '98 days', v_t + interval '98 days 50 minutes', 2, 0) returning id into v_a3;
  v_t := date_trunc('hour', (now() + interval '5 days') at time zone 'Europe/Rome') at time zone 'Europe/Rome' + interval '30 minutes';
  insert into schedules (studio_id, class_id, starts_at, ends_at, max_spots, current_bookings)
  values (v_studio, v_class, v_t, v_t + interval '50 minutes', 2, 0) returning id into v_d;
  insert into schedules (studio_id, class_id, starts_at, ends_at, max_spots, current_bookings)
  values (v_studio, v_class, now() + interval '20 hours', now() + interval '21 hours', 1, 0) returning id into v_e;
  v_t := date_trunc('hour', (now() + interval '4 days') at time zone 'Europe/Rome') at time zone 'Europe/Rome' + interval '15 minutes';
  insert into schedules (studio_id, class_id, starts_at, ends_at, max_spots, current_bookings)
  values (v_studio, v_class, v_t, v_t + interval '50 minutes', 2, 0) returning id into v_f;

  -- ---- 1. lo studio segna il posto fisso: tenuto su A e A2, niente scalato
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_res := fixed_slot_add(v_fissa, v_class,
    extract(isodow from (select starts_at from schedules where id = v_a) at time zone 'Europe/Rome')::int,
    ((select starts_at from schedules where id = v_a) at time zone 'Europe/Rome')::time);
  reset role;
  v_slot_a := (v_res->>'id')::uuid;

  v_tot := v_tot + 1;
  if (select count(*) from bookings where fixed_slot_id = v_slot_a and status = 'held'
      and schedule_id in (v_a, v_a2)) = 2 then v_ok := v_ok + 1; v_out := v_out || E'\nok  1 posto tenuto su A e A2';
  else v_out := v_out || E'\nNO  1 posto tenuto su A e A2: ' || v_res::text; end if;

  v_tot := v_tot + 1;
  if not exists (select 1 from bookings where schedule_id = v_a3) and (v_res->>'until') is not null
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  1b dopo la scadenza del pacchetto il posto non si tiene';
  else v_out := v_out || E'\nNO  1b scadenza pacchetto: ' || v_res::text; end if;

  v_tot := v_tot + 1;
  if _client_balance(v_fissa) = 160 then v_ok := v_ok + 1; v_out := v_out || E'\nok  2 posto tenuto non scala niente';
  else v_out := v_out || E'\nNO  2 saldo fissa ' || _client_balance(v_fissa); end if;

  v_tot := v_tot + 1;
  if (select current_bookings from schedules where id = v_a) = 1 then v_ok := v_ok + 1; v_out := v_out || E'\nok  3 il posto tenuto conta come occupato';
  else v_out := v_out || E'\nNO  3 posti occupati A ' || (select current_bookings from schedules where id = v_a); end if;

  -- ---- 2. una jolly prenota l'altro posto: A e' piena
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_altra, 'role', 'authenticated')::text, true);
  perform book_lesson(v_a);
  reset role;

  v_tot := v_tot + 1;
  if (select current_bookings from schedules where id = v_a) = 2 and _client_balance(v_altra) = 160 - _booking_price(v_a)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  4 prenotazione normale invariata (scala il prezzo)';
  else v_out := v_out || E'\nNO  4 prenotazione normale'; end if;

  -- ---- 3. la lezione piena non si prenota, ci si mette in lista
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_jolly, 'role', 'authenticated')::text, true);
  begin
    perform book_lesson(v_a);
    v_txt := 'prenotata';
  exception when others then v_txt := sqlerrm; end;
  v_id := join_waitlist(v_a);
  reset role;

  v_tot := v_tot + 1;
  if v_txt = 'full' and (select status from bookings where id = v_id) = 'waitlist' and _client_balance(v_jolly) = 50
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  5 lezione piena: niente prenotazione, si entra in lista senza pagare';
  else v_out := v_out || E'\nNO  5 lista: ' || v_txt; end if;

  -- ---- 4. la fissa dice "questa volta no" su A: la jolly in lista viene avvisata
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_fissa, 'role', 'authenticated')::text, true);
  v_res := cancel_booking((select id from bookings where schedule_id = v_a and client_id = v_fissa and status = 'held'));
  reset role;

  v_tot := v_tot + 1;
  if _client_balance(v_fissa) = 160 and (v_res->>'refunded')::boolean = false
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  6 la fissa libera il posto tenuto senza pagare';
  else v_out := v_out || E'\nNO  6 ' || v_res::text; end if;

  v_tot := v_tot + 1;
  if exists (select 1 from bookings where schedule_id = v_a and client_id = v_jolly and status = 'waitlist' and offered_at is not null)
     and _client_balance(v_jolly) = 50
     and (select current_bookings from schedules where id = v_a) = 2
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  7 nessuna entra da sola: il posto e'' tenuto per la prima in lista, niente scalato';
  else v_out := v_out || E'\nNO  7 avviso alla lista'; end if;

  -- la jolly conferma con "Lo prendo": prenota come sempre ed esce dalla lista
  perform lista_rispondi((select id from bookings where schedule_id = v_a and client_id = v_jolly and status = 'waitlist'), true);

  -- ---- 5. il giro: "questa volta no" non si ricrea, A2 resta tenuta
  v_res := posti_fissi_giro();
  v_tot := v_tot + 1;
  if not exists (select 1 from bookings where schedule_id = v_a and client_id = v_fissa and status in ('held','confirmed'))
     and exists (select 1 from bookings where schedule_id = v_a2 and client_id = v_fissa and status = 'held')
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  8 il giro non ricrea il posto rifiutato';
  else v_out := v_out || E'\nNO  8 giro ' || v_res::text; end if;

  -- ---- 6. posto fisso su una lezione entro la settimana: si scala subito
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_res := fixed_slot_add(v_fissa, v_class,
    extract(isodow from (select starts_at from schedules where id = v_d) at time zone 'Europe/Rome')::int,
    ((select starts_at from schedules where id = v_d) at time zone 'Europe/Rome')::time);
  reset role;
  v_slot_d := (v_res->>'id')::uuid;

  v_tot := v_tot + 1;
  if exists (select 1 from bookings where schedule_id = v_d and client_id = v_fissa and status = 'confirmed' and fixed_slot_id = v_slot_d)
     and _client_balance(v_fissa) = 160 - _booking_price(v_d)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok  9 entro la settimana il posto fisso diventa prenotazione e scala';
  else v_out := v_out || E'\nNO  9 ' || v_res::text; end if;

  -- ---- 7. "questa volta no" prima delle 24 ore: rimborso pieno
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_fissa, 'role', 'authenticated')::text, true);
  v_res := cancel_booking((select id from bookings where schedule_id = v_d and client_id = v_fissa and status = 'confirmed'));
  reset role;

  v_tot := v_tot + 1;
  if (v_res->>'refunded')::boolean and _client_balance(v_fissa) = 160
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 10 cancellazione prima delle 24 ore: rimborsata';
  else v_out := v_out || E'\nNO 10 ' || v_res::text; end if;

  -- ---- 8. dentro le 24 ore: nessuna entra da sola, la lista viene avvisata
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_altra, 'role', 'authenticated')::text, true);
  v_id := book_lesson(v_e);
  perform set_config('request.jwt.claims', json_build_object('sub', v_jolly, 'role', 'authenticated')::text, true);
  perform join_waitlist(v_e);
  perform set_config('request.jwt.claims', json_build_object('sub', v_altra, 'role', 'authenticated')::text, true);
  v_res := cancel_booking(v_id);
  reset role;

  v_tot := v_tot + 1;
  if (v_res->>'used_bonus')::boolean and _client_balance(v_altra) = 160 - _booking_price(v_a)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 11 cancellazione tardiva: usa la cancellazione gratis del pacchetto';
  else v_out := v_out || E'\nNO 11 ' || v_res::text; end if;

  v_tot := v_tot + 1;
  if exists (select 1 from bookings where schedule_id = v_e and client_id = v_jolly and status = 'waitlist' and offered_at is not null)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 12 anche dentro le 24 ore la lista viene avvisata';
  else v_out := v_out || E'\nNO 12 lista dopo la scadenza'; end if;

  -- ---- 9. la jolly avvisata prende il posto: esce dalla lista
  perform lista_rispondi((select id from bookings where schedule_id = v_e and client_id = v_jolly and status = 'waitlist'), true);

  v_tot := v_tot + 1;
  if exists (select 1 from bookings where schedule_id = v_e and client_id = v_jolly and status = 'confirmed')
     and not exists (select 1 from bookings where schedule_id = v_e and client_id = v_jolly and status = 'waitlist')
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 13 chi prende il posto esce dalla lista';
  else v_out := v_out || E'\nNO 13'; end if;

  -- ---- 10. pacchetto finito: il posto resta tenuto con il problema segnato
  update client_packages set amount_remaining = 0 where client_id = v_jolly and is_active;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_res := fixed_slot_add(v_jolly, v_class,
    extract(isodow from (select starts_at from schedules where id = v_f) at time zone 'Europe/Rome')::int,
    ((select starts_at from schedules where id = v_f) at time zone 'Europe/Rome')::time);
  reset role;
  v_slot_f := (v_res->>'id')::uuid;

  v_tot := v_tot + 1;
  if exists (select 1 from bookings where schedule_id = v_f and client_id = v_jolly and status = 'held' and hold_issue = 'no_credits')
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 14 pacchetto finito: posto tenuto, problema segnato';
  else v_out := v_out || E'\nNO 14 ' || v_res::text; end if;

  -- ricarica: al giro dopo diventa prenotazione
  update client_packages set amount_remaining = 50 where client_id = v_jolly and is_active;
  perform posti_fissi_giro();
  v_tot := v_tot + 1;
  if exists (select 1 from bookings where schedule_id = v_f and client_id = v_jolly and status = 'confirmed' and hold_issue is null)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 15 dopo la ricarica il giro conferma il posto';
  else v_out := v_out || E'\nNO 15'; end if;

  -- ---- 11. togliere il posto fisso libera i posti tenuti
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_res := fixed_slot_remove(v_slot_a);
  reset role;

  v_tot := v_tot + 1;
  if (v_res->>'freed')::int = 1 and (select current_bookings from schedules where id = v_a2) = 0
     and (select not is_active from fixed_slots where id = v_slot_a)
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 16 tolto il posto fisso, i posti tenuti si liberano';
  else v_out := v_out || E'\nNO 16 ' || v_res::text; end if;

  -- ---- 12. le clienti non possono chiamare le funzioni del server
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_jolly, 'role', 'authenticated')::text, true);
  begin
    perform book_lesson_for(v_altra, v_a2);
    v_txt := 'permesso';
  exception when insufficient_privilege then v_txt := 'negato'; end;
  begin
    perform fixed_slot_add(v_jolly, v_class, 1, time '08:00');
    v_txt := v_txt || '/permesso';
  exception when others then v_txt := v_txt || '/' || sqlerrm; end;
  reset role;

  v_tot := v_tot + 1;
  if v_txt = 'negato/not_admin' then v_ok := v_ok + 1; v_out := v_out || E'\nok 17 una cliente non prenota per altre e non crea posti fissi';
  else v_out := v_out || E'\nNO 17 ' || v_txt; end if;

  -- ---- 13. ora del promemoria: 12 ore prima della scadenza, mai di notte
  v_tot := v_tot + 1;
  if reminder_due_at(timestamptz '2026-11-12 08:00 Europe/Rome') = timestamptz '2026-11-10 20:00 Europe/Rome'
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 18 lezione gio 8.00 -> promemoria mar 20.00';
  else v_out := v_out || E'\nNO 18 ' || reminder_due_at(timestamptz '2026-11-12 08:00 Europe/Rome'); end if;

  v_tot := v_tot + 1;
  if reminder_due_at(timestamptz '2026-11-12 19:00 Europe/Rome') = timestamptz '2026-11-10 20:00 Europe/Rome'
     and reminder_due_at(timestamptz '2026-11-12 20:00 Europe/Rome') = timestamptz '2026-11-11 08:00 Europe/Rome'
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 19 gio 19.00 -> mar 20.00 (non di notte); gio 20.00 -> mer 8.00';
  else v_out := v_out || E'\nNO 19'; end if;

  v_tot := v_tot + 1;
  if reminder_due_at(timestamptz '2026-11-16 13:00 Europe/Rome') = timestamptz '2026-11-14 20:00 Europe/Rome'
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 20 lun 13.00 -> sab 20.00';
  else v_out := v_out || E'\nNO 20 ' || reminder_due_at(timestamptz '2026-11-16 13:00 Europe/Rome'); end if;

  -- ---- 14. lista con precedenza (11/11/2026)
  update client_packages set amount_remaining = 160 where client_id in (v_fissa, v_jolly, v_altra) and is_active;
  v_t := date_trunc('hour', (now() + interval '6 days') at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  insert into schedules (studio_id, class_id, starts_at, ends_at, max_spots, current_bookings)
  values (v_studio, v_class, v_t, v_t + interval '50 minutes', 1, 0) returning id into v_g;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_altra, 'role', 'authenticated')::text, true);
  v_id := book_lesson(v_g);
  perform set_config('request.jwt.claims', json_build_object('sub', v_jolly, 'role', 'authenticated')::text, true);
  perform join_waitlist(v_g);
  perform set_config('request.jwt.claims', json_build_object('sub', v_fissa, 'role', 'authenticated')::text, true);
  perform join_waitlist(v_g);
  perform set_config('request.jwt.claims', json_build_object('sub', v_altra, 'role', 'authenticated')::text, true);
  perform cancel_booking(v_id);
  perform set_config('request.jwt.claims', json_build_object('sub', v_fissa, 'role', 'authenticated')::text, true);
  begin
    perform book_lesson(v_g);
    v_txt := 'prenotata';
  exception when others then v_txt := sqlerrm; end;
  reset role;

  v_tot := v_tot + 1;
  if exists (select 1 from bookings where schedule_id = v_g and client_id = v_jolly and status = 'waitlist' and offered_at is not null)
     and exists (select 1 from bookings where schedule_id = v_g and client_id = v_fissa and status = 'waitlist' and offered_at is null)
     and (select current_bookings from schedules where id = v_g) = 1
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 21 posto liberato: tenuto solo per la prima in lista';
  else v_out := v_out || E'\nNO 21 precedenza'; end if;

  v_tot := v_tot + 1;
  if v_txt = 'full' then v_ok := v_ok + 1; v_out := v_out || E'\nok 22 mentre la prima decide, nessun''altra lo prenota di passaggio';
  else v_out := v_out || E'\nNO 22 ' || v_txt; end if;

  v_tot := v_tot + 1;
  if lista_posizione((select id from bookings where schedule_id = v_g and client_id = v_fissa and status = 'waitlist')) = 2
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 22b la seconda si vede seconda anche mentre la prima decide';
  else v_out := v_out || E'\nNO 22b posizione'; end if;

  v_tot := v_tot + 1;
  if _scadenza_offerta(timestamptz '2026-11-12 10:00 Europe/Rome', timestamptz '2026-11-20 10:00 Europe/Rome') = timestamptz '2026-11-12 10:30 Europe/Rome'
     and _scadenza_offerta(timestamptz '2026-11-12 20:45 Europe/Rome', timestamptz '2026-11-20 10:00 Europe/Rome') = timestamptz '2026-11-13 08:15 Europe/Rome'
     and _scadenza_offerta(timestamptz '2026-11-12 23:10 Europe/Rome', timestamptz '2026-11-20 10:00 Europe/Rome') = timestamptz '2026-11-13 08:30 Europe/Rome'
     and _scadenza_offerta(timestamptz '2026-11-12 10:00 Europe/Rome', timestamptz '2026-11-12 22:15 Europe/Rome') = timestamptz '2026-11-12 10:15 Europe/Rome'
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 23 mezz''ora per rispondere, ferma dalle 21 alle 8, mai oltre la chiusura';
  else v_out := v_out || E'\nNO 23 scadenze'; end if;

  -- la prima dice "questa volta no": il posto passa subito alla seconda
  v_res := lista_rispondi((select id from bookings where schedule_id = v_g and client_id = v_jolly and status = 'waitlist'), false);
  v_tot := v_tot + 1;
  if exists (select 1 from bookings where schedule_id = v_g and client_id = v_jolly and status = 'cancelled' and response = 'lascia')
     and exists (select 1 from bookings where schedule_id = v_g and client_id = v_fissa and status = 'waitlist' and offered_at is not null)
     and (select current_bookings from schedules where id = v_g) = 1
     and _client_balance(v_jolly) = 160
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 24 "questa volta no": il posto passa subito alla seconda';
  else v_out := v_out || E'\nNO 24 ' || v_res::text; end if;

  -- la seconda non risponde in tempo: il posto si libera (nessun'altra in lista)
  update bookings set offer_expires_at = now() - interval '1 minute'
  where schedule_id = v_g and client_id = v_fissa and status = 'waitlist';
  perform lista_scadenze();
  v_tot := v_tot + 1;
  if exists (select 1 from bookings where schedule_id = v_g and client_id = v_fissa and status = 'cancelled' and response = 'scaduta')
     and (select current_bookings from schedules where id = v_g) = 0
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 25 tempo scaduto: il posto passa avanti, qui torna libero';
  else v_out := v_out || E'\nNO 25 scadenza'; end if;

  -- due posti liberi insieme: offerti alla prima e alla seconda
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_altra, 'role', 'authenticated')::text, true);
  perform book_lesson(v_g);
  perform set_config('request.jwt.claims', json_build_object('sub', v_jolly, 'role', 'authenticated')::text, true);
  perform join_waitlist(v_g);
  perform set_config('request.jwt.claims', json_build_object('sub', v_fissa, 'role', 'authenticated')::text, true);
  perform join_waitlist(v_g);
  reset role;
  update schedules set max_spots = 3 where id = v_g;
  perform _spot_freed(v_g);
  v_tot := v_tot + 1;
  if (select count(*) from bookings where schedule_id = v_g and status = 'waitlist' and offered_at is not null) = 2
     and (select current_bookings from schedules where id = v_g) = 3
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 26 due posti liberi: offerti alla prima e alla seconda insieme';
  else v_out := v_out || E'\nNO 26 due posti'; end if;

  -- pacchetto che non basta: "Lo prendo" non scala e il posto passa avanti
  update client_packages set amount_remaining = 0 where client_id = v_fissa and is_active;
  v_res := lista_rispondi((select id from bookings where schedule_id = v_g and client_id = v_fissa and status = 'waitlist'), true);
  v_tot := v_tot + 1;
  if (v_res->>'preso')::boolean = false and v_res->>'motivo' = 'no_credits'
     and (select current_bookings from schedules where id = v_g) = 2
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 27 pacchetto che non basta: niente scalato, il posto si libera';
  else v_out := v_out || E'\nNO 27 ' || v_res::text; end if;

  -- esce dalla lista mentre il posto e' tenuto per lei: il posto si libera
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_jolly, 'role', 'authenticated')::text, true);
  perform cancel_booking((select id from bookings where schedule_id = v_g and client_id = v_jolly and status = 'waitlist'));
  reset role;
  v_tot := v_tot + 1;
  if (select current_bookings from schedules where id = v_g) = 1
  then v_ok := v_ok + 1; v_out := v_out || E'\nok 28 esce dalla lista con il posto tenuto: il posto si libera';
  else v_out := v_out || E'\nNO 28 ' || (select current_bookings from schedules where id = v_g); end if;

  raise exception 'ESITO %/% ok%', v_ok, v_tot, v_out;
end $$;
