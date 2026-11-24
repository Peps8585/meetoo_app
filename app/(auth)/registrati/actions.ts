'use server'

import { headers } from 'next/headers'
import { sendEmail } from '@/lib/email/send'
import { welcomeEmail } from '@/lib/email/templates'
import { avvisaStudioNuovaIscritta } from '@/lib/approvazione/avvisi'
import { createAdminClient } from '@/lib/supabase/admin'

// Chiamata fire-and-forget dalla pagina registrati dopo signUp riuscito.
// Al momento del signup non esiste ancora una sessione (con la conferma email
// attiva), quindi l'action non può verificare il chiamante: il contenuto è
// fisso e senza dati sensibili, il rate limiting lo fa Resend.
export async function sendWelcomeEmail(email: string, nome: string): Promise<void> {
  if (!email) return
  const h = await headers()
  const appUrl = h.get('origin') ?? 'https://meetoo-app-ntls.vercel.app'
  // fase di prova (24/11/2026): se lo studio tiene chiuse le prenotazioni dall'app lo dice gia' qui
  const { data: studi } = await createAdminClient().from('studios').select('prenotazioni_app')
  const inProva = (studi ?? []).some((x: { prenotazioni_app: boolean | null }) => x.prenotazioni_app === false)
  const { subject, html } = welcomeEmail({ firstName: nome || null, appUrl, inProva })
  await sendEmail({ to: email, subject, html })
}

// Avvisa lo studio che una cliente nuova aspetta la conferma (19/11/2026).
// Come sopra, senza sessione: i controlli li fa avvisaStudioNuovaIscritta.
export async function avvisaStudio(email: string): Promise<void> {
  try {
    await avvisaStudioNuovaIscritta(email)
  } catch (e) {
    console.error('[registrati] avviso allo studio non partito', e)
  }
}
