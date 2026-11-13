import type { createAdminClient } from '@/lib/supabase/admin'

// WhatsApp automatici dall'app (S35): WhatsApp Cloud API di Meta, in
// coesistenza sul numero dello studio. Finche' i passaggi con Meta non sono
// fatti (verifica attivita', numero collegato, testo tipo approvato, metodo di
// pagamento) le variabili qui sotto non ci sono e non parte niente: l'app
// continua con notifica ed email.
//
//   WHATSAPP_TOKEN            token di sistema dell'account WhatsApp Business
//   WHATSAPP_PHONE_ID         id del numero dello studio nella Cloud API
//   WHATSAPP_MODELLO_EVENTO   nome del testo tipo approvato per gli eventi
//   WHATSAPP_MODELLO_LEZIONE  nome del testo tipo per le iscritte di una lezione
//   WHATSAPP_PROVA=1          non chiama Meta: scrive solo nel registro (per le prove)
//
// Ogni messaggio a pagamento parte solo verso chi ha dato il consenso
// (profiles.whatsapp_eventi) e viene scritto in whatsapp_invii.
// DA VERIFICARE all'attivazione sui documenti di Meta: versione dell'API e
// listino in vigore (letti a novembre 2026 solo da fonti di terzi).

type Admin = ReturnType<typeof createAdminClient>

const GRAPH = 'https://graph.facebook.com/v21.0'

export type ModelloWhatsApp = 'evento' | 'lezione'

function nomeModello(m: ModelloWhatsApp): string | undefined {
  return m === 'evento' ? process.env.WHATSAPP_MODELLO_EVENTO : process.env.WHATSAPP_MODELLO_LEZIONE
}

const inProva = () => process.env.WHATSAPP_PROVA === '1'

/** WhatsApp e' collegato per questo tipo di messaggio? */
export function whatsappAcceso(m: ModelloWhatsApp): boolean {
  if (inProva()) return true
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && nomeModello(m))
}

/**
 * Numero come lo vuole Meta: solo cifre con il prefisso del paese.
 * "389 295 2958" -> "393892952958"; "+39 389..." e "0039 389..." uguale.
 * Ritorna null se non sembra un cellulare.
 */
export function numeroWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  let n = telefono.replace(/[^\d+]/g, '')
  if (n.startsWith('+')) n = n.slice(1)
  else if (n.startsWith('00')) n = n.slice(2)
  else if (/^3\d{8,9}$/.test(n)) n = `39${n}` // cellulare italiano scritto senza prefisso
  n = n.replace(/\D/g, '')
  return n.length >= 10 && n.length <= 15 ? n : null
}

/**
 * Manda un testo tipo approvato. `valori` riempie nell'ordine i segnaposto
 * {{1}}, {{2}}... del testo. Ritorna true se Meta l'ha preso in carico.
 */
export async function inviaWhatsApp(
  admin: Admin,
  p: {
    studioId: string
    clientId: string
    telefono: string
    modello: ModelloWhatsApp
    valori: string[]
    eventoId?: string
    scheduleId?: string
  }
): Promise<boolean> {
  const numero = numeroWhatsApp(p.telefono)
  if (!numero || !whatsappAcceso(p.modello)) return false

  const registro = {
    studio_id: p.studioId,
    client_id: p.clientId,
    evento_id: p.eventoId ?? null,
    schedule_id: p.scheduleId ?? null,
    modello: p.modello,
    telefono: numero,
  }

  if (inProva()) {
    await admin.from('whatsapp_invii').insert({ ...registro, esito: 'prova' })
    return true
  }

  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'template',
        template: {
          name: nomeModello(p.modello),
          language: { code: 'it' },
          components: [{ type: 'body', parameters: p.valori.map((text) => ({ type: 'text', text })) }],
        },
      }),
    })
    const json = (await res.json().catch(() => null)) as {
      messages?: { id: string }[]
      error?: { message?: string }
    } | null
    if (!res.ok || !json?.messages?.[0]?.id) {
      const errore = json?.error?.message ?? `HTTP ${res.status}`
      console.error('[whatsapp] invio fallito:', errore)
      await admin.from('whatsapp_invii').insert({ ...registro, esito: 'errore', errore: errore.slice(0, 500) })
      return false
    }
    await admin.from('whatsapp_invii').insert({ ...registro, esito: 'inviato', wa_id: json.messages[0].id })
    return true
  } catch (err) {
    console.error('[whatsapp] eccezione:', (err as Error).message)
    await admin.from('whatsapp_invii').insert({ ...registro, esito: 'errore', errore: (err as Error).message.slice(0, 500) })
    return false
  }
}
