-- =============================================================================
-- RPC FUNCTIONS — Mee Too Pilates
-- Corpo delle funzioni da recuperare con la query seguente nel SQL Editor:
--
--   SELECT proname, pg_get_functiondef(oid) AS definition
--   FROM pg_proc
--   WHERE proname IN ('book_lesson','cancel_booking','get_user_role','get_user_studio_id')
--     AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
--
-- Incollare i risultati sostituendo i segnaposto TODO qui sotto.
-- =============================================================================

-- TODO: incollare il corpo di get_user_role dal SQL Editor
-- Firma: get_user_role() → text
-- Scopo: restituisce il role dell'utente corrente (auth.uid()) dalla tabella profiles


-- TODO: incollare il corpo di get_user_studio_id dal SQL Editor
-- Firma: get_user_studio_id() → uuid
-- Scopo: restituisce lo studio_id dell'utente corrente (auth.uid()) dalla tabella profiles


-- TODO: incollare il corpo di book_lesson dal SQL Editor
-- Firma: book_lesson(p_schedule_id uuid) → void (o json)
-- Scopo: prenota un posto in schedules, scala un credito da client_packages,
--        incrementa current_bookings su schedules, inserisce in bookings e
--        wallet_transactions — tutto in una transazione atomica


-- TODO: incollare il corpo di cancel_booking dal SQL Editor
-- Firma: cancel_booking(p_booking_id uuid) → void (o json)
-- Scopo: imposta bookings.status = 'cancelled', rimborsa il credito su
--        client_packages, decrementa current_bookings su schedules,
--        inserisce in wallet_transactions — tutto in una transazione atomica
