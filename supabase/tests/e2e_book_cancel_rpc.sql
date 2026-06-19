-- ============================================================
-- E2E Test — book_lesson → cancel_booking (post RLS hardening)
-- Non distruttivo: tutto in BEGIN / ROLLBACK finale
-- 13 test: 4 setup + 4 post-book + 5 post-cancel
--
-- Eseguito: 2026-06-19 → 13/13 PASS
--
-- COME ESEGUIRE:
--   Incollare intero blocco nel SQL Editor Supabase ed eseguire.
--   Richiede hotspot (dominio .supabase.co bloccato da TIM).
--   Zero effetti sul DB: ROLLBACK finale annulla tutto.
--
-- PREREQUISITI:
--   - Profilo client c0432d65-... deve esistere con studio_id valorizzato
--   - Lo studio deve avere almeno una class attiva
--   - Se il client non ha client_package attivo, serve almeno un package
--     nel catalogo dello studio (viene creato ex-novo nella transazione)
--
-- FLUSSO:
--   Setup (postgres): trova studio/class, crea schedule +3gg, garantisce crediti
--   book_lesson (authenticated): RPC SECURITY DEFINER → usa auth.uid() dai claims
--   Verifica post-book (postgres via SET LOCAL ROLE NONE)
--   cancel_booking (authenticated): lezione >24h → rimborso garantito
--   Verifica post-cancel (postgres)
-- ============================================================

BEGIN;

CREATE TEMP TABLE _e2e (
  n      INT,
  test   TEXT,
  atteso TEXT,
  esito  TEXT
) ON COMMIT DROP;

DO $$
DECLARE
  v_client      CONSTANT uuid := 'c0432d65-9121-41d6-b882-23e46aca1c3d';
  v_studio      uuid;
  v_class       uuid;
  v_instructor  uuid;
  v_package     uuid;
  v_schedule    uuid;
  v_cp          uuid;
  v_booking     uuid;
  v_cancel_res  json;
  v_cr_before   int;
  v_cr_after    int;
  v_cur_bk      int;
  v_cnt         int;
  n             int := 0;
  v_ok          bool;
  v_err         text;
