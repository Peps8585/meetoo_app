import type { SupabaseClient } from '@supabase/supabase-js'

// Certificato medico (26/11/2026): spazio privato 'certificati', profiles.certificato_path tiene il
// percorso. Si apre con un link firmato e a tempo: lo possono creare solo la cliente e le admin.

export async function linkCertificato(supabase: SupabaseClient, percorso: string | null): Promise<string | null> {
  if (!percorso) return null
  const { data } = await supabase.storage.from('certificati').createSignedUrl(percorso, 60 * 30)
  return data?.signedUrl ?? null
}

export type StatoCertificato = 'mancante' | 'valido' | 'in_scadenza' | 'scaduto'

/** In scadenza: entro 30 giorni. */
export function statoCertificato(percorso: string | null, scadenza: string | null): StatoCertificato {
  if (!percorso) return 'mancante'
  if (!scadenza) return 'valido'
  const oggi = new Date(new Date().toDateString()).getTime()
  const fine = new Date(scadenza + 'T00:00:00').getTime()
  if (fine < oggi) return 'scaduto'
  if (fine - oggi <= 30 * 24 * 3600 * 1000) return 'in_scadenza'
  return 'valido'
}

export function dataLunga(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}
