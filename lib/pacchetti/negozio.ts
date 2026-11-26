import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { avvisaTelegram } from '@/lib/telegram'
import { sendEmail } from '@/lib/email/send'
import { getStudioContact } from '@/lib/gift/data'
import { appUrl } from '@/lib/gift/fulfill'

/**
 * Pacchetti acquistabili dall'app (Mattia 26/11/2026).
 * Bollo: 2 euro aggiunti al prezzo quando il pacchetto supera 77,47 euro
 * (decisione di Mattia: si aggiunge al pagamento online). Ricevuta e fattura
 * le fa lo studio su Aruba Fatture: per questo l'avviso allo studio porta
 * nome, email, telefono e codice fiscale se c'e'.
 */
export const SOGLIA_BOLLO = 77.47
export const BOLLO = 2

export const bolloDi = (prezzo: number) => (prezzo > SOGLIA_BOLLO ? BOLLO : 0)

export type PacchettoInVendita = {
  id: string
  name: string
  disciplina: string
  credits: number
  validity_days: number | null
  price: number
  bollo: number
}

const DISCIPLINE = ['Reformer', 'Matwork', 'MAM', 'Yoga']

/** "Reformer 10" -> "Reformer". Quello che non si riconosce va sotto "Altri pacchetti". */
export function disciplinaDi(nome: string): string {
  const prima = nome.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  return DISCIPLINE.find((d) => d.toLowerCase() === prima) ?? 'Altri pacchetti'
}

/**
 * I pacchetti attivi dello studio, letti sul server. Si tengono solo quelli
 * con un numero di lezioni: un pacchetto a 0 lezioni e' un test, non si vende.
 */
export async function pacchettiInVendita(studioId: string): Promise<PacchettoInVendita[]> {
  const { data } = await createAdminClient()
    .from('packages')
    .select('id, name, credits, validity_days, price')
    .eq('studio_id', studioId)
    .eq('is_active', true)
    .gt('credits', 0)
    .order('price', { ascending: true })
  return (data ?? []).map((p) => {
    const price = Number(p.price)
    return {
      id: p.id,
      name: p.name,
      disciplina: disciplinaDi(p.name),
      credits: p.credits,
      validity_days: p.validity_days,
      price,
      bollo: bolloDi(price),
    }
  })
}

export type Acquirente = {
  id: string
  studio_id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  fiscal_code: string | null
  approvata_at: string | null
  role: string
}

export async function acquirente(userId: string): Promise<Acquirente | null> {
  const { data } = await createAdminClient()
    .from('profiles')
    .select('id, studio_id, first_name, last_name, phone, fiscal_code, approvata_at, role')
    .eq('id', userId)
    .maybeSingle()
  return (data as Acquirente | null) ?? null
}

/**
 * L'acquisto si apre solo con crediti accesi e prenotazioni dall'app aperte
 * (non "di prova"): prima di allora il pacchetto non avrebbe dove scalare.
 */
export async function acquistoAperto(studioId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from('studios')
    .select('crediti_attivi, prenotazioni_app, prenotazioni_prova')
    .eq('id', studioId)
    .maybeSingle()
  return !!data && data.crediti_attivi === true && data.prenotazioni_app === true && data.prenotazioni_prova !== true
}

/**
 * Chiude un pagamento: lo chiamano la pagina di ritorno e l'avviso di Stripe,
 * chi arriva secondo non fa niente. Il pagamento si rilegge sempre da Stripe.
 */
export async function chiudiOrdinePacchetto(sessionId: string): Promise<{ stato: 'pagato' | 'in_attesa' | 'sconosciuto'; nome?: string }> {
  const db = createAdminClient()
  const { data: ordine } = await db
    .from('package_orders')
    .select('id, studio_id, client_id, package_name, price, stamp_duty, status')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  if (!ordine) return { stato: 'sconosciuto' }
  if (ordine.status === 'paid') return { stato: 'pagato', nome: ordine.package_name }

  const session = await getStripe().checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid') return { stato: 'in_attesa', nome: ordine.package_name }

  const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
  const { data: accreditato, error } = await db.rpc('accredita_ordine_pacchetto', { p_order: ordine.id, p_payment_intent: pi })
  if (error) {
    console.error('[pacchetti] accredito:', error.message)
    await avvisaTelegram(`⚠️ Pacchetto pagato ma non accreditato: ${ordine.package_name}, ordine ${ordine.id}. Controllare.`)
    return { stato: 'in_attesa', nome: ordine.package_name }
  }
  // accreditato = null: l'ha gia' chiuso l'altra strada, gli avvisi sono gia' partiti
  if (accreditato) await avvisaStudio(ordine, session.customer_details?.email ?? session.customer_email ?? null)
  return { stato: 'pagato', nome: ordine.package_name }
}

const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

async function avvisaStudio(
  ordine: { client_id: string; studio_id: string; package_name: string; price: number; stamp_duty: number },
  email: string | null,
) {
  const c = await acquirente(ordine.client_id)
  const nome = [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Cliente'
  const totale = Number(ordine.price) + Number(ordine.stamp_duty)
  const righe = [
    `Pacchetto: ${ordine.package_name}`,
    `Pagato: ${euro(totale)}${Number(ordine.stamp_duty) > 0 ? ` (di cui ${euro(Number(ordine.stamp_duty))} di bollo)` : ''}`,
    `Cliente: ${nome}`,
    email ? `Email: ${email}` : null,
    c?.phone ? `Telefono: ${c.phone}` : null,
    `Codice fiscale: ${c?.fiscal_code || 'non inserito'}`,
  ].filter(Boolean) as string[]

  await avvisaTelegram(`📦 Pacchetto acquistato dall'app!\n\n${righe.join('\n')}\n\nIl credito è già nel suo profilo. Ricordatevi la ricevuta su Aruba.`)

  const { email: studioEmail } = await getStudioContact(ordine.studio_id)
  if (!studioEmail) return
  const html =
    `<p>Una cliente ha acquistato un pacchetto dall'app. Il credito è già nel suo profilo.</p>` +
    `<p>${righe.map((r) => r.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')}</p>` +
    `<p>Ricordatevi di fare la ricevuta o la fattura su Aruba Fatture.</p>` +
    `<p><a href="${appUrl()}/admin/clienti">Apri le clienti</a></p>`
  await sendEmail({ to: studioEmail, subject: `Pacchetto acquistato: ${ordine.package_name}, ${nome}`, html })
}

/** Rimborso totale fatto dal pannello di Stripe: l'ordine si segna annullato e lo studio sistema il credito. */
export async function annullaOrdineRimborsato(paymentIntent: string): Promise<void> {
  const { data } = await createAdminClient()
    .from('package_orders')
    .update({ status: 'void' })
    .eq('stripe_payment_intent', paymentIntent)
    .eq('status', 'paid')
    .select('package_name')
  if (data?.length) {
    await avvisaTelegram(`↩️ Rimborsato un pacchetto comprato dall'app (${data[0].package_name}): togliete il credito dalla scheda della cliente.`)
  }
}
