'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { getGiftStudio, newGiftCode } from '@/lib/gift/data'
import { appUrl } from '@/lib/gift/fulfill'
import { OCCASIONI, romeLocalToUtc } from '@/lib/gift/format'

export type GiftOrderInput = {
  productId: string
  coverId: string
  occasion: string
  fromName: string
  toName: string
  message: string
  delivery: 'email' | 'self'
  recipientEmail: string
  /** "2026-12-25", vuoto = subito */
  sendDate: string
  /** "08:00" */
  sendTime: string
  buyerEmail: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Crea il regalo in attesa di pagamento e apre il checkout di Stripe.
 * Il browser manda solo scelte (id del regalo e della copertina, testi):
 * prezzo, disciplina e foto si rileggono qui dal database, mai dal client.
 */
export async function startGiftCheckout(input: GiftOrderInput): Promise<{ url: string } | { error: string }> {
  const studio = await getGiftStudio()
  if (!studio) return { error: 'Studio non trovato.' }

  const fromName = input.fromName.trim().slice(0, 40)
  const toName = input.toName.trim().slice(0, 40)
  const message = input.message.trim().slice(0, 300)
  const buyerEmail = input.buyerEmail.trim().toLowerCase()
  const recipientEmail = input.recipientEmail.trim().toLowerCase()
  const occasion = (OCCASIONI as readonly string[]).includes(input.occasion) ? input.occasion : 'Nessuna'

  if (!fromName || !toName) return { error: 'Scrivi il tuo nome e quello di chi riceve il regalo.' }
  if (!EMAIL.test(buyerEmail)) return { error: 'Controlla la tua email: serve per la ricevuta.' }
  if (input.delivery === 'email' && !EMAIL.test(recipientEmail)) return { error: "Controlla l'email di chi riceve il regalo." }

  let sendAt: Date | null = null
  if (input.delivery === 'email' && input.sendDate) {
    if (process.env.GIFT_SCHEDULING !== 'on') return { error: 'L’invio programmato non è ancora disponibile.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sendDate) || !/^\d{2}:\d{2}$/.test(input.sendTime)) {
      return { error: 'Controlla il giorno e l’ora di consegna.' }
    }
    sendAt = romeLocalToUtc(input.sendDate, input.sendTime)
    const tra = sendAt.getTime() - Date.now()
    if (tra < 0) return { error: 'Il giorno di consegna è già passato.' }
    if (tra > 366 * 24 * 3600 * 1000) return { error: 'Si può programmare al massimo entro un anno.' }
  }

  const db = createAdminClient()
  const [{ data: product }, { data: cover }] = await Promise.all([
    db
      .from('gift_products')
      .select('id, discipline, discipline_slug, title, lessons, price, includes_stamp_duty')
      .eq('id', input.productId)
      .eq('studio_id', studio.id)
      .eq('is_active', true)
      .maybeSingle(),
    db.from('gift_covers').select('image_url').eq('id', input.coverId).eq('studio_id', studio.id).eq('is_active', true).maybeSingle(),
  ])
  if (!product || !cover) return { error: 'Questo regalo non è più disponibile. Ricarica la pagina.' }
  const price = Number(product.price)

  // il codice e' unico: se per caso esiste gia', se ne prende un altro
  let card: { id: string; code: string } | null = null
  for (let i = 0; i < 3 && !card; i++) {
    const { data, error } = await db
      .from('gift_cards')
      .insert({
        studio_id: studio.id,
        code: newGiftCode(),
        product_id: product.id,
        discipline: product.discipline,
        discipline_slug: product.discipline_slug,
        product_title: product.title,
        lessons: product.lessons,
        price,
        includes_stamp_duty: product.includes_stamp_duty,
        cover_url: cover.image_url,
        occasion,
        from_name: fromName,
        to_name: toName,
        message: message || null,
        delivery: input.delivery,
        recipient_email: input.delivery === 'email' ? recipientEmail : null,
        send_at: sendAt?.toISOString() ?? null,
        buyer_email: buyerEmail,
        valid_months: studio.validMonths,
      })
      .select('id, code')
      .single()
    if (data) card = data
    else if (error?.code !== '23505') {
      console.error('[regala] insert gift_cards:', error)
      return { error: 'Qualcosa non ha funzionato. Riprova tra poco.' }
    }
  }
  if (!card) return { error: 'Qualcosa non ha funzionato. Riprova tra poco.' }

  const base = appUrl()
  const nome = `Gift card ${product.discipline}, ${product.title.toLowerCase()}`
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    locale: 'it',
    customer_email: buyerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(price * 100),
          product_data: {
            name: nome,
            description: `Un regalo per ${toName}${product.includes_stamp_duty ? ', compresi 2 € di bollo' : ''}`,
          },
        },
      },
    ],
    metadata: { gift_card_id: card.id, studio_id: studio.id },
    payment_intent_data: { description: `${nome} (${card.code})`, metadata: { gift_card_id: card.id, code: card.code } },
    success_url: `${base}/regala/fatto?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/regala`,
  })

  await db.from('gift_cards').update({ stripe_session_id: session.id }).eq('id', card.id)
  if (!session.url) return { error: 'Il pagamento non si è aperto. Riprova tra poco.' }
  return { url: session.url }
}
