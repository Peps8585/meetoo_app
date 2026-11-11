'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { avvisiLista } from '@/lib/posti-fissi/giro'

export type Risposta = 'ci_sono' | 'non_vengo' | 'prendo' | 'lascia' | 'esci'

const ERRORI: Record<string, string> = {
  full: 'Il posto l’ha appena preso un’altra persona. Resti in lista: se se ne libera un altro ti avvisiamo.',
  no_credits: 'Il tuo pacchetto non basta per questa lezione. Puoi rinnovarlo in studio.',
  booking_closed: 'Le iscrizioni a questa lezione sono chiuse.',
  schedule_cancelled: 'Questa lezione è stata annullata.',
  schedule_past: 'Questa lezione è già passata.',
  already_booked: 'Sei già dentro a questa lezione.',
  booking_locked: 'Lo studio ha chiuso le iscrizioni a questa lezione.',
  not_offered: 'Il posto non è ancora libero: resti in lista e ti avvisiamo quando tocca a te.',
  offer_expired: 'Il tempo per rispondere è scaduto e il posto è passato alla prossima in lista.',
  not_waitlist: 'Non sei più in lista per questa lezione.',
}

// Dopo un no o un'uscita dalla lista il posto passa subito alla prossima:
// l'avviso parte adesso, senza aspettare il giro dei 10 minuti.
async function avvisaLaProssima(admin: ReturnType<typeof createAdminClient>) {
  try {
    await avvisiLista(admin)
  } catch (e) {
    console.error('avvisi lista', e)
  }
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

  if (risposta === 'prendo' || risposta === 'lascia') {
    if (b.status !== 'waitlist') return { ok: false, messaggio: ERRORI.not_waitlist }
    const { data, error } = await admin.rpc('lista_rispondi', {
      p_booking_id: b.id,
      p_prende: risposta === 'prendo',
    })
    if (error) return { ok: false, messaggio: ERRORI[error.message] ?? 'Non è stato possibile rispondere. Riprova.' }
    const esito = data as { preso: boolean; booking_id?: string; motivo?: string }
    if (!esito.preso) await avvisaLaProssima(admin)
    revalidatePath('/dashboard')
    if (esito.preso && esito.booking_id) {
      // la riga della lista non c'e' piu': la pagina passa alla prenotazione nuova
      const { data: n } = await admin.from('bookings').select('action_token').eq('id', esito.booking_id).single()
      return { ok: true, token: n?.action_token }
    }
    if (esito.motivo === 'no_credits')
      return {
        ok: false,
        messaggio: 'Il tuo pacchetto non basta per questa lezione, quindi il posto è passato alla prossima in lista. Puoi rinnovarlo in studio.',
      }
  }

  if (risposta === 'esci' || risposta === 'non_vengo') await avvisaLaProssima(admin)

  revalidatePath(`/presenza/${token}`)
  revalidatePath('/dashboard')
  return { ok: true }
}
