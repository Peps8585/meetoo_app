'use server'

import { headers } from 'next/headers'
import { sendEmail } from '@/lib/email/send'
import { welcomeEmail } from '@/lib/email/templates'

// Chiamata fire-and-forget dalla pagina registrati dopo signUp riuscito.
// Al momento del signup non esiste ancora una sessione (con la conferma email
// attiva), quindi l'action non può verificare il chiamante: il contenuto è
// fisso e senza dati sensibili, il rate limiting lo fa Resend.
export async function sendWelcomeEmail(email: string, nome: string): Promise<void> {
  if (!email) return
  const h = await headers()
  const appUrl = h.get('origin') ?? 'https://meetoo-app-ntls.vercel.app'
  const { subject, html } = welcomeEmail({ firstName: nome || null, appUrl })
  await sendEmail({ to: email, subject, html })
}
