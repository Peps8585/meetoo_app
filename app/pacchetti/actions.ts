'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { utenteDaSessione } from '@/lib/supabase/utente'
import { getStripe } from '@/lib/stripe'
import { appUrl } from '@/lib/gift/fulfill'
import { acquirente, acquistoAperto, bolloDi } from '@/lib/pacchetti/negozio'

/**
 * Apre il pagamento di un pacchetto. Il browser manda solo l'id del pacchetto:
 * prezzo, bollo e nome si rileggono qui dal database.
 */
export async function acquistaPacchetto(packageId: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)
  if (!user) return { error: 'Entra nel tuo account per acquistare.' }

  const c = await acquirente(user.id)
  if (!c || c.role !== 'client' || !c.studio_id) return { error: 'L’acquisto è riservato alle clienti dello studio.' }
  if (!c.approvata_at) return { error: 'Lo studio deve ancora confermare la tua iscrizione.' }
  if (!(await acquistoAperto(c.studio_id))) return { error: 'L’acquisto dall’app non è ancora aperto: per ora i pacchetti si comprano in studio.' }

  const db = createAdminClient()
  const { data: pkg } = await db
    .from('packages')
    .select('id, name, credits, price')
    .eq('id', packageId)
    .eq('studio_id', c.studio_id)
    .eq('is_active', true)
    .gt('credits', 0)
    .maybeSingle()
  if (!pkg) return { error: 'Questo pacchetto non è più disponibile. Ricarica la pagina.' }

  const price = Number(pkg.price)
  const bollo = bolloDi(price)
  const { data: ordine, error } = await db
    .from('package_orders')
    .insert({ studio_id: c.studio_id, client_id: c.id, package_id: pkg.id, package_name: pkg.name, price, stamp_duty: bollo })
    .select('id')
    .single()
  if (error || !ordine) {
    console.error('[pacchetti] ordine:', error?.message)
    return { error: 'Qualcosa non ha funzionato. Riprova tra poco.' }
  }

  const base = appUrl()
  const righe = [
    {
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(price * 100),
        product_data: { name: `Pacchetto ${pkg.name}`, description: `${pkg.credits} lezioni da Mee Too Pilates` },
      },
    },
  ]
  if (bollo > 0) {
    righe.push({
      quantity: 1,
      price_data: { currency: 'eur', unit_amount: Math.round(bollo * 100), product_data: { name: 'Marca da bollo', description: 'Dovuta per legge sopra 77,47 €' } },
    })
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    locale: 'it',
    customer_email: user.email,
    line_items: righe,
    metadata: { package_order_id: ordine.id, studio_id: c.studio_id },
    payment_intent_data: { description: `Pacchetto ${pkg.name}`, metadata: { package_order_id: ordine.id } },
    success_url: `${base}/pacchetti/fatto?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pacchetti`,
  })
  await db.from('package_orders').update({ stripe_session_id: session.id }).eq('id', ordine.id)
  if (!session.url) return { error: 'Il pagamento non si è aperto. Riprova tra poco.' }
  return { url: session.url }
}
