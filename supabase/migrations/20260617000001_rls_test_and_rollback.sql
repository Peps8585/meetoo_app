-- =============================================================================
-- RLS HARDENING — TEST E ROLLBACK
-- Da eseguire nel SQL Editor DOPO aver applicato 20260617000000_rls_hardening.sql
-- Questo file non modifica dati reali: tutto è in una transazione che fa ROLLBACK.
-- =============================================================================

-- =============================================================================
-- SEZIONE 0 — PREFLIGHT: verifica owner funzioni e stato RLS
-- Esegui questa sezione PRIMA di applicare la migration di hardening.
-- Owner atteso: postgres (superuser → bypassa RLS con SECURITY DEFINER).
-- Se owner ≠ postgres, le RPC non bypassano RLS e book_lesson fallisce per i client.
-- =============================================================================

-- 0a. Owner e SECURITY DEFINER delle funzioni
SELECT
  proname                AS funzione,
  proowner::regrole      AS owner,
  prosecdef              AS security_definer,
  CASE
    WHEN prosecdef AND proowner::regrole::text = 'postgres'
      THEN 'OK — bypassa RLS'
    WHEN prosecdef
      THEN 'ATTENZIONE — SECURITY DEFINER ma owner non è postgres'
    ELSE 'PERICOLO — non è SECURITY DEFINER'
  END                    AS valutazione
FROM pg_proc
WHERE proname IN ('book_lesson', 'cancel_booking', 'get_user_role', 'get_user_studio_id')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 0b. RLS e FORCE RLS sulle tabelle
SELECT
  relname             AS tabella,
  relrowsecurity      AS rls_abilitata,
  relforcerowsecurity AS force_rls
FROM pg_class
WHERE relname IN ('bookings', 'client_packages') AND relkind = 'r';
-- Se force_rls = true e owner funzione ≠ postgres → problema: SECURITY DEFINER non bypassa

-- 0c. Policy esistenti (deve includere le 6 RESTRICTIVE dopo l'apply)
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('bookings', 'client_packages')
ORDER BY tablename, cmd, permissive;

-- =============================================================================
-- SEZIONE 1 — TEST (eseguire DOPO l'apply della migration di hardening)
-- Tutto in una transazione: ROLLBACK finale garantisce zero effetti sul DB.
-- =============================================================================

BEGIN;

-- Impersona un client reale (sceglie il primo con studio_id valorizzato)
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',  (SELECT id::text FROM profiles WHERE role = 'client' AND studio_id IS NOT NULL LIMIT 1),
    'aud',  'authenticated',
    'role', 'authenticated'
  )::text,
  true   -- is_local: scoped alla transazione
);
SET LOCAL ROLE authenticated;

-- Conferma che siamo nel contesto del client corretto
SELECT
  current_user                        AS db_role,
  auth.uid()                          AS uid_impersonato,
  get_user_role()                     AS role_da_profiles;
-- Atteso: db_role=authenticated, role_da_profiles='client'

-- ── TEST A: book_lesson deve riuscire ────────────────────────────────────────
DO $$
DECLARE
  v_schedule_id  uuid;
  v_booking_id   uuid;
  v_has_credits  boolean;
BEGIN
  -- Verifica prerequisiti: client ha pacchetto con crediti?
  SELECT EXISTS (
    SELECT 1 FROM client_packages
    WHERE client_id = auth.uid()
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND coalesce(credits_used,0) < credits_total
  ) INTO v_has_credits;

  IF NOT v_has_credits THEN
    RAISE NOTICE 'SKIP TEST A: il client impersonato non ha crediti disponibili — crea un client_package di test prima di rieseguire';
    RETURN;
  END IF;

  -- Trova uno slot futuro con posti liberi
  SELECT id INTO v_schedule_id
  FROM schedules
  WHERE is_cancelled = false
    AND starts_at > now()
    AND current_bookings < max_spots
  LIMIT 1;

  IF v_schedule_id IS NULL THEN
    RAISE NOTICE 'SKIP TEST A: nessuno schedule futuro con posti disponibili';
    RETURN;
  END IF;

  -- Chiama la RPC come client
  v_booking_id := book_lesson(v_schedule_id);
  RAISE NOTICE 'OK TEST A: book_lesson riuscita — booking_id=%', v_booking_id;

  -- ── TEST C: cancel_booking deve riuscire ──────────────────────────────────
  DECLARE
    v_result json;
  BEGIN
    v_result := cancel_booking(v_booking_id);
    RAISE NOTICE 'OK TEST C: cancel_booking riuscita — result=%', v_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL TEST C: cancel_booking ha sollevato eccezione: %', SQLERRM;
  END;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL TEST A: book_lesson ha sollevato eccezione: %', SQLERRM;
END;
$$;

-- ── TEST B: INSERT diretto su bookings deve essere BLOCCATO ──────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO bookings (studio_id, client_id, schedule_id, status)
    SELECT
      p.studio_id,
      p.id,
      (SELECT id FROM schedules WHERE is_cancelled = false AND starts_at > now() LIMIT 1),
      'test_direct_rls'
    FROM profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;

    -- Se arriviamo qui, RLS non ha bloccato → FAIL
    RAISE NOTICE 'FAIL TEST B: INSERT diretto NON è stato bloccato — le policy RESTRICTIVE non funzionano!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK TEST B: INSERT diretto bloccato da RLS — %', SQLERRM;
  END;
END;
$$;

-- ── TEST D: INSERT diretto su client_packages deve essere BLOCCATO ───────────
DO $$
BEGIN
  BEGIN
    INSERT INTO client_packages (studio_id, client_id, package_id, credits_total)
    SELECT
      p.studio_id,
      p.id,
      (SELECT id FROM packages WHERE studio_id = p.studio_id LIMIT 1),
      999
    FROM profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;

    RAISE NOTICE 'FAIL TEST D: INSERT su client_packages NON bloccato!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK TEST D: INSERT su client_packages bloccato — %', SQLERRM;
  END;
END;
$$;

-- ── TEST E: UPDATE diretto su client_packages deve essere BLOCCATO ───────────
DO $$
BEGIN
  BEGIN
    UPDATE client_packages
      SET credits_used = 0
    WHERE client_id = auth.uid();

    RAISE NOTICE 'FAIL TEST E: UPDATE su client_packages NON bloccato!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK TEST E: UPDATE su client_packages bloccato — %', SQLERRM;
  END;
END;
$$;

ROLLBACK; -- <-- sempre: zero effetti sul DB reale

-- =============================================================================
-- SEZIONE 2 — ROLLBACK (se book_lesson fallisce dopo l'apply)
-- Rimuove le 6 policy RESTRICTIVE aggiunte da 20260617000000_rls_hardening.sql
-- NON tocca RLS enable/disable né le policy PERMISSIVE preesistenti.
-- =============================================================================

/*  ← decommentare ed eseguire solo in caso di emergenza

DROP POLICY IF EXISTS "bookings_restrict_insert"         ON public.bookings;
DROP POLICY IF EXISTS "bookings_restrict_update"         ON public.bookings;
DROP POLICY IF EXISTS "bookings_restrict_delete"         ON public.bookings;
DROP POLICY IF EXISTS "client_packages_restrict_insert"  ON public.client_packages;
DROP POLICY IF EXISTS "client_packages_restrict_update"  ON public.client_packages;
DROP POLICY IF EXISTS "client_packages_restrict_delete"  ON public.client_packages;

*/
