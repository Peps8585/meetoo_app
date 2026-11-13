import type { SupabaseClient } from '@supabase/supabase-js'

// Bacheca degli eventi dello studio (S35). Un evento resta in bacheca finche'
// non e' finito: fino all'ora di fine, o per due ore dall'inizio se la fine
// non e' indicata. Poi sparisce da solo, senza che nessuno lo tolga.

export type Evento = {
  id: string
  studio_id: string
  titolo: string
  descrizione: string
  inizio: string
  fine: string | null
  foto: string | null
  pubblicato: boolean
  avviso_at: string | null
  avviso_esito: EsitoAvviso | null
}

export type EsitoAvviso = { notifica: number; email: number; whatsapp: number; nessuno: number }

export const CAMPI_EVENTO = 'id, studio_id, titolo, descrizione, inizio, fine, foto, pubblicato, avviso_at, avviso_esito'

// numero WhatsApp dello studio (dal 07/09/2026)
export const WHATSAPP_STUDIO = '393892952958'

// indirizzo dello studio: lo stesso del sito (meetoo-sito/lib/contatti.ts)
export const INDIRIZZO_STUDIO = 'Mee Too Pilates, Piazza Generale Carlo Alberto Dalla Chiesa 12, Pieve di Curtarolo (PD)'

export const APP_URL = process.env.APP_URL ?? 'https://meetoo-app-ntls.vercel.app'

const DUE_ORE = 2 * 60 * 60 * 1000

export function eventoPassato(e: Pick<Evento, 'inizio' | 'fine'>, adesso = Date.now()): boolean {
  return (e.fine ? new Date(e.fine).getTime() : new Date(e.inizio).getTime() + DUE_ORE) < adesso
}

/** Gli eventi pubblicati non ancora finiti, dal piu' vicino. */
export async function eventiInArrivo(supabase: SupabaseClient, studioId?: string, limite = 20): Promise<Evento[]> {
  const ora = new Date()
  const dueOreFa = new Date(ora.getTime() - DUE_ORE).toISOString()
  let q = supabase
    .from('eventi')
    .select(CAMPI_EVENTO)
    .eq('pubblicato', true)
    .or(`fine.gte.${ora.toISOString()},and(fine.is.null,inizio.gte.${dueOreFa})`)
    .order('inizio')
    .limit(limite)
  if (studioId) q = q.eq('studio_id', studioId)
  const { data } = await q
  return (data ?? []) as Evento[]
}

/** Indirizzo pubblico della foto (lo spazio 'eventi' e' pubblico). */
export function fotoEvento(percorso: string | null): string | null {
  if (!percorso) return null
  if (/^https?:\/\//.test(percorso)) return percorso
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/eventi/${percorso}`
}

export const linkEvento = (id: string) => `${APP_URL}/evento/${id}`

const ROMA = 'Europe/Rome'
const ora = (iso: string) =>
  new Date(iso).toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit', timeZone: ROMA }).replace(':', '.')

/** "venerdì 27 novembre" */
export function giornoEvento(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ROMA })
}

/** "18.30 – 20.00", oppure solo "20.00" se la fine non c'e'. */
export function oreEvento(e: Pick<Evento, 'inizio' | 'fine'>): string {
  return e.fine ? `${ora(e.inizio)} – ${ora(e.fine)}` : ora(e.inizio)
}

/** "venerdì 27 novembre, dalle 18.30 alle 20.00" (per avvisi e pagina pubblica) */
export function quandoEvento(e: Pick<Evento, 'inizio' | 'fine'>): string {
  return e.fine
    ? `${giornoEvento(e.inizio)}, dalle ${ora(e.inizio)} alle ${ora(e.fine)}`
    : `${giornoEvento(e.inizio)} alle ${ora(e.inizio)}`
}

/** Messaggio gia' scritto per chi tocca «Scrivici su WhatsApp». */
export function whatsappEvento(e: Pick<Evento, 'titolo' | 'inizio'>): string {
  const testo = `Ciao! Vorrei avere informazioni su «${e.titolo}» di ${giornoEvento(e.inizio)}.`
  return `https://wa.me/${WHATSAPP_STUDIO}?text=${encodeURIComponent(testo)}`
}

/** Giorno e ore in ora italiana -> istante. "2026-11-27", "18:30" -> ISO. */
export function daRoma(giorno: string, oraMin: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno) || !/^\d{1,2}:\d{2}$/.test(oraMin)) return null
  const prova = new Date(`${giorno}T${oraMin.padStart(5, '0')}:00Z`)
  if (Number.isNaN(prova.getTime())) return null
  const romaComeUtc = new Date(prova.toLocaleString('en-US', { timeZone: ROMA }) + ' UTC')
  return new Date(prova.getTime() - (romaComeUtc.getTime() - prova.getTime())).toISOString()
}

/** Istante -> giorno e ora italiani per i campi del modulo. */
export function aRoma(iso: string): { giorno: string; ora: string } {
  const parti = new Intl.DateTimeFormat('en-CA', {
    timeZone: ROMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const g = (t: string) => parti.find((p) => p.type === t)?.value ?? ''
  return { giorno: `${g('year')}-${g('month')}-${g('day')}`, ora: `${g('hour')}:${g('minute')}` }
}
