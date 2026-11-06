import { giroAutorizzato } from '@/lib/cron'
import { giroPostiFissi } from '@/lib/posti-fissi/giro'

/**
 * Giro dei posti fissi e della lista d'attesa. Lo chiama ogni 10 minuti pg_cron
 * su Supabase (job 'posti-fissi-giro') con Authorization: Bearer <chiave>,
 * la stessa dei regali programmati (lib/cron.ts).
 */
export async function GET(request: Request) {
  if (!(await giroAutorizzato(request))) {
    return new Response('non autorizzato', { status: 401 })
  }
  return Response.json(await giroPostiFissi())
}
