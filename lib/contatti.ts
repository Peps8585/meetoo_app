import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Contatti dello studio con etichette (gift card per primi). Una persona si
 * riconosce dall'email, o dal telefono se l'email non c'e': se esiste gia' le
 * si aggiunge l'etichetta e una riga di storico, senza doppioni.
 * Il consenso alle novita' si accende e basta: non lo spegne un acquisto
 * successivo senza spunta (a ritirarlo e' la persona, a mano).
 */

export const ETICHETTE = {
  giftRegalato: 'Gift card · ha regalato',
  giftRicevuto: 'Gift card · ha ricevuto',
} as const

/** "333 123 4567" e "+39 333-1234567" diventano lo stesso numero */
export function normalizzaTelefono(t: string | null | undefined): string | null {
  if (!t) return null
  let n = t.replace(/[^\d+]/g, '')
  if (n.startsWith('00')) n = '+' + n.slice(2)
  if (/^3\d{8,9}$/.test(n)) n = '+39' + n
  return n.length >= 6 ? n : null
}

export async function registraContatto(p: {
  studioId: string
  nome: string | null
  email: string | null
  telefono: string | null
  etichetta: string
  consenso: boolean
  origine: string
  evento: { tipo: string; descrizione: string; giftCardId?: string }
}): Promise<void> {
  const db = createAdminClient()
  const email = p.email?.trim().toLowerCase() || null
  const telefono = normalizzaTelefono(p.telefono)
  if (!email && !telefono) return

  const trova = async () => {
    let q = db.from('contatti').select('id, nome, telefono, etichette, consenso_novita').eq('studio_id', p.studioId)
    q = email ? q.ilike('email', email) : q.is('email', null).eq('telefono', telefono!)
    const { data } = await q.limit(1).maybeSingle()
    return data
  }

  let c = await trova()
  if (!c) {
    const { data, error } = await db
      .from('contatti')
      .insert({
        studio_id: p.studioId,
        nome: p.nome?.trim() || null,
        email,
        telefono,
        etichette: [p.etichetta],
        consenso_novita: p.consenso,
        consenso_at: p.consenso ? new Date().toISOString() : null,
        origine: p.origine,
      })
      .select('id, nome, telefono, etichette, consenso_novita')
      .single()
    // due inserimenti insieme: vince il primo, il secondo aggiorna quello
    c = data ?? (error?.code === '23505' ? await trova() : null)
    if (!c) {
      console.error('[contatti] inserimento fallito:', error?.message)
      return
    }
  }

  const aggiorna: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (!c.etichette.includes(p.etichetta)) aggiorna.etichette = [...c.etichette, p.etichetta]
  if (!c.nome && p.nome?.trim()) aggiorna.nome = p.nome.trim()
  if (!c.telefono && telefono) aggiorna.telefono = telefono
  if (p.consenso && !c.consenso_novita) {
    aggiorna.consenso_novita = true
    aggiorna.consenso_at = new Date().toISOString()
  }
  await db.from('contatti').update(aggiorna).eq('id', c.id)
  await db.from('contatti_eventi').insert({
    contatto_id: c.id,
    tipo: p.evento.tipo,
    descrizione: p.evento.descrizione,
    gift_card_id: p.evento.giftCardId ?? null,
  })
}
