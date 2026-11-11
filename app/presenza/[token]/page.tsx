import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Logo } from '../../Logo'
import Scelta, { type Pulsante } from './Scelta'
import { entroLe } from '@/lib/posti-fissi/testi'

// Pagina costruita sul server a ogni richiesta: leggere l'ora qui e' voluto.
const adesso = () => Date.now()


// link personale (notifica o email): niente motori di ricerca
export const metadata: Metadata = { title: 'La tua lezione · Mee Too Pilates', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type Riga = {
  id: string
  client_id: string
  status: string
  response: string | null
  fixed_slot_id: string | null
  offered_at: string | null
  offer_expires_at: string | null
  schedules: {
    starts_at: string
    max_spots: number
    current_bookings: number | null
    is_cancelled: boolean | null
    classes: { name: string } | null
    profiles: { first_name: string | null; last_name: string | null } | null
  } | null
}

function quando(iso: string) {
  const d = new Date(iso)
  const giorno = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })
  const ora = d.toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Rome' }).replace(':', '.')
  return { giorno, ora }
}

export default async function PresenzaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ r?: string }>
}) {
  const { token } = await params
  const { r } = await searchParams
  if (!/^[0-9a-f]{32}$/.test(token)) notFound()

  const admin = createAdminClient()
  const { data } = await admin
    .from('bookings')
    .select(
      `id, client_id, status, response, fixed_slot_id, offered_at, offer_expires_at,
       schedules:schedule_id ( starts_at, max_spots, current_bookings, is_cancelled,
         classes:class_id ( name ), profiles:instructor_id ( first_name, last_name ) )`
    )
    .eq('action_token', token)
    .maybeSingle()
  const b = data as unknown as Riga | null
  if (!b || !b.schedules) notFound()

  const s = b.schedules
  const { giorno, ora } = quando(s.starts_at)
  const lezione = s.classes?.name ?? 'Lezione'
  const insegnante = [s.profiles?.first_name, s.profiles?.last_name].filter(Boolean).join(' ')
  const msAllaLezione = new Date(s.starts_at).getTime() - adesso()
  const passata = msAllaLezione <= 0
  const dentro24 = msAllaLezione < 24 * 60 * 60 * 1000
  const attiva = b.status === 'confirmed' || b.status === 'held'

  // dentro le 24 ore: si dice prima se la lezione verra' scalata
  let notaTardi: string | undefined
  if (attiva && dentro24 && !passata) {
    const { data: tranche } = await admin
      .from('client_packages')
      .select('late_cancel_used')
      .eq('client_id', b.client_id)
      .eq('is_active', true)
      .order('expires_at', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    notaTardi =
      tranche && !tranche.late_cancel_used
        ? 'Siamo dentro le 24 ore: userai la cancellazione gratis del tuo pacchetto, la lezione non ti viene scalata.'
        : 'Siamo dentro le 24 ore: la lezione ti viene scalata comunque, come da regolamento. Liberare il posto aiuta chi è in lista.'
  }

  let titolo: string
  let testo: string
  let pulsanti: Pulsante[] = []
  let nota: string | undefined

  if (s.is_cancelled) {
    titolo = 'Lezione annullata'
    testo = 'Questa lezione è stata annullata dallo studio.'
  } else if (passata) {
    titolo = 'Lezione già passata'
    testo = 'Questa lezione si è già tenuta.'
  } else if (b.status === 'waitlist' && b.offered_at) {
    // posto tenuto per lei: decide entro la scadenza, poi passa alla prossima
    titolo = 'Si è liberato un posto per te'
    testo = b.offer_expires_at
      ? `Sei la prima in lista e il posto è tenuto per te fino ${entroLe(b.offer_expires_at)}. Se lo prendi, la lezione si scala dal tuo pacchetto. Se non ti serve, il posto passa subito alla prossima.`
      : 'Sei la prima in lista e il posto è tenuto per te. Se lo prendi, la lezione si scala dal tuo pacchetto. Se non ti serve, il posto passa subito alla prossima.'
    pulsanti = [
      { risposta: 'prendo', label: 'Lo prendo', principale: r !== 'lascia' },
      { risposta: 'lascia', label: 'Questa volta no', principale: r === 'lascia' },
    ]
  } else if (b.status === 'waitlist') {
    const { data: posizione } = await admin.rpc('lista_posizione', { p_booking_id: b.id })
    titolo = 'Sei in lista d’attesa'
    testo =
      posizione === 1
        ? 'Sei la prima in lista. Se si libera un posto è tenuto per te e ti avvisiamo subito: avrai mezz’ora per dire se lo prendi.'
        : `Sei la numero ${posizione} in lista. Quando tocca a te ti avvisiamo, e avrai mezz’ora per dire se prendi il posto.`
    pulsanti = [{ risposta: 'esci', label: 'Esci dalla lista' }]
  } else if (attiva && b.fixed_slot_id) {
    if (b.response === 'ci_sono') {
      titolo = 'Ti aspettiamo'
      testo = 'Hai confermato. Se cambia qualcosa puoi ancora liberare il posto.'
      pulsanti = [{ risposta: 'non_vengo', label: 'Questa volta no' }]
      nota = notaTardi
    } else {
      titolo = `${giorno.charAt(0).toUpperCase() + giorno.slice(1).split(' ')[0]} alle ${ora} ci sei?`
      testo = 'È il tuo posto fisso. Se questa volta non vieni, il posto passa a chi è in lista.'
      pulsanti = [
        { risposta: 'ci_sono', label: 'Ci sono', principale: r !== 'non_vengo' },
        { risposta: 'non_vengo', label: 'Questa volta no', principale: r === 'non_vengo' },
      ]
      nota = notaTardi
    }
  } else if (attiva) {
    titolo = 'Sei dentro'
    testo = 'Il posto è tuo. Ti aspettiamo in studio.'
    pulsanti = [{ risposta: 'non_vengo', label: 'Non posso più venire' }]
    nota = notaTardi
  } else if (b.response === 'lascia' || b.response === 'scaduta') {
    titolo = b.response === 'lascia' ? 'Posto lasciato alla prossima' : 'Il tempo per rispondere è scaduto'
    testo =
      b.response === 'lascia'
        ? 'Grazie per averlo detto: il posto è passato alla prossima in lista.'
        : 'Il posto è passato alla prossima in lista. Se ti serve ancora una lezione, guarda il palinsesto.'
  } else {
    titolo = b.response === 'non_vengo' ? 'Posto liberato' : 'Prenotazione cancellata'
    testo = b.fixed_slot_id
      ? 'Grazie per averlo detto. Il tuo posto fisso resta per le altre settimane.'
      : 'Questa prenotazione non è più attiva.'
  }

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo variant="compact" className="text-meetoo-accent-dark [--mt-logo-w:104px]" />
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/70 px-6 py-7 shadow-sm">
          <p className="font-inter text-[10px] font-normal uppercase tracking-[0.25em] text-meetoo-accent-dark/45">
            {lezione} · {giorno} · {ora}
          </p>
          {insegnante && (
            <p className="mt-1 font-inter text-xs font-light text-meetoo-accent-dark/50">con {insegnante}</p>
          )}
          <h1 className="mt-4 font-inter text-2xl font-semibold leading-snug text-meetoo-accent-dark">{titolo}</h1>
          <p className="mt-3 font-inter text-[15px] font-light leading-relaxed text-meetoo-accent-dark/80">{testo}</p>

          {pulsanti.length > 0 && <Scelta token={token} pulsanti={pulsanti} nota={nota} />}
        </div>

        <p className="mt-6 text-center">
          <Link href="/dashboard" className="font-inter text-xs font-light text-meetoo-accent-dark/50 hover:text-meetoo-accent-dark">
            Vai alla tua area →
          </Link>
        </p>
      </div>
    </main>
  )
}
