'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type EsitoPostoFisso = {
  error?: string
  held?: number
  full?: string[]
  until?: string | null
  freed?: number
}

const ERRORI: Record<string, string> = {
  not_admin: 'Solo lo studio può gestire i posti fissi.',
  client_not_found: 'Cliente non trovata.',
  class_not_found: 'Lezione non trovata.',
  slot_not_found: 'Posto fisso non trovato.',
}

// Le regole stanno nel database (fixed_slot_add / fixed_slot_remove): qui si
// passa solo la scelta, con la sessione di chi e' collegato.
export async function aggiungiPostoFisso(
  clientId: string,
  classId: string,
  weekday: number,
  time: string
): Promise<EsitoPostoFisso> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fixed_slot_add', {
    p_client: clientId,
    p_class: classId,
    p_weekday: weekday,
    p_time: time,
  })
  if (error) return { error: ERRORI[error.message] ?? 'Non è stato possibile salvare. Riprova.' }
  revalidatePath(`/admin/clienti/${clientId}`)
  const r = data as { held: number; full: string[]; until: string | null }
  return { held: r.held, full: r.full ?? [], until: r.until }
}

export async function togliPostoFisso(clientId: string, slotId: string): Promise<EsitoPostoFisso> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fixed_slot_remove', { p_slot_id: slotId })
  if (error) return { error: ERRORI[error.message] ?? 'Non è stato possibile togliere il posto. Riprova.' }
  revalidatePath(`/admin/clienti/${clientId}`)
  return { freed: (data as { freed: number }).freed }
}
