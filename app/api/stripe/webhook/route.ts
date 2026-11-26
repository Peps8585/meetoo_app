import { getStripe } from '@/lib/stripe'
import { fulfillCheckoutSession, voidRefundedGift } from '@/lib/gift/fulfill'
import { annullaOrdineRimborsato, chiudiOrdinePacchetto } from '@/lib/pacchetti/negozio'

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
    if (session.metadata?.package_order_id) await chiudiOrdinePacchetto(session.id)
  }
  if (event.type === 'charge.refunded') {
    await voidRefundedGift(event.data.object.id)
    // pacchetti comprati dall'app: rimborso totale = ordine annullato, lo studio toglie il credito
    const ch = event.data.object
    const pi = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id
    if (ch.refunded && pi) await annullaOrdineRimborsato(pi)
  }
  return Response.json({ ricevuto: true })
}
