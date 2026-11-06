import { sendDueGifts } from '@/lib/gift/fulfill'
import { giroAutorizzato } from '@/lib/cron'

/**
 * Manda i regali programmati arrivati alla loro ora (es. la mattina di Natale).
 * Lo chiama ogni 10 minuti pg_cron su Supabase (job 'gift-invia-programmati') con
 * Authorization: Bearer <chiave>. La chiave: vedi lib/cron.ts.
 */
export async function GET(request: Request) {
  if (!(await giroAutorizzato(request))) {
    return new Response('non autorizzato', { status: 401 })
  }
  return Response.json(await sendDueGifts())
}
