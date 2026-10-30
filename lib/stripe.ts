import Stripe from 'stripe'

/**
 * Stripe lato server. In locale e in anteprima si usa la chiave di prova
 * (sk_test_...): i pagamenti sono finti e nessuno viene addebitato.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY mancante')
  return new Stripe(key)
}