BEGIN

  -- Permesso sulla tabella risultati PRIMA di cambiare ruolo
  EXECUTE 'GRANT ALL ON _e2e TO authenticated';

  -- ── SETUP (gira come postgres) ─────────────────────────────────────────────

  SELECT studio_id INTO v_studio
  FROM public.profiles WHERE id = v_client;

  n := 1;
  INSERT INTO _e2e VALUES (n,
    'setup: studio_id dal profilo client',
    'uuid trovato',
    CASE WHEN v_studio IS NOT NULL
      THEN 'PASS ✓ ' || v_studio
      ELSE 'FAIL ✗ — client non trovato o studio_id NULL'
    END);
  IF v_studio IS NULL THEN RETURN; END IF;

  SELECT id INTO v_class
  FROM public.classes
  WHERE studio_id = v_studio AND is_active = true
  LIMIT 1;

  n := 2;
  INSERT INTO _e2e VALUES (n,
    'setup: class attiva trovata per lo studio',
    'uuid trovato',
    CASE WHEN v_class IS NOT NULL
      THEN 'PASS ✓ ' || v_class
      ELSE 'FAIL ✗ — nessuna class attiva per questo studio'
    END);
  IF v_class IS NULL THEN RETURN; END IF;

  -- instructor_id è nullable in schedules; se non c'è, si passa NULL
  SELECT id INTO v_instructor
  FROM public.profiles
  WHERE studio_id = v_studio AND role = 'instructor' AND is_active = true
  LIMIT 1;

  -- Lezione di test: +3 giorni, 10 posti, 0 prenotati → garantisce rimborso (>24h)
  INSERT INTO public.schedules
    (studio_id, class_id, instructor_id, starts_at, ends_at, max_spots, current_bookings)
  VALUES
    (v_studio, v_class, v_instructor,
     now() + interval '3 days',
     now() + interval '3 days 1 hour',
     10, 0)
  RETURNING id INTO v_schedule;

  n := 3;
  INSERT INTO _e2e VALUES (n,
    'setup: schedule di test creato (+3 gg, 10 posti)',
    'schedule_id',
    'PASS ✓ ' || v_schedule);

  -- Assicura crediti al client: aggiorna pacchetto esistente o ne crea uno
  SELECT id INTO v_cp
  FROM public.client_packages
  WHERE client_id = v_client AND is_active = true
  LIMIT 1;

  IF v_cp IS NOT NULL THEN
    UPDATE public.client_packages
    SET credits_total = 5, credits_used = 2, expires_at = NULL
    WHERE id = v_cp;
    v_cr_before := 2;

    n := 4;
    INSERT INTO _e2e VALUES (n,
      'setup: client_package esistente → stato noto (2/5 usati)',
      'credits_used=2',
      'PASS ✓ ' || v_cp);
  ELSE
    SELECT id INTO v_package
    FROM public.packages WHERE studio_id = v_studio LIMIT 1;

    IF v_package IS NULL THEN
      n := 4;
      INSERT INTO _e2e VALUES (n,
        'setup: client_package',
        'trovato o creato',
        'FAIL ✗ — nessun package nel DB per questo studio, impossibile proseguire');
      RETURN;
    END IF;

    INSERT INTO public.client_packages
      (studio_id, client_id, package_id, credits_total, credits_used, is_active)
    VALUES
      (v_studio, v_client, v_package, 5, 2, true)
    RETURNING id INTO v_cp;
    v_cr_before := 2;

    n := 4;
    INSERT INTO _e2e VALUES (n,
      'setup: client_package creato ex-novo (2/5 usati)',
      'credits_used=2',
      'PASS ✓ ' || v_cp);
  END IF;

  -- ── IMPERSONA CLIENT → book_lesson ─────────────────────────────────────────
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_client::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_client::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_ok := false;
  BEGIN
    v_booking := book_lesson(v_schedule);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  n := 5;
  INSERT INTO _e2e VALUES (n,
    'book_lesson(schedule_id) → booking_id',
    'uuid booking',
    CASE WHEN v_ok
      THEN 'PASS ✓ ' || v_booking
      ELSE 'FAIL ✗ ' || v_err
    END);
  IF NOT v_ok THEN RETURN; END IF;

  -- ── VERIFICA POST book_lesson (torna postgres con SET LOCAL ROLE NONE) ──────
  -- SET LOCAL ROLE NONE ripristina il session user (postgres) senza toccare i
  -- jwt.claims già impostati (transaction-scoped), pronti per cancel_booking
  EXECUTE 'SET LOCAL ROLE NONE';

  SELECT credits_used INTO v_cr_after
  FROM public.client_packages WHERE id = v_cp;

  n := 6;
  INSERT INTO _e2e VALUES (n,
    'post-book: client_packages.credits_used +1',
    v_cr_before + 1,
    CASE WHEN v_cr_after = v_cr_before + 1
      THEN 'PASS ✓ credits_used=' || v_cr_after
      ELSE 'FAIL ✗ credits_used=' || coalesce(v_cr_after::text, 'NULL')
           || ' (atteso ' || (v_cr_before + 1) || ')'
    END);

  SELECT count(*) INTO v_cnt
  FROM public.bookings
  WHERE id = v_booking AND client_id = v_client AND status = 'confirmed';

  n := 7;
  INSERT INTO _e2e VALUES (n,
    'post-book: bookings status=confirmed',
    '1 riga',
    CASE WHEN v_cnt = 1 THEN 'PASS ✓' ELSE 'FAIL ✗ (' || v_cnt || ' righe)' END);

  SELECT current_bookings INTO v_cur_bk
  FROM public.schedules WHERE id = v_schedule;

  n := 8;
  INSERT INTO _e2e VALUES (n,
    'post-book: schedules.current_bookings +1',
    '1',
    CASE WHEN v_cur_bk = 1 THEN 'PASS ✓' ELSE 'FAIL ✗ (' || coalesce(v_cur_bk::text, 'NULL') || ')' END);

  -- ── IMPERSONA CLIENT → cancel_booking ──────────────────────────────────────
  -- jwt.claims è ancora impostato (transaction-scoped); basta ri-settare il ruolo
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_ok := false;
  BEGIN
    v_cancel_res := cancel_booking(v_booking);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  n := 9;
  INSERT INTO _e2e VALUES (n,
    'cancel_booking(booking_id) → json',
    '{"cancelled":true,"refunded":true}',
    CASE WHEN v_ok
      THEN 'PASS ✓ ' || v_cancel_res::text
      ELSE 'FAIL ✗ ' || v_err
    END);
  IF NOT v_ok THEN RETURN; END IF;

  n := 10;
  INSERT INTO _e2e VALUES (n,
    'post-cancel: refunded=true (lezione +3gg → >24h)',
    'true',
    CASE WHEN (v_cancel_res->>'refunded')::bool = true
      THEN 'PASS ✓'
      ELSE 'FAIL ✗ refunded=' || coalesce(v_cancel_res->>'refunded', 'NULL')
    END);

  -- ── VERIFICA POST cancel_booking ───────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE NONE';

  SELECT credits_used INTO v_cr_after
  FROM public.client_packages WHERE id = v_cp;

  n := 11;
  INSERT INTO _e2e VALUES (n,
    'post-cancel: credits_used -1 (rimborso → torna a ' || v_cr_before || ')',
    v_cr_before,
    CASE WHEN v_cr_after = v_cr_before
      THEN 'PASS ✓ credits_used=' || v_cr_after
      ELSE 'FAIL ✗ credits_used=' || coalesce(v_cr_after::text, 'NULL')
           || ' (atteso ' || v_cr_before || ')'
    END);

  SELECT count(*) INTO v_cnt
  FROM public.bookings
  WHERE id = v_booking AND status = 'cancelled';

  n := 12;
  INSERT INTO _e2e VALUES (n,
    'post-cancel: bookings status=cancelled',
    '1 riga',
    CASE WHEN v_cnt = 1 THEN 'PASS ✓' ELSE 'FAIL ✗ (' || v_cnt || ' righe)' END);

  SELECT current_bookings INTO v_cur_bk
  FROM public.schedules WHERE id = v_schedule;

  n := 13;
  INSERT INTO _e2e VALUES (n,
    'post-cancel: schedules.current_bookings -1 (= 0)',
    '0',
    CASE WHEN v_cur_bk = 0 THEN 'PASS ✓' ELSE 'FAIL ✗ (' || coalesce(v_cur_bk::text, 'NULL') || ')' END);

END $$;

SELECT n, test, atteso, esito FROM _e2e ORDER BY n;

ROLLBACK;
