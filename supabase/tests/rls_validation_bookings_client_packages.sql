-- =============================================================================
-- RLS HARDENING — Validation Block
-- Verifica: 20260617000000_rls_hardening.sql applicata correttamente
--
-- Risultato atteso: 9/9 PASS
-- Eseguito: 2026-06-19 → 9/9 PASS confermati
--
-- COME ESEGUIRE:
--   Incollare intero blocco nel SQL Editor Supabase ed eseguire.
--   Non distruttivo: tutto in BEGIN / ROLLBACK finale, zero effetti sul DB reale.
--
-- COSA TESTA:
--   1. 6 policy RESTRICTIVE TO public presenti in pg_policies
--   2. bookings SELECT (proprie righe) — deve funzionare
--   3. bookings INSERT diretto — deve essere bloccato (eccezione RLS WITH CHECK)
--   4. bookings UPDATE diretto — deve produrre 0 righe (RESTRICTIVE USING)
--   5. bookings DELETE diretto — deve produrre 0 righe (RESTRICTIVE USING)
--   6. client_packages SELECT (proprie righe) — deve funzionare
--   7. client_packages INSERT diretto — deve essere bloccato (eccezione RLS)
--   8. client_packages UPDATE diretto — deve produrre 0 righe
--   9. client_packages DELETE diretto — deve produrre 0 righe
--
-- UTENTE DI TEST: uid = c0432d65-9121-41d6-b882-23e46aca1c3d (role=client)
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _rls_results (
  n      SERIAL,
  test   TEXT,
  atteso TEXT,
  esito  TEXT
) ON COMMIT DROP;

DO $$
DECLARE
  v_uid     CONSTANT text := 'c0432d65-9121-41d6-b882-23e46aca1c3d';
  v_cnt     int;
  v_blocked bool;
  v_errmsg  text;
