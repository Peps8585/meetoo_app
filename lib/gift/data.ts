import 'server-only'
import { randomInt } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export type GiftStudio = { id: string; name: string; slug: string; validMonths: number }

export type GiftProduct = {
  id: string
  discipline: string
  discipline_slug: string
  title: string
  description: string | null
  lessons: number
  price: number
  includes_stamp_duty: boolean
  savings_note: string | null
  detail_image: string | null
}

export type GiftCover = { id: string; image_url: string; label: string | null; discipline_slug: string | null }

export type GiftCard = {
  id: string
  studio_id: string
  code: string
  discipline: string
  discipline_slug: string
  product_title: string
  lessons: number
  price: number
  includes_stamp_duty: boolean
  cover_url: string
  occasion: string | null
  from_name: string
  to_name: string
  message: string | null
  delivery: 'email' | 'self'
  recipient_email: string | null
  send_at: string | null
  buyer_email: string
  status: 'pending' | 'paid' | 'delivered' | 'redeemed' | 'void'
  valid_months: number
  valid_until: string | null
  paid_at: string | null
  delivered_at: string | null
  redeemed_at: string | null
  holder_name: string | null
  holder_phone: string | null
  studio_note: string | null
  activated_by: string | null
  receipt_done_at: string | null
}

/**
 * Lo studio di cui si vendono i regali. Oggi l'app serve solo Mee Too, quindi
 * lo slug arriva dall'ambiente; quando ci saranno altri studi si passera' dallo
 * slug nell'indirizzo, senza cambiare il resto.
 */
export async function getGiftStudio(slug = process.env.GIFT_STUDIO_SLUG ?? 'meetoo'): Promise<GiftStudio | null> {
  const db = createAdminClient()
  const { data } = await db.from('studios').select('id, name, slug, settings').eq('slug', slug).maybeSingle()
  if (!data) return null
  const settings = (data.settings ?? {}) as { gift_valid_months?: number }
  return { id: data.id, name: data.name, slug: data.slug, validMonths: settings.gift_valid_months ?? 6 }
}

export async function getGiftCatalog(studioId: string) {
  const db = createAdminClient()
  const [products, covers] = await Promise.all([
    db
      .from('gift_products')
      .select('id, discipline, discipline_slug, title, description, lessons, price, includes_stamp_duty, savings_note, detail_image')
      .eq('studio_id', studioId)
      .eq('is_active', true)
      .order('sort'),
    db.from('gift_covers').select('id, image_url, label, discipline_slug').eq('studio_id', studioId).eq('is_active', true).order('sort'),
  ])
  if (products.error) throw products.error
  if (covers.error) throw covers.error
  return {
    // numeric arriva come stringa da PostgREST
    products: (products.data ?? []).map((p) => ({ ...p, price: Number(p.price) })) as GiftProduct[],
    covers: (covers.data ?? []) as GiftCover[],
  }
}

const GIFT_COLUMNS =
  'id, studio_id, code, discipline, discipline_slug, product_title, lessons, price, includes_stamp_duty, cover_url, occasion, from_name, to_name, message, delivery, recipient_email, send_at, buyer_email, status, valid_months, valid_until, paid_at, delivered_at, redeemed_at, holder_name, holder_phone, studio_note, activated_by, receipt_done_at'

export function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2')
}

export async function getGiftCardByCode(code: string): Promise<GiftCard | null> {
  const db = createAdminClient()
  const { data } = await db.from('gift_cards').select(GIFT_COLUMNS).eq('code', normalizeCode(code)).maybeSingle()
  return data ? ({ ...data, price: Number(data.price) } as GiftCard) : null
}

export async function getGiftCardBySession(sessionId: string): Promise<GiftCard | null> {
  const db = createAdminClient()
  const { data } = await db.from('gift_cards').select(GIFT_COLUMNS).eq('stripe_session_id', sessionId).maybeSingle()
  return data ? ({ ...data, price: Number(data.price) } as GiftCard) : null
}

export async function getStudioName(studioId: string): Promise<string> {
  return (await getStudioContact(studioId)).name
}

/** Nome ed email dello studio: l'email riceve l'avviso a ogni regalo venduto. */
export async function getStudioContact(studioId: string): Promise<{ name: string; email: string | null }> {
  const db = createAdminClient()
  const { data } = await db.from('studios').select('name, email').eq('id', studioId).maybeSingle()
  return { name: data?.name ?? 'lo studio', email: process.env.GIFT_STUDIO_EMAIL ?? data?.email ?? null }
}

/**
 * Codice del regalo: 8 caratteri in due gruppi (es. K7QM-2HXA), senza le
 * lettere e cifre che si confondono a voce o stampate (0/O, 1/I/L).
 * 31^8 combinazioni: non si indovina.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function newGiftCode() {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALFABETO[randomInt(ALFABETO.length)]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}
