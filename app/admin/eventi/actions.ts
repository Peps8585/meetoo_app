'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminStaff } from '@/lib/gift/staff'
import { daRoma } from '@/lib/eventi'
import { avvisaEvento, riassuntoAvviso } from '@/lib/eventi-avviso'

// Bacheca eventi, lato studio. Le regole su chi puo' scrivere stanno nel
// database (solo admin dello studio): qui si controllano i campi e, se Giorgia
// lo sceglie, si fa partire l'avviso a tutte.

export type Esito = { ok: boolean; messaggio?: string; id?: string }

export type DatiEvento = {
  id?: string
  titolo: string
  descrizione: string
  giorno: string // 2026-11-27, ora italiana
  inizio: string // 18:30
  fine: string // 20:00 oppure ''
  foto: string | null
  pubblicato: boolean
  avvisa: boolean
}

function aggiorna(id?: string) {
  revalidatePath('/admin/eventi')
  revalidatePath('/eventi')
  revalidatePath('/dashboard')
  if (id) revalidatePath(`/evento/${id}`)
}

export async function salvaEvento(v: DatiEvento): Promise<Esito> {
  const staff = await getAdminStaff()
  if (!staff) return { ok: false, messaggio: 'Solo lo studio può farlo.' }

  const titolo = v.titolo.trim()
  if (!titolo) return { ok: false, messaggio: 'Manca il titolo.' }
  if (titolo.length > 120) return { ok: false, messaggio: 'Il titolo è troppo lungo.' }
  if (v.descrizione.length > 2000) return { ok: false, messaggio: 'La descrizione è troppo lunga.' }
  const inizio = daRoma(v.giorno, v.inizio)
  if (!inizio) return { ok: false, messaggio: 'Indica il giorno e l’ora di inizio.' }
  const fine = v.fine ? daRoma(v.giorno, v.fine) : null
  if (v.fine && (!fine || fine <= inizio)) return { ok: false, messaggio: 'L’ora di fine deve venire dopo quella di inizio.' }
  if (v.foto && !v.foto.startsWith(`${staff.studioId}/`)) return { ok: false, messaggio: 'La foto non è valida.' }

  const supabase = await createClient()
  const riga = {
    titolo,
    descrizione: v.descrizione.trim(),
    inizio,
    fine,
    foto: v.foto,
    pubblicato: v.pubblicato,
    updated_at: new Date().toISOString(),
  }

  let id = v.id
  if (id) {
    const { data: prima } = await supabase.from('eventi').select('foto').eq('id', id).maybeSingle()
    const { error } = await supabase.from('eventi').update(riga).eq('id', id)
    if (error) return { ok: false, messaggio: 'Non è stato possibile salvare. Riprova.' }
    if (prima?.foto && prima.foto !== v.foto) await supabase.storage.from('eventi').remove([prima.foto])
  } else {
    const { data, error } = await supabase
      .from('eventi')
      .insert({ ...riga, studio_id: staff.studioId, created_by: staff.id })
      .select('id')
      .single()
    if (error || !data) return { ok: false, messaggio: 'Non è stato possibile salvare. Riprova.' }
    id = data.id as string
  }

  let messaggio = v.pubblicato ? 'Evento pubblicato in bacheca.' : 'Bozza salvata: le clienti non la vedono.'
  if (v.avvisa && v.pubblicato) {
    const esito = await avvisaEvento(createAdminClient(), id!)
    if (esito) messaggio = `Evento pubblicato e avviso partito. ${riassuntoAvviso(esito)}`
  }
  aggiorna(id)
  return { ok: true, id, messaggio }
}

/** Avviso a tutte per un evento gia' in bacheca. Parte una volta sola. */
export async function mandaAvviso(id: string): Promise<Esito> {
  const staff = await getAdminStaff()
  if (!staff) return { ok: false, messaggio: 'Solo lo studio può farlo.' }
  const supabase = await createClient()
  // la lettura passa dalle regole: l'evento deve essere del suo studio
  const { data: e } = await supabase.from('eventi').select('id, pubblicato, avviso_at').eq('id', id).maybeSingle()
  if (!e) return { ok: false, messaggio: 'Evento non trovato.' }
  if (!e.pubblicato) return { ok: false, messaggio: 'Prima pubblica l’evento in bacheca.' }
  if (e.avviso_at) return { ok: false, messaggio: 'L’avviso per questo evento è già partito.' }
  const esito = await avvisaEvento(createAdminClient(), id)
  aggiorna(id)
  if (!esito) return { ok: false, messaggio: 'L’avviso per questo evento è già partito.' }
  return { ok: true, messaggio: `Avviso partito. ${riassuntoAvviso(esito)}` }
}

export async function eliminaEvento(id: string): Promise<Esito> {
  const staff = await getAdminStaff()
  if (!staff) return { ok: false, messaggio: 'Solo lo studio può farlo.' }
  const supabase = await createClient()
  const { data: e } = await supabase.from('eventi').select('foto').eq('id', id).maybeSingle()
  const { error } = await supabase.from('eventi').delete().eq('id', id)
  if (error) return { ok: false, messaggio: 'Non è stato possibile cancellare. Riprova.' }
  if (e?.foto) await supabase.storage.from('eventi').remove([e.foto])
  aggiorna(id)
  return { ok: true }
}
