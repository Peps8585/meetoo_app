-- =============================================================================
-- RLS HARDENING — bookings & client_packages
-- 2026-06-17
--
-- STRATEGIA: policy RESTRICTIVE (non PERMISSIVE).
--   - Le RESTRICTIVE si sommano per AND sopra le PERMISSIVE esistenti.
--   - Non toccano né rimuovono le SELECT policy già presenti.
--   - Le funzioni SECURITY DEFINER (book_lesson, cancel_booking) girano come
--     postgres (superuser) → bypassano RLS interamente → non sono impattate.
--   - La service_role ha BYPASSRLS → le Server Actions non sono impattate.
--
-- PREFLIGHT CONSIGLIATO — esegui prima nel SQL Editor per vedere le policy
-- esistenti (pure i nomi, per capire cosa c'è già):
--
--   SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename IN ('bookings', 'client_packages')
--   ORDER BY tablename, cmd;
--
-- =============================================================================

-- =============================================================================
-- BOOKINGS
-- I client prenotano e cancellano SOLO via RPC (book_lesson / cancel_booking).
-- Admin e instructor possono scrivere direttamente (gestione manuale).
-- =============================================================================

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- blocca INSERT diretti da client
DROP POLICY IF EXISTS "bookings_restrict_insert" ON public.bookings;
CREATE POLICY "bookings_restrict_insert"
  ON public.bookings
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (get_user_role() IN ('admin', 'instructor'));

-- blocca UPDATE diretti da client
DROP POLICY IF EXISTS "bookings_restrict_update" ON public.bookings;
CREATE POLICY "bookings_restrict_update"
  ON public.bookings
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING     (get_user_role() IN ('admin', 'instructor'))
  WITH CHECK (get_user_role() IN ('admin', 'instructor'));

-- blocca DELETE diretti da client
-- (le cancellazioni usano status='cancelled', non DELETE fisica)
DROP POLICY IF EXISTS "bookings_restrict_delete" ON public.bookings;
CREATE POLICY "bookings_restrict_delete"
  ON public.bookings
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING (get_user_role() IN ('admin', 'instructor'));

-- =============================================================================
-- CLIENT_PACKAGES
-- Solo admin/instructor assegnano/modificano pacchetti.
-- I client leggono i propri (SELECT esistente non toccata).
-- book_lesson e cancel_booking aggiornano credits_used bypassando RLS.
-- =============================================================================

ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;

-- blocca INSERT diretti da client
DROP POLICY IF EXISTS "client_packages_restrict_insert" ON public.client_packages;
CREATE POLICY "client_packages_restrict_insert"
  ON public.client_packages
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (get_user_role() IN ('admin', 'instructor'));

-- blocca UPDATE diretti da client (credits_used, is_active, ecc.)
DROP POLICY IF EXISTS "client_packages_restrict_update" ON public.client_packages;
CREATE POLICY "client_packages_restrict_update"
  ON public.client_packages
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING     (get_user_role() IN ('admin', 'instructor'))
  WITH CHECK (get_user_role() IN ('admin', 'instructor'));

-- blocca DELETE diretti da client
DROP POLICY IF EXISTS "client_packages_restrict_delete" ON public.client_packages;
CREATE POLICY "client_packages_restrict_delete"
  ON public.client_packages
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING (get_user_role() IN ('admin', 'instructor'));
