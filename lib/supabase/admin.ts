import { createClient } from '@supabase/supabase-js'

/**
 * Client con la service role: salta RLS. Solo codice server, mai nel browser.
 * Lo usano le pagine pubbliche dei regali (/regala, /regalo/[codice]) e il
 * webhook di Stripe, che non hanno un utente collegato.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mancante')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
