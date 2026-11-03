import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type Contatto = {
  id: string
  nome: string | null
  email: string | null
  telefono: string | null
  etichette: string[]
  consenso_novita: boolean
  consenso_at: string | null
  origine: string | null
  created_at: string
  contatti_eventi: { tipo: string; descrizione: string; created_at: string }[]
}

/** I contatti dello studio, con lo storico, filtrati per etichetta, consenso e ricerca. */
export async function elencoContatti(studioId: string, f: { etichetta?: string; consenso?: boolean; q?: string }): Promise<Contatto[]> {
  let q = createAdminClient()
    .from('contatti')
    .select('id, nome, email, telefono, etichette, consenso_novita, consenso_at, origine, created_at, contatti_eventi(tipo, descrizione, created_at)')
    .eq('studio_id', studioId)
    .order('updated_at', { ascending: false })
    .limit(1000)
  if (f.etichetta) q = q.contains('etichette', [f.etichetta])
  if (f.consenso) q = q.eq('consenso_novita', true)
  if (f.q) {
    const s = f.q.replace(/[%,()]/g, ' ').trim()
    if (s) q = q.or(`nome.ilike.%${s}%,email.ilike.%${s}%,telefono.ilike.%${s}%`)
  }
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as Contatto[]).map((c) => ({
    ...c,
    contatti_eventi: [...c.contatti_eventi].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }))
}