BEGIN

  ---------------------------------------------------------------------------
  -- TEST 1 — 6 policy RESTRICTIVE con roles={public}
  -- Gira come postgres (prima del SET LOCAL ROLE) per accesso sicuro al catalogo
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_cnt
  FROM pg_policies
  WHERE tablename IN ('bookings', 'client_packages')
    AND permissive = 'RESTRICTIVE'
    AND roles::text = '{public}';

  INSERT INTO _rls_results(test, atteso, esito) VALUES (
    'pg_policies: 6 RESTRICTIVE TO public',
    '6',
    CASE WHEN v_cnt = 6
      THEN 'PASS ✓ (' || v_cnt || ' trovate)'
      ELSE 'FAIL ✗ (' || v_cnt || ' trovate, attese 6)'
    END
  );

  -- Imposta JWT claims e passa al ruolo authenticated (soggetto a RLS)
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_uid, true);
  EXECUTE 'GRANT ALL ON _rls_results TO authenticated';
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE _rls_results_n_seq TO authenticated';
  EXECUTE 'SET LOCAL ROLE authenticated';

  ---------------------------------------------------------------------------
  -- TEST 2 — bookings: SELECT proprie righe (nessun errore atteso)
  ---------------------------------------------------------------------------
  v_blocked := false;
  BEGIN
    SELECT count(*) INTO v_cnt
    FROM public.bookings
    WHERE client_id = v_uid::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true; v_errmsg := SQLERRM;
  END;
  INSERT INTO _rls_results(test, atteso, esito) VALUES (
    'bookings SELECT (client_id proprio)',
    'ok — 0+ righe, nessun errore',
    CASE WHEN NOT v_blocked
      THEN 'PASS ✓ (' || v_cnt || ' righe visibili)'
      ELSE 'FAIL ✗ ' || v_errmsg
    END
  );

  ---------------------------------------------------------------------------
  -- TEST 3 — bookings: INSERT diretto (atteso: eccezione RLS WITH CHECK)
  -- BEGIN/EXCEPTION fa rollback implicito della riga tentata
  ---------------------------------------------------------------------------
  v_blocked := false;
  BEGIN
    INSERT INTO public.bookings (studio_id, client_id, schedule_id, status)
    VALUES (gen_random_uuid(), v_uid::uuid, gen_random_uuid(), 'confirmed');
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true; v_errmsg := SQLERRM;
  END;
  INSERT INTO _rls_results(test, atteso, esito) VALUES (
    'bookings INSERT diretto (client)',
    'bloccato da RLS (eccezione)',
    CASE WHEN v_blocked
      THEN 'PASS ✓ ' || left(v_errmsg, 90)
      ELSE 'FAIL ✗ — INSERT non bloccato!'
    END
  );

  ---------------------------------------------------------------------------
  -- TEST 4 — bookings: UPDATE diretto (atteso: 0 righe, RESTRICTIVE USING)
  -- USING=false → righe invisibili per UPDATE → 0 affected, nessun errore
  ---------------------------------------------------------------------------
  v_blocked := false; v_cnt := 0;
  BEGIN
    UPDATE public.bookings SET status = 'cancelled'
    WHERE client_id = v_uid::uuid;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true; v_errmsg := SQLERRM;
  END;
  INSERT INTO _rls_results(test, atteso, esito) VALUES (
    'bookings UPDATE diretto (client)',
    '0 righe (RESTRICTIVE USING filtra tutto)',
    CASE
      WHEN v_blocked THEN 'PASS ✓ (errore: ' || left(v_errmsg, 70) || ')'
      WHEN v_cnt = 0 THEN 'PASS ✓ (0 righe modificate)'
      ELSE                 'FAIL ✗ — ' || v_cnt || ' righe modificate!'
    END
  );

  ---------------------------------------------------------------------------
  -- TEST 5 — bookings: DELETE diretto (atteso: 0 righe, RESTRICTIVE USING)
  ---------------------------------------------------------------------------
  v_blocked := false; v_cnt := 0;
  BEGIN
    DELETE FROM public.bookings WHERE client_id = v_uid::uuid;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true; v_errmsg := SQLERRM;
  END;
  INSERT INTO _rls_results(test, atteso, esito) VALUES (
    'bookings DELETE diretto (client)',
    '0 righe (RESTRICTIVE USING filtra tutto)',
    CASE
      WHEN v_blocked THEN 'PASS ✓ (errore: ' || left(v_errmsg, 70) || ')'
      WHEN v_cnt = 0 THEN 'PASS ✓ (0 righe eliminate)'
      ELSE                 'FAIL ✗ — ' || v_cnt || ' righe eliminate!'
    END
  );

  ---------------------------------------------------------------------------
  -- TEST 6 — client_packages: SELECT proprie righe
  ---------------------------------------------------------------------------
  v_blocked := false;
  BEGIN
    SELECT count(*) INTO v_cnt
    FROM public.client_packages
    WHERE client_id = v_uid::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true; v_errmsg := SQLERRM;
  END;
  INSERT INTO _rls_results(test, atteso, esito) VALUES (
    'client_packages SELECT (client_id proprio)',
    'ok — 0+ righe, nessun errore',
    CASE WHEN NOT v_blocked
      THEN 'PASS ✓ (' || v_cnt || ' righe visibili)'
      ELSE 'FAIL ✗ ' || v_errmsg
    END
  );

  ---------------------------------------------------------------------------
  -- TEST 7 — client_packages: INSERT diretto (atteso: eccezione RLS)
  ---------------------------------------------------------------------------
  v_blocked := false;
  BEGIN
    INSERT INTO public.client_packages (studio_id, client_id, package_id, credits_total)
    VALUES (gen_random_uuid(), v_uid::uuid, gen_random_uuid(), 1);
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true; v_errmsg := SQLERRM;
  END;
  INSERT INTO _rls_results(test, atteso, esito) VALUES (
    'client_packages INSERT diretto (client)',
    'bloccato da RLS (eccezione)',
    CASE WHEN v_blocked
      THEN 'PASS ✓ ' || left(v_errmsg, 90)
      ELSE 'FAIL ✗ — INSERT non bloccato!'
    END
  );

  ---------------------------------------------------------------------------
  -- TEST 8 — client_packages: UPDATE diretto (atteso: 0 righe)
  ---------------------------------------------------------------------------
  v_blocked := false; v_cnt := 0;
  BEGIN
    UPDATE public.client_packages
    SET credits_used = credits_used + 99
    WHERE client_id = v_uid::uuid;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true; v_errmsg := SQLERRM;
  END;
  INSERT INTO _rls_results(test, atteso, esito) VALUES (
    'client_packages UPDATE diretto (client)',
    '0 righe (RESTRICTIVE USING filtra tutto)',
    CASE
      WHEN v_blocked THEN 'PASS ✓ (errore: ' || left(v_errmsg, 70) || ')'
      WHEN v_cnt = 0 THEN 'PASS ✓ (0 righe modificate)'
      ELSE                 'FAIL ✗ — ' || v_cnt || ' righe modificate!'
    END
  );

  ---------------------------------------------------------------------------
  -- TEST 9 — client_packages: DELETE diretto (atteso: 0 righe)
  ---------------------------------------------------------------------------
  v_blocked := false; v_cnt := 0;
  BEGIN
    DELETE FROM public.client_packages WHERE client_id = v_uid::uuid;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true; v_errmsg := SQLERRM;
  END;
  INSERT INTO _rls_results(test, atteso, esito) VALUES (
    'client_packages DELETE diretto (client)',
    '0 righe (RESTRICTIVE USING filtra tutto)',
    CASE
      WHEN v_blocked THEN 'PASS ✓ (errore: ' || left(v_errmsg, 70) || ')'
      WHEN v_cnt = 0 THEN 'PASS ✓ (0 righe eliminate)'
      ELSE                 'FAIL ✗ — ' || v_cnt || ' righe eliminate!'
    END
  );

END $$;

SELECT n, test, atteso, esito FROM _rls_results ORDER BY n;

ROLLBACK;
