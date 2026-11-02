import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/** Un regalo come lo vedono le pagine dello studio (elenchi e conti). */
export type RigaRegalo = {
  code: string
  status: string
  discipline: string
  discipline_slug: string
  product_title: string
  lessons: number
  price: number
  from_name: string
  to_name: string
  holder_name: string | null
  studio_note: string | null
  send_at: string | null
  valid_until: string | null
  paid_at: string | null
  redeemed_at: string | null
  receipt_done_at: string | null
}

export type Mese = { chiave: string; etichetta: string; euro: number; vendute: number }

export type ReportRegali = {
  regali: RigaRegalo[]
  daAttivare: RigaRegalo[]
  attivati: RigaRegalo[]
  scaduti: RigaRegalo[]
  annullati: RigaRegalo[]
  /** pagati e non annullati: e' quello che conta come venduto */
  validi: RigaRegalo[]
  incassoTotale: number
  incassoMese: number
  venduteMese: number
  ricevuteDaFare: number
  /** ultimi 12 mesi, dal piu' vecchio al corrente, anche quelli a zero */
  mesi: Mese[]
  /** cosa si regala: disciplina + taglio, dal piu' venduto */
  piuRegalati: { nome: string; vendute: number; euro: number }[]
}

const ROMA = 'Europe/Rome'
const meseDi = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: ROMA, year: 'numeric', month: '2-digit' }).format(new Date(iso))

export const scaduto = (r: RigaRegalo, ora: number) => !!r.valid_until && new Date(r.valid_until).getTime() < ora

export async function loadGiftReport(studioId: string, ora: number): Promise<ReportRegali> {
  const { data } = await createAdminClient()
    .from('gift_cards')
    .select(
      'code, status, discipline, discipline_slug, product_title, lessons, price, from_name, to_name, holder_name, studio_note, send_at, valid_until, paid_at, redeemed_at, receipt_done_at',
    )
    .eq('studio_id', studioId)
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
  const regali = (data ?? []).map((r) => ({ ...r, price: Number(r.price) })) as RigaRegalo[]

  const validi = regali.filter((r) => r.status !== 'void')
  const daAttivare = regali
    .filter((r) => (r.status === 'paid' || r.status === 'delivered') && !scaduto(r, ora))
    .sort((a, b) => (a.valid_until ?? '9').localeCompare(b.valid_until ?? '9'))
  const meseCorrente = meseDi(new Date(ora).toISOString())
  const delMese = validi.filter((r) => r.paid_at && meseDi(r.paid_at) === meseCorrente)

  // ultimi 12 mesi, anche vuoti: un mese senza vendite e' un dato, non un buco
  const mesi: Mese[] = []
  const d = new Date(ora)
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 15))
    const chiave = meseDi(m.toISOString())
    const etichetta = m.toLocaleDateString('it-IT', { month: 'short', year: '2-digit', timeZone: ROMA })
    const dentro = validi.filter((r) => r.paid_at && meseDi(r.paid_at) === chiave)
    mesi.push({ chiave, etichetta, euro: dentro.reduce((s, r) => s + r.price, 0), vendute: dentro.length })
  }

  const gruppi = new Map<string, { nome: string; vendute: number; euro: number }>()
  for (const r of validi) {
    const nome = `${r.product_title} · ${r.discipline}`
    const g = gruppi.get(nome) ?? { nome, vendute: 0, euro: 0 }
    g.vendute++
    g.euro += r.price
    gruppi.set(nome, g)
  }

  return {
    regali,
    daAttivare,
    attivati: regali.filter((r) => r.status === 'redeemed'),
    scaduti: regali.filter((r) => r.status !== 'redeemed' && r.status !== 'void' && scaduto(r, ora)),
    annullati: regali.filter((r) => r.status === 'void'),
    validi,
    incassoTotale: validi.reduce((s, r) => s + r.price, 0),
    incassoMese: delMese.reduce((s, r) => s + r.price, 0),
    venduteMese: delMese.length,
    ricevuteDaFare: validi.filter((r) => !r.receipt_done_at).length,
    mesi,
    piuRegalati: [...gruppi.values()].sort((a, b) => b.vendute - a.vendute || b.euro - a.euro),
  }
}
