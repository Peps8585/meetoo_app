'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type Risposta = 'ci_sono' | 'non_vengo' | 'prendo' | 'esci'

const ERRORI: Record<string, string> = {
  full: 'Il posto l’ha appena preso un’altra persona. Resti in lista: se se ne libera un altro ti avvisiamo.',
  no_credits: 'Il tuo pacchetto non basta per questa lezione. Puoi rinnovarlo in studio.',
  booking_closed: 'Le iscrizioni a questa lezione sono chiuse.',
  schedule_cancelled: 'Questa lezione è stata annullata.',
  schedule_past: 'Questa lezione è già passata.',
  already_booked: 'Sei già dentro a questa lezione.',
}

/**
 * La pagina /presenza/<codice> non chiede di entrare nell'app: il codice nel
 * link (nella notifica o nell'email) vale come firma. Qui si rilegge tutto dal
 * database con la service role e le regole restano quelle di sempre
 * (cancel_booking_for / book_lesson_for, con la cliente della prenotazione).
 */
export async function rispondi(
  token: string,
  risposta: Risposta
): Promise<{ ok: boolean; messaggio?: string; token?: string }> {
  const admin = createAdminClient()
  const { data: b } = await admin
    .from('bookings')
    .select('id, client_id, schedule_id, status')
    .eq('action_token', token)
    .maybeSingle()
  if (!b) return { ok: false, messaggio: 'Link non valido.' }

  const ora = new Date().toISOString()

  if (risposta === 'ci_sono') {
    if (b.status !== 'confirmed' && b.status !== 'held') return { ok: false, messaggio: 'Questa prenotazione non è più attiva.' }
    await admin.from('bookings').update({ response: 'ci_sono', responded_at: ora }).eq('id', b.id)
  }

  if (risposta === 'non_vengo' || risposta === 'esci') {
    const { error } = await admin.rpc('cancel_booking_for', { p_client: b.client_id, p_booking_id: b.id })
    if (error && error.message !== 'not_active') return { ok: false, messaggio: 'Non è stato possibile liberare il posto. Riprova.' }
    if (risposta === 'non_vengo')
      await admin.from('bookings').update({ response: 'non_vengo', responded_at: ora }).eq('id', b.id)
  }

  if (risposta === 'prendo') {
    if (b.status !== 'waitlist') return { ok: false, messaggio: 'Non sei più in lista per questa lezione.' }
    const { data: nuova, error } = await admin.rpc('book_lesson_for', {
      p_client: b.client_id,
      p_schedule_id: b.schedule_id,
    })
    if (error) return { ok: false, messaggio: ERRORI[error.message] ?? 'Non è stato possibile prenotare. Riprova.' }
    // la riga della lista non c'e' piu': la pagina passa alla prenotazione nuova
    const { data: n } = await admin.from('bookings').select('action_token').eq('id', nuova as string).single()
    revalidatePath('/dashboard')
    return { ok: true, token: n?.action_token }
  }

  revalidatePath(`/presenza/${token}`)
  revalidatePath('/dashboard')
  return { ok: true }
}
