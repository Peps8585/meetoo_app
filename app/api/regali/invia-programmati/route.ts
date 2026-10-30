import { sendDueGifts } from '@/lib/gift/fulfill'

/**
 * Manda i regali programmati arrivati alla loro ora (es. la mattina di Natale).
 * Va chiamato ogni 10-15 minuti con l'intestazione Authorization: Bearer <CRON_SECRET>.
 * Chi lo chiama si decide all'accensione vera (pg_cron + pg_net su Supabase).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('non autorizzato', { status: 401 })
  }
  return Response.json(await sendDueGifts())
}
