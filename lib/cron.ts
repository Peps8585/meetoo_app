import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Chiave dei giri automatici chiamati da pg_cron (regali programmati, posti
 * fissi). La genera e la custodisce il database (Vault, 'gift_cron_secret'):
 * qui la si rilegge con la service role, cosi' non va copiata a mano su
 * Vercel. CRON_SECRET nell'ambiente, se c'e', ha la precedenza.
 */
async function chiave(): Promise<string | null> {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET
  const { data } = await createAdminClient().rpc('gift_cron_secret')
  return typeof data === 'string' && data.length >= 32 ? data : null
}

export async function giroAutorizzato(request: Request): Promise<boolean> {
  const segreto = await chiave()
  return !!segreto && request.headers.get('authorization') === `Bearer ${segreto}`
}
