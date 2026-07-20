import { Resend } from 'resend'

// Mittente: finché non c'è un dominio verificato su Resend si usa il sandbox
// onboarding@resend.dev, che consegna SOLO all'email dell'account Resend.
// In produzione EMAIL_FROM va puntato a un indirizzo su dominio verificato.
const FROM = process.env.EMAIL_FROM ?? 'Mee Too <onboarding@resend.dev>'

/**
 * Invio best-effort: un'email che fallisce non deve MAI bloccare il flusso
 * che l'ha originata (signup, prenotazione). Nessun throw verso il chiamante:
 * l'esito è solo loggato e ritornato come boolean.
 */
export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY assente — invio saltato: "${params.subject}"`)
    return { ok: false }
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    if (error) {
      console.error(`[email] invio fallito ("${params.subject}"):`, error.message)
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.error(`[email] eccezione durante l'invio ("${params.subject}"):`, err)
    return { ok: false }
  }
}
