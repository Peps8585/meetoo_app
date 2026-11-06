'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { avvisa } from '@/lib/posti-fissi/giro'
import { testoAnnullata, testoSpostata, testoTolta } from '@/lib/posti-fissi/testi'
import { romeSlot } from '@/lib/posti-fissi/slot'

// Azioni dello studio sulla lezione. Le regole (chi puo', quanto si scala o si
// restituisce) stanno nel database: qui si passa la scelta con la sessione di
// chi e' collegato, e dopo si avvisano le clienti toccate.

export type Esito = { ok: boolean; messaggio?: string; id?: string }

const ERRORI: Record<string, string> = {
  not_admin: 'Solo lo studio può farlo.',
  not_allowed: 'Puoi segnare le presenze solo delle tue lezioni.',
  no_credits: 'Il suo pacchetto non basta per questa lezione.',
  full: 'La lezione è piena: aumenta i posti da "Modifica" per aggiungerla.',
  already_booked: 'È già iscritta a questa lezione.',
  schedule_past: 'La lezione è già iniziata.',
  schedule_cancelled: 'La lezione è annullata.',
  posti_sotto_iscritte: 'Ci sono più iscritte dei posti che vuoi mettere.',
  orario_non_valido: 'L’ora di fine deve venire dopo quella di inizio.',
  has_bookings: 'Ci sono iscritte: usa "Annulla lezione".',
  has_payments: 'Su questa lezione ci sono stati pagamenti: si può annullare, non cancellare.',
  client_not_found: 'Cliente non trovata.',
}

const errore = (msg: string) => ({ ok: false, messaggio: ERRORI[msg] ?? 'Non è andata a buon fine. Riprova.' })

async function lezione(scheduleId: string) {
  const { data } = await createAdminClient()
    .from('schedules')
    .select('starts_at, classes:class_id(name)')
    .eq('id', scheduleId)
    .single()
  const d = data as unknown as { starts_at: string; classes: { name: string } | null } | null
  return { inizio: d?.starts_at ?? '', nome: d?.classes?.name ?? 'Lezione' }
}

const aggiorna = (scheduleId: string) => {
  revalidatePath(`/agenda/lezione/${scheduleId}`)
  revalidatePath('/agenda')
}

export async function aggiungiCliente(scheduleId: string, clientId: string): Promise<Esito> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('studio_aggiungi_cliente', { p_schedule_id: scheduleId, p_client: clientId })
  if (error) return errore(error.message)
  aggiorna(scheduleId)
  return { ok: true, id: data as string }
}

export async function togliPrenotazione(scheduleId: string, bookingId: string, clientId: string): Promise<Esito> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('studio_togli_prenotazione', { p_booking_id: bookingId })
  if (error) return errore(error.message)
  // si avvisa solo chi aveva una prenotazione vera (non la lista d'attesa)
  if ((data as { refunded?: boolean })?.refunded) {
    const l = await lezione(scheduleId)
    await avvisa(createAdminClient(), clientId, testoTolta(l.nome, l.inizio), `${process.env.APP_URL ?? ''}/dashboard`)
  }
  aggiorna(scheduleId)
  return { ok: true }
}

export async function annullaLezione(scheduleId: string): Promise<Esito> {
  const supabase = await createClient()
  const l = await lezione(scheduleId)
  const { data, error } = await supabase.rpc('studio_annulla_lezione', { p_schedule_id: scheduleId })
  if (error) return errore(error.message)
  const righe = (data ?? []) as { client_id: string; era: string; rimborsata: boolean }[]
  const admin = createAdminClient()
  for (const r of righe)
    await avvisa(admin, r.client_id, testoAnnullata(l.nome, l.inizio, r.rimborsata), `${process.env.APP_URL ?? ''}/dashboard`)
  aggiorna(scheduleId)
  return { ok: true, messaggio: `Lezione annullata. ${righe.length === 1 ? 'Avvisata 1 persona' : `Avvisate ${righe.length} persone`}.` }
}

export async function eliminaLezione(scheduleId: string): Promise<Esito> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('studio_elimina_lezione', { p_schedule_id: scheduleId })
  if (error) return errore(error.message)
  revalidatePath('/agenda')
  return { ok: true }
}

export async function modificaLezione(
  scheduleId: string,
  v: { inizio: string; fine: string; insegnante: string | null; posti: number; note: string }
): Promise<Esito> {
  const supabase = await createClient()
  const prima = await lezione(scheduleId)
  const { data, error } = await supabase.rpc('studio_modifica_lezione', {
    p_schedule_id: scheduleId,
    p_starts_at: v.inizio,
    p_ends_at: v.fine,
    p_instructor: v.insegnante,
    p_max_spots: v.posti,
    p_notes: v.note,
  })
  if (error) return errore(error.message)
  // ora cambiata: avviso a chi e' iscritta
  if ((data as { ora_cambiata?: boolean })?.ora_cambiata) {
    const admin = createAdminClient()
    const { data: iscritte } = await admin
      .from('bookings')
      .select('client_id')
      .eq('schedule_id', scheduleId)
      .in('status', ['confirmed', 'held'])
    for (const r of iscritte ?? [])
      await avvisa(admin, r.client_id, testoSpostata(prima.nome, prima.inizio, v.inizio), `${process.env.APP_URL ?? ''}/dashboard`)
  }
  aggiorna(scheduleId)
  return { ok: true }
}

export async function duplicaLezione(scheduleId: string, inizio: string): Promise<Esito> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('studio_duplica_lezione', { p_schedule_id: scheduleId, p_starts_at: inizio })
  if (error) return errore(error.message)
  revalidatePath('/agenda')
  return { ok: true, id: data as string }
}

export async function bloccaIscrizioni(scheduleId: string, bloccate: boolean): Promise<Esito> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('studio_blocca_iscrizioni', { p_schedule_id: scheduleId, p_bloccate: bloccate })
  if (error) return errore(error.message)
  aggiorna(scheduleId)
  return { ok: true }
}

export async function segnaPresenza(scheduleId: string, bookingId: string, presenza: 'presente' | 'assente' | null): Promise<Esito> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('segna_presenza', { p_booking_id: bookingId, p_presenza: presenza })
  if (error) return errore(error.message)
  aggiorna(scheduleId)
  return { ok: true }
}

export async function rendiFissa(scheduleId: string, clientId: string): Promise<Esito> {
  const supabase = await createClient()
  const { data: s } = await supabase.from('schedules').select('starts_at, class_id').eq('id', scheduleId).single()
  if (!s) return errore('schedule_not_found')
  const { weekday, time } = romeSlot(s.starts_at)
  const { data, error } = await supabase.rpc('fixed_slot_add', {
    p_client: clientId,
    p_class: s.class_id,
    p_weekday: weekday,
    p_time: time,
  })
  if (error) return errore(error.message)
  aggiorna(scheduleId)
  const r = data as { held: number }
  return { ok: true, messaggio: `Posto fisso salvato: tenuto su ${r.held} ${r.held === 1 ? 'lezione' : 'lezioni'}.` }
}
