'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminStaff } from '@/lib/gift/staff'
import { avvisaClienti, riassuntoMessaggio } from '@/lib/messaggi'

// Messaggi dello studio. Chi puo' scrivere e a chi lo decide il database
// (studio_invia_messaggio: solo admin, solo clienti del suo studio); qui dopo
// l'invio partono notifica o email, e il WhatsApp se e' stato scelto.

export type Esito = { ok: boolean; messaggio?: string }

const ERRORI: Record<string, string> = {
  not_admin: 'Solo lo studio può farlo.',
  testo_vuoto: 'Scrivi il messaggio prima di inviare.',
  testo_lungo: 'Il messaggio è troppo lungo.',
  schedule_not_found: 'Scegli la lezione.',
  client_not_found: 'Scegli la cliente.',
}

export async function inviaMessaggio(v: {
  testo: string
  destinatari: 'tutte' | 'lezione' | 'cliente'
  scheduleId?: string | null
  clientId?: string | null
  whatsapp?: boolean
}): Promise<Esito> {
  const staff = await getAdminStaff()
  if (!staff) return { ok: false, messaggio: ERRORI.not_admin }
  const supabase = await createClient()
  // una lezione senza iscritte non ha nessuno da avvisare: meglio dirlo prima di scrivere
  if (v.destinatari === 'lezione' && v.scheduleId) {
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('schedule_id', v.scheduleId)
      .in('status', ['confirmed', 'held'])
    if (!count) return { ok: false, messaggio: 'Questa lezione non ha iscritte: il messaggio non è partito.' }
  }
  const { data, error } = await supabase.rpc('studio_invia_messaggio', {
    p_testo: v.testo,
    p_destinatari: v.destinatari,
    p_schedule_id: v.destinatari === 'lezione' ? (v.scheduleId ?? null) : null,
    p_client: v.destinatari === 'cliente' ? (v.clientId ?? null) : null,
  })
  if (error) return { ok: false, messaggio: ERRORI[error.message] ?? 'Il messaggio non è partito. Riprova.' }

  const clienti = ((data ?? []) as { o_client: string }[]).map((r) => r.o_client)
  const esito = await avvisaClienti(createAdminClient(), {
    studioId: staff.studioId,
    clienti,
    testo: v.testo.trim(),
    whatsapp: v.whatsapp && v.destinatari === 'lezione' && v.scheduleId ? { scheduleId: v.scheduleId } : undefined,
  })
  revalidatePath('/admin/messaggi')
  revalidatePath('/messaggi')
  revalidatePath('/dashboard')
  return { ok: clienti.length > 0, messaggio: riassuntoMessaggio(esito) }
}

/** Dal filo di una cliente: lo studio le risponde. */
export async function scriviACliente(clientId: string, testo: string): Promise<Esito> {
  const r = await inviaMessaggio({ testo, destinatari: 'cliente', clientId })
  if (r.ok) revalidatePath(`/admin/messaggi/${clientId}`)
  return r.ok ? { ok: true } : r
}
