import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { avvisa } from '@/lib/posti-fissi/giro'
import { inviaWhatsApp, whatsappAcceso } from '@/lib/whatsapp/send'
import { linkEvento, quandoEvento, type EsitoAvviso, type Evento } from '@/lib/eventi'

// L'avviso di un evento "parte tutto dall'app" (scelta di Mattia del 12/11):
// a ogni cliente attiva dello studio la notifica sul telefono, oppure l'email
// se le notifiche non le ha; in piu' il WhatsApp con il link a chi ha dato il
// consenso, quando WhatsApp e' collegato. Un evento si annuncia una volta sola.

type Admin = ReturnType<typeof createAdminClient>

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function testoAvvisoEvento(e: Pick<Evento, 'titolo' | 'inizio' | 'fine'>) {
  return {
    titolo: `In studio: ${e.titolo}`,
    testo: `${maiuscola(quandoEvento(e))}. Tocca per leggere tutti i dettagli.`,
  }
}

/** A gruppi, per non aspettare una cliente alla volta. */
async function aGruppi<T>(righe: T[], quante: number, fai: (r: T) => Promise<void>) {
  for (let i = 0; i < righe.length; i += quante) await Promise.all(righe.slice(i, i + quante).map(fai))
}

/**
 * Manda l'avviso dell'evento. Ritorna null se era gia' partito (o l'evento non
 * c'e'): la presa in carico e' una sola riga aggiornata, cosi' due tocchi
 * ravvicinati non mandano due volte.
 */
export async function avvisaEvento(admin: Admin, eventoId: string): Promise<EsitoAvviso | null> {
  const { data: preso } = await admin
    .from('eventi')
    .update({ avviso_at: new Date().toISOString() })
    .eq('id', eventoId)
    .eq('pubblicato', true)
    .is('avviso_at', null)
    .select('id, studio_id, titolo, inizio, fine')
    .maybeSingle()
  if (!preso) return null
  const e = preso as Pick<Evento, 'id' | 'studio_id' | 'titolo' | 'inizio' | 'fine'>

  const { data: clienti } = await admin
    .from('profiles')
    .select('id, first_name, phone, whatsapp_eventi')
    .eq('studio_id', e.studio_id)
    .eq('role', 'client')
    .neq('is_active', false)

  const esito: EsitoAvviso = { notifica: 0, email: 0, whatsapp: 0, nessuno: 0 }
  const avviso = testoAvvisoEvento(e)
  const link = linkEvento(e.id)
  const conWhatsApp = whatsappAcceso('evento')

  await aGruppi(clienti ?? [], 8, async (c) => {
    const canale = await avvisa(admin, c.id, avviso, link, { primo: { href: link, label: 'Leggi i dettagli' } })
    if (canale === 'push') esito.notifica++
    else if (canale === 'email') esito.email++
    else esito.nessuno++

    if (conWhatsApp && c.whatsapp_eventi && c.phone) {
      const partito = await inviaWhatsApp(admin, {
        studioId: e.studio_id,
        clientId: c.id,
        telefono: c.phone,
        modello: 'evento',
        // {{1}} nome, {{2}} titolo, {{3}} quando, {{4}} link
        valori: [c.first_name ?? 'ciao', e.titolo, quandoEvento(e), link],
        eventoId: e.id,
      })
      if (partito) esito.whatsapp++
    }
  })

  await admin.from('eventi').update({ avviso_esito: esito }).eq('id', e.id)
  return esito
}

/** "Notifica a 21, email a 14, WhatsApp a 9." */
export function riassuntoAvviso(e: EsitoAvviso): string {
  const parti = [
    e.notifica ? `notifica a ${e.notifica}` : '',
    e.email ? `email a ${e.email}` : '',
    e.whatsapp ? `WhatsApp a ${e.whatsapp}` : '',
  ].filter(Boolean)
  const perse = e.nessuno ? ` ${e.nessuno === 1 ? 'Una cliente non è stata raggiunta' : `${e.nessuno} clienti non sono state raggiunte`}: non hanno le notifiche e l’email non è partita.` : ''
  if (parti.length === 0) return perse ? perse.trim() : 'Nessuna cliente da avvisare.'
  const frase = parti.join(', ')
  return frase.charAt(0).toUpperCase() + frase.slice(1) + '.' + perse
}
