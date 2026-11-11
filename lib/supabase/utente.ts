import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Chi e' collegata, letto dal token della sessione e verificato qui sul server
 * con la chiave pubblica di Supabase (firma ES256), senza chiamare il server
 * di autenticazione a ogni pagina come fa getUser(): un viaggio in meno per
 * ogni pagina aperta. Se il token non e' valido o e' scaduto ritorna null.
 */
export async function utenteDaSessione(
  supabase: SupabaseClient
): Promise<{ id: string; email: string | undefined } | null> {
  const { data, error } = await supabase.auth.getClaims()
  const c = data?.claims
  if (error || !c?.sub) return null
  return { id: c.sub, email: typeof c.email === 'string' ? c.email : undefined }
}
