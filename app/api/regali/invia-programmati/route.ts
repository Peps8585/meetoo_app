import { sendDueGifts } from '@/lib/gift/fulfill'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Manda i regali programmati arrivati alla loro ora (es. la mattina di Natale).
 * Lo chiama ogni 10 minuti pg_cron su Supabase (job 'gift-invia-programmati') con
 * Authorization: Bearer <chiave>. La chiave la genera e la custodisce il database
 * (Vault, 'gift_cron_secret'): qui la si rilegge con la service role, cosi' non va
 * copiata a mano su Vercel. CRON_SECRET nell'ambiente, se c'e', ha la precedenza.
 */
async function chiave(): Promise<string | null> {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET
  const { data } = await createAdminClient().rpc('gift_cron_secret')
  return typeof data === 'string' && data.length >= 32 ? data : null
}

export async function GET(request: Request) {
  const segreto = await chiave()
  if (!segreto || request.headers.get('authorization') !== `Bearer ${segreto}`) {
    return new Response('non autorizzato', { status: 401 })
  }
  return Response.json(await sendDueGifts())
}
