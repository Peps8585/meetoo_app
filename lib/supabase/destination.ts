import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Determina la rotta di destinazione post-autenticazione in base al ruolo.
 * Legge profiles.role per l'utente dato e instrada gli admin a /admin,
 * tutti gli altri a /dashboard.
 *
 * Fallback sicuro: se la query fallisce o il ruolo è null/undefined,
 * ritorna sempre '/dashboard' (non blocca mai l'accesso).
 */
export async function destinationForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || data?.role !== 'admin') return '/dashboard'
  return '/admin'
}
