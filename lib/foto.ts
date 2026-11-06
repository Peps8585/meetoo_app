import type { SupabaseClient } from '@supabase/supabase-js'

// Foto profilo: nello spazio privato 'avatars', profiles.avatar_url tiene il
// percorso del file. Si apre solo con un link firmato e a tempo, che chi
// guarda (la cliente, lo studio) puo' creare grazie alle regole dello spazio.

const UN_ORA = 60 * 60

/** Link da usare in <img> per un elenco di foto: percorso -> indirizzo. */
export async function linkFoto(
  supabase: SupabaseClient,
  percorsi: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const daFirmare: string[] = []
  for (const p of percorsi) {
    if (!p) continue
    if (/^https?:\/\//.test(p)) out.set(p, p) // foto vecchie con indirizzo pieno
    else daFirmare.push(p)
  }
  if (daFirmare.length === 0) return out
  const { data } = await supabase.storage.from('avatars').createSignedUrls([...new Set(daFirmare)], UN_ORA)
  for (const r of data ?? []) if (r.path && r.signedUrl) out.set(r.path, r.signedUrl)
  return out
}

export function iniziali(first: string | null | undefined, last: string | null | undefined): string {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '·'
}
