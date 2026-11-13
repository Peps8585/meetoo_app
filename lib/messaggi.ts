import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { avvisoEmail } from '@/lib/email/templates'
import { inviaNotifica } from '@/lib/push/send'
import { avvisa } from '@/lib/posti-fissi/giro'
import { inviaWhatsApp, whatsappAcceso } from '@/lib/whatsapp/send'
import { APP_URL } from '@/lib/eventi'

// Messaggi tra studio e clienti (S35): gli avvisi che partono quando qualcuno
// scrive. Il messaggio sta gia' nel database (lo mettono le funzioni
// studio_invia_messaggio e messaggio_rispondi): qui si avvisa chi lo deve leggere.

type Admin = ReturnType<typeof createAdminClient>

const corto = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)

export type EsitoMessaggio = { mandati: number; notifica: number; email: number; whatsapp: number }

/**
 * Lo studio ha scritto: notifica sul telefono a ogni destinataria, o l'email
 * se le notifiche non le ha. Con `whatsapp` (solo per le iscritte di una
 * lezione) parte anche il WhatsApp a chi ha dato il consenso.
 */
export async function avvisaClienti(
  admin: Admin,
  p: { studioId: string; clienti: string[]; testo: string; whatsapp?: { scheduleId: string } }
): Promise<EsitoMessaggio> {
  const esito: EsitoMessaggio = { mandati: p.clienti.length, notifica: 0, email: 0, whatsapp: 0 }
  const link = `${APP_URL}/messaggi`
  const avviso = { titolo: 'Messaggio dallo studio', testo: corto(p.testo, 300) }
  const conWhatsApp = !!p.whatsapp && whatsappAcceso('lezione')

  const telefoni = new Map<string, { first_name: string | null; phone: string | null; whatsapp_eventi: boolean }>()
  if (conWhatsApp && p.clienti.length > 0) {
    const { data } = await admin.from('profiles').select('id, first_name, phone, whatsapp_eventi').in('id', p.clienti)
    for (const r of data ?? []) telefoni.set(r.id, r)
  }

  for (let i = 0; i < p.clienti.length; i += 8) {
    await Promise.all(
      p.clienti.slice(i, i + 8).map(async (id) => {
        const canale = await avvisa(admin, id, avviso, link, { primo: { href: link, label: 'Leggi e rispondi' } })
        if (canale === 'push') esito.notifica++
        else if (canale === 'email') esito.email++

        const c = telefoni.get(id)
        if (conWhatsApp && c?.whatsapp_eventi && c.phone) {
          const partito = await inviaWhatsApp(admin, {
            studioId: p.studioId,
            clientId: id,
            telefono: c.phone,
            modello: 'lezione',
            // {{1}} nome, {{2}} testo del messaggio
            valori: [c.first_name ?? 'ciao', corto(p.testo.replace(/\s+/g, ' '), 900)],
            scheduleId: p.whatsapp!.scheduleId,
          })
          if (partito) esito.whatsapp++
        }
      })
    )
  }
  return esito
}

/**
 * Una cliente ha risposto: notifica a chi gestisce lo studio (gli admin che
 * hanno attivato le notifiche); se non arriva a nessuno, email allo studio.
 */
export async function avvisaStudio(admin: Admin, clientId: string, testo: string): Promise<void> {
  const { data: c } = await admin.from('profiles').select('studio_id, first_name, last_name').eq('id', clientId).maybeSingle()
  if (!c?.studio_id) return
  const nome = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Una cliente'
  const link = `${APP_URL}/admin/messaggi/${clientId}`
  const avviso = { titolo: `${nome} ti ha scritto`, testo: corto(testo, 300) }

  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('studio_id', c.studio_id)
    .eq('role', 'admin')
    .neq('is_active', false)
  let arrivate = 0
  for (const a of admins ?? []) arrivate += await inviaNotifica(a.id, { ...avviso, url: link })
  if (arrivate > 0) return

  let email: string | null = process.env.GIFT_STUDIO_EMAIL ?? null
  if (!email) {
    const { data: s } = await admin.from('studios').select('email').eq('id', c.studio_id).maybeSingle()
    email = s?.email ?? null
  }
  if (!email) return
  const { subject, html } = avvisoEmail({ ...avviso, pulsante: { href: link, label: 'Leggi e rispondi' } })
  await sendEmail({ to: email, subject, html })
}

/** "Mandato a 38: notifica a 21, email a 17." */
export function riassuntoMessaggio(e: EsitoMessaggio): string {
  if (e.mandati === 0) return 'Nessuna destinataria: il messaggio non è partito.'
  const parti = [
    e.notifica ? `notifica a ${e.notifica}` : '',
    e.email ? `email a ${e.email}` : '',
    e.whatsapp ? `WhatsApp a ${e.whatsapp}` : '',
  ].filter(Boolean)
  return `Mandato a ${e.mandati}${parti.length ? `: ${parti.join(', ')}` : ''}.`
}
