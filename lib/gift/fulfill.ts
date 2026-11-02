import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/email/send'
import { giftBuyerEmail, giftRecipientEmail, giftSoldStudioEmail } from '@/lib/email/templates'
import { getGiftCardByCode, getGiftCardBySession, getStudioContact, getStudioName, type GiftCard } from './data'
import { addMonths, fmtDayTime, fmtEuro, giftContents } from './format'

/** Indirizzo pubblico dell'app, per i link nelle email. */
export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export const giftUrl = (code: string) => `${appUrl()}/regalo/${code}`
export const giftQrUrl = (code: string) => `${appUrl()}/api/regali/qr/${code}`

/**
 * Chiude un pagamento: lo chiamano sia la pagina di ritorno da Stripe sia il
 * webhook, e chi arriva secondo non fa niente. Il pagamento si rilegge sempre
 * da Stripe: l'id della sessione da solo non prova nulla.
 */
export async function fulfillCheckoutSession(sessionId: string): Promise<GiftCard | null> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid') return getGiftCardBySession(sessionId)

  const db = createAdminClient()
  // passa da pending a paid una volta sola: e' questo update a fare da lucchetto
  const { data: claimed } = await db
    .from('gift_cards')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
    })
    .eq('stripe_session_id', sessionId)
    .eq('status', 'pending')
    .select('id')
  const card = await getGiftCardBySession(sessionId)
  if (!card || !claimed?.length) return card

  const consegnaOra = card.delivery === 'self' || !card.send_at || new Date(card.send_at) <= new Date()
  const consegnato = consegnaOra ? await deliverGift(card) : card
  await sendBuyerEmail(consegnato)
  await sendStudioEmail(consegnato)
  return consegnato
}

async function sendStudioEmail(card: GiftCard) {
  const { email } = await getStudioContact(card.studio_id)
  if (!email) return
  const { subject, html } = giftSoldStudioEmail({
    fromName: card.from_name,
    toName: card.to_name,
    buyerEmail: card.buyer_email,
    contents: giftContents(card),
    price: fmtEuro(card.price),
    code: card.code,
    // non deliverySentence: quella parla a chi ha comprato
    delivery: card.delivery === 'self' ? 'la consegna chi regala' : card.send_at ? `per email, il ${fmtDayTime(card.send_at)}` : 'per email, subito',
    studioUrl: giftUrl(card.code),
  })
  await sendEmail({ to: email, subject, html })
}

/**
 * Consegna: da qui partono i sei mesi di validita' (scelta del prototipo, da
 * confermare con lo studio). Per la consegna via email manda il regalo a chi
 * lo riceve; per "glielo do io" il regalo e' gia' nelle mani di chi l'ha comprato.
 */
export async function deliverGift(card: GiftCard): Promise<GiftCard> {
  const db = createAdminClient()
  const ora = new Date()
  const validUntil = addMonths(ora, card.valid_months)

  if (card.delivery === 'email' && card.recipient_email) {
    const studioName = await getStudioName(card.studio_id)
    const { subject, html } = giftRecipientEmail({
      toName: card.to_name,
      fromName: card.from_name,
      contents: giftContents(card),
      coverUrl: card.cover_url,
      occasion: card.occasion,
      giftUrl: giftUrl(card.code),
      qrUrl: giftQrUrl(card.code),
      code: card.code,
      studioName,
    })
    const { ok } = await sendEmail({ to: card.recipient_email, subject, html })
    // se l'email non parte il regalo resta "paid" e il giro dei programmati riprova
    if (!ok) return card
  }

  const { data } = await db
    .from('gift_cards')
    .update({ status: 'delivered', delivered_at: ora.toISOString(), valid_until: validUntil.toISOString() })
    .eq('id', card.id)
    .eq('status', 'paid')
    .select('id')
  if (!data?.length) return card
  return { ...card, status: 'delivered', delivered_at: ora.toISOString(), valid_until: validUntil.toISOString() }
}

/** Il testo su come e quando arriva il regalo, uguale in pagina e in email. */
export function deliverySentence(card: GiftCard): string {
  if (card.delivery === 'self') return `Il regalo è tuo da consegnare a ${card.to_name}.`
  if (card.status === 'delivered') return `L'abbiamo mandato a ${card.to_name} per email, all'indirizzo ${card.recipient_email}.`
  if (card.send_at) return `Arriva a ${card.to_name} il ${fmtDayTime(card.send_at)}, per email.`
  return `Sta arrivando a ${card.to_name} per email.`
}

async function sendBuyerEmail(card: GiftCard) {
  const { subject, html } = giftBuyerEmail({
    fromName: card.from_name,
    toName: card.to_name,
    contents: giftContents(card),
    price: fmtEuro(card.price),
    coverUrl: card.cover_url,
    occasion: card.occasion,
    giftUrl: giftUrl(card.code),
    delivery: deliverySentence(card),
    selfDelivery: card.delivery === 'self',
  })
  await sendEmail({ to: card.buyer_email, subject, html })
}

/** Manda i regali programmati arrivati alla loro ora. Lo chiama il giro periodico. */
export async function sendDueGifts(): Promise<{ inviati: number; falliti: number }> {
  const db = createAdminClient()
  const { data } = await db
    .from('gift_cards')
    .select('code')
    .eq('status', 'paid')
    .eq('delivery', 'email')
    .lte('send_at', new Date().toISOString())
    .limit(50)
  let inviati = 0
  let falliti = 0
  for (const { code } of data ?? []) {
    const card = await getGiftCardByCode(code)
    if (!card) continue
    const dopo = await deliverGift(card)
    if (dopo.status === 'delivered') inviati++
    else falliti++
  }
  return { inviati, falliti }
}

/**
 * Rimborso fatto dal pannello di Stripe: se e' totale, il regalo si annulla
 * (non si apre piu' come valido e non si attiva). Un rimborso parziale lo lascia
 * com'e': vuol dire che studio e cliente si sono accordati diversamente.
 * Il rimborso si rilegge da Stripe, l'avviso da solo non basta.
 */
export async function voidRefundedGift(chargeId: string): Promise<string | null> {
  const charge = await getStripe().charges.retrieve(chargeId)
  if (!charge.refunded) return null
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntent) return null
  const { data } = await createAdminClient()
    .from('gift_cards')
    .update({ status: 'void' })
    .eq('stripe_payment_intent', paymentIntent)
    .neq('status', 'void')
    .select('code')
  return data?.[0]?.code ?? null
}
