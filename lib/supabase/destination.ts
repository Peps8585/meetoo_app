import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Determina la rotta di destinazione post-autenticazione in base al ruolo.
 * Legge profiles.role per l'utente dato e instrada gli admin a /admin,
 * le istruttrici a /agenda, tutti gli altri a /dashboard.
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

  if (error) return '/dashboard'
  if (data?.role === 'admin') return '/admin'
  if (data?.role === 'instructor') return '/agenda'
  return '/dashboard'
}
