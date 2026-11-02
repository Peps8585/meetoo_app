import { getStripe } from '@/lib/stripe'
import { fulfillCheckoutSession, voidRefundedGift } from '@/lib/gift/fulfill'

/**
 * Avvisi di Stripe. Pagamento riuscito: chiude il regalo anche se chi ha pagato
 * ha chiuso la pagina prima di tornare da noi. Rimborso totale: annulla il regalo.
 * La firma prova che l'avviso viene da Stripe.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = request.headers.get('stripe-signature')
  if (!secret || !signature) return new Response('configurazione mancante', { status: 400 })

  let event
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret)
  } catch {
    return new Response('firma non valida', { status: 400 })
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object
    if (session.metadata?.gift_card_id) await fulfillCheckoutSession(session.id)
  }
  if (event.type === 'charge.refunded') {
    await voidRefundedGift(event.data.object.id)
  }
  return Response.json({ ricevuto: true })
}
