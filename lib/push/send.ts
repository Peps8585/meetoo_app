import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

// Notifiche sul telefono (Web Push). Le iscrizioni stanno in push_subscriptions:
// una per telefono o browser su cui la cliente ha detto si'. Su iPhone arrivano
// solo se l'app e' stata aggiunta alla schermata Home.

export type Notifica = { titolo: string; testo: string; url: string }

let configurato = false
function configura(): boolean {
  if (configurato) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) {
    console.warn('[push] chiavi VAPID assenti: notifiche saltate')
    return false
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:meetoopilates@gmail.com', pub, priv)
  configurato = true
  return true
}

/**
 * Manda la notifica a tutti i dispositivi attivi della cliente.
 * Ritorna quante sono arrivate al servizio di notifiche: 0 vuol dire che
 * serve l'email. Un'iscrizione scaduta (404/410) si spegne da sola.
 */
export async function inviaNotifica(clientId: string, n: Notifica): Promise<number> {
  if (!configura()) return 0
  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, key_p256dh, key_auth')
    .eq('client_id', clientId)
    .eq('is_active', true)

  let arrivate = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.key_p256dh, auth: s.key_auth } },
        JSON.stringify({ title: n.titolo, body: n.testo, url: n.url }),
        { TTL: 12 * 60 * 60, urgency: 'high' }
      )
      arrivate++
      await admin.from('push_subscriptions').update({ last_success_at: new Date().toISOString() }).eq('id', s.id)
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').update({ is_active: false }).eq('id', s.id)
      } else {
        console.error('[push] invio fallito:', code, (err as Error).message)
      }
    }
  }
  return arrivate
}
