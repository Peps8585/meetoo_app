'use client'

import { useEffect, useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { stileLezione } from '@/lib/coloreLezione'
import { sendBookingConfirmationEmail } from './actions'

type Schedule = {
  id: string
  starts_at: string
  ends_at: string
  max_spots: number
  current_bookings: number
  location: string | null
  instructor_id: string | null
  sostituta_id: string | null
  price_override: number | null
  classes: { name: string; color: string | null; price: number | null; description: string | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
}

type Feedback = { message: string; type: 'error' | 'success' | 'warning' }

const RPC_ERRORS: Record<string, string> = {
  no_credits:         'Non hai crediti disponibili. Acquista un pacchetto per prenotare.',
  full:               'Lezione al completo.',
  already_booked:     'Sei prenotata per questa lezione.',
  schedule_cancelled: 'Questa lezione è stata annullata.',
  schedule_past:      'Non puoi prenotare una lezione già iniziata.',
  not_authenticated:  'Devi effettuare l\'accesso.',
  not_owner:          'Impossibile annullare questa prenotazione.',
  booking_not_found:  'Impossibile annullare questa prenotazione.',
  not_active:         'Impossibile annullare questa prenotazione.',
  booking_closed:     'Le iscrizioni a questa lezione sono chiuse.',
  not_full:           'Si è appena liberato un posto: puoi prenotare.',
  booking_locked:     'Le iscrizioni a questa lezione le ha chiuse lo studio.',
}

type MyBooking = { id: string; status: 'confirmed' | 'held' | 'waitlist'; fixed: boolean }

function translateRpcError(msg: string): string {
  return RPC_ERRORS[msg] ?? 'Si è verificato un errore. Riprova.'
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

function effectivePrice(s: Schedule): number | null {
  return s.price_override ?? s.classes?.price ?? null
}

const DAYS_IT = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
const DAYS_BREVI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

// posizione del giorno nella settimana, con il lunedi' a 0
function indiceGiorno(d: Date): number {
  const g = d.getDay()
  return g === 0 ? 6 : g - 1
}

// yyyy-mm-dd nel giorno locale (il valore che vuole <input type="date">)
function dataIso(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export default function PalinsestoPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  // Si guarda un giorno alla volta (richiesta di Mattia del 16/11/2026): la
  // striscia in alto sceglie il giorno della settimana, il calendario salta a
  // qualsiasi data. La settimana caricata e' quella del giorno scelto.
  const [giorno, setGiorno] = useState<Date>(() => startOfDay(new Date()))
  const lunedi = getMonday(giorno).getTime()
  const weekStart = useMemo(() => new Date(lunedi), [lunedi])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [studioId, setStudioId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [myBookings, setMyBookings] = useState<Map<string, MyBooking>>(new Map())
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  // Lezione aperta nel riquadro dal basso (richiesta di Mattia del 17/11/2026:
  // la card si tocca tutta, non solo il tasto). Il riquadro non prenota da solo.
  const [aperta, setAperta] = useState<string | null>(null)
  // nome e cognome delle insegnanti: una cliente non legge i loro profili
  const [insegnanti, setInsegnanti] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('studio_id')
        .eq('id', user.id)
        .single()
      if (profile?.studio_id) setStudioId(profile.studio_id)
      const { data: nomi } = await supabase.rpc('nomi_insegnanti')
      setInsegnanti(
        new Map(
          ((nomi ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((n) => [
            n.id,
            [n.first_name, n.last_name].filter(Boolean).join(' '),
          ])
        )
      )
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (!studioId || !userId) return
    void loadSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, studioId, userId])

  // L'avviso è un toast fisso in basso: sparisce da solo dopo qualche secondo.
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 5000)
    return () => clearTimeout(t)
  }, [feedback])

  async function loadSchedules(silent = false) {
    if (!studioId || !userId) return
    if (!silent) setLoading(true)

    const supabase = createClient()
    const weekEnd = addDays(weekStart, 7)

    const { data: schData, error: schErr } = await supabase
      .from('schedules')
      .select(
        `id, starts_at, ends_at, max_spots, current_bookings, location, price_override, instructor_id, sostituta_id,
         classes:class_id(name, color, price, description),
         profiles:instructor_id(first_name, last_name)`
      )
      .eq('studio_id', studioId)
      .gte('starts_at', weekStart.toISOString())
      .lt('starts_at', weekEnd.toISOString())
      .order('starts_at')

    if (schErr) {
      setFeedback({ message: schErr.message, type: 'error' })
      setLoading(false)
      return
    }

    const fetched = (schData as unknown as Schedule[]) ?? []
    setSchedules(fetched)

    if (fetched.length > 0) {
      const { data: bkData } = await supabase
        .from('bookings')
        .select('id, schedule_id, status, fixed_slot_id')
        .eq('client_id', userId)
        .in('status', ['confirmed', 'held', 'waitlist'])
        .in(
          'schedule_id',
          fetched.map((s) => s.id)
        )
      const map = new Map<string, MyBooking>()
      for (const b of bkData ?? [])
        map.set(b.schedule_id, { id: b.id, status: b.status, fixed: b.fixed_slot_id !== null })
      setMyBookings(map)
    } else {
      setMyBookings(new Map())
    }

    setLoading(false)
  }

  const byDay = useMemo(() => {
    const groups: Schedule[][] = Array.from({ length: 7 }, () => [])
    for (const s of schedules) {
      const day = new Date(s.starts_at).getDay()
      const idx = day === 0 ? 6 : day - 1
      groups[idx].push(s)
    }
    return groups
  }, [schedules])

  function toggleBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev)
      busy ? next.add(id) : next.delete(id)
      return next
    })
  }

  async function handleBook(scheduleId: string) {
    if (!userId) return
    toggleBusy(scheduleId, true)
    setFeedback(null)
    const supabase = createClient()

    const { error } = await supabase.rpc('book_lesson', { p_schedule_id: scheduleId })

    if (error) {
      setFeedback({ message: translateRpcError(error.message), type: 'error' })
      await loadSchedules(true)
      toggleBusy(scheduleId, false)
      return
    }

    // Fire-and-forget: la conferma email non deve ritardare né bloccare la UI.
    void sendBookingConfirmationEmail(scheduleId)

    await loadSchedules(true)
    toggleBusy(scheduleId, false)
  }

  // Lezione piena: ci si mette in lista. Se un posto si libera prima della
  // scadenza delle 24 ore si entra da sole; dopo, arriva un avviso.
  async function handleWaitlist(scheduleId: string) {
    if (!userId) return
    toggleBusy(scheduleId, true)
    setFeedback(null)
    const supabase = createClient()

    const { error } = await supabase.rpc('join_waitlist', { p_schedule_id: scheduleId })

    if (error) {
      setFeedback({ message: translateRpcError(error.message), type: 'error' })
    } else {
      setFeedback({
        message: 'Sei in lista d\'attesa. Se si libera un posto ti avvisiamo.',
        type: 'success',
      })
    }
    await loadSchedules(true)
    toggleBusy(scheduleId, false)
  }

  async function handleCancel(
    scheduleId: string,
    bookingId: string,
    within24h: boolean,
    status: MyBooking['status']
  ) {
    if (!userId) return

    // Uscire dalla lista o liberare un posto fisso non ancora scalato non costa niente
    if (within24h && status === 'confirmed') {
      const confirmed = window.confirm(
        'Sei entro le 24 ore: se disdici perdi il credito. Confermi?'
      )
      if (!confirmed) return
    }

    toggleBusy(scheduleId, true)
    setFeedback(null)
    const supabase = createClient()

    const { data, error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })

    if (error) {
      setFeedback({ message: translateRpcError(error.message), type: 'error' })
      toggleBusy(scheduleId, false)
      return
    }

    const refunded = (data as { refunded: boolean }).refunded
    setFeedback({
      message: status === 'waitlist'
        ? 'Sei uscita dalla lista d\'attesa.'
        : status === 'held'
        ? 'Posto liberato. Il tuo posto fisso resta per le altre settimane.'
        : refunded
        ? 'Prenotazione annullata, credito riaccreditato.'
        : 'Prenotazione annullata. Credito trattenuto (penale entro 24h).',
      type: refunded ? 'success' : 'warning',
    })

    await loadSchedules(true)
    toggleBusy(scheduleId, false)
  }

  // tutto quello che serve per decidere quale tasto mostrare su una lezione
  function statoLezione(s: Schedule) {
    const mine = myBookings.get(s.id)
    const isBooked = mine !== undefined && mine.status !== 'waitlist'
    const inWaitlist = mine?.status === 'waitlist'
    const freeSpots = Math.max(0, s.max_spots - s.current_bookings)
    const isFull = freeSpots === 0 && !isBooked
    const inizio = new Date(s.starts_at).getTime() - Date.now()
    const closed = inizio < 12 * 60 * 60 * 1000
    const within24h = inizio < 24 * 60 * 60 * 1000
    const busy = busyIds.has(s.id)
    const price = effectivePrice(s)
    const showPrice = price !== null && price > 0
    return { mine, isBooked, inWaitlist, freeSpots, isFull, closed, within24h, busy, price, showPrice }
  }

  // chi tiene davvero la lezione: la sostituta, se c'e'
  function nomeInsegnante(s: Schedule): string {
    const chi = s.sostituta_id ?? s.instructor_id
    return (
      (chi && insegnanti.get(chi)) ||
      (!s.sostituta_id && s.profiles
        ? `${s.profiles.first_name ?? ''} ${s.profiles.last_name ?? ''}`.trim()
        : '')
    )
  }

  // Il tasto della lezione: piccolo sulla card, grande nel riquadro. Dal
  // riquadro, finita l'azione, si torna al palinsesto e l'esito compare in basso.
  function tastoLezione(s: Schedule, grande: boolean) {
    const { mine, isBooked, inWaitlist, isFull, closed, within24h, busy } = statoLezione(s)
    const misura = grande
      ? 'w-full text-xs py-4'
      : 'text-[10px] px-4 py-1.5'
    const poi = (azione: () => Promise<void>) => async (e: React.MouseEvent) => {
      e.stopPropagation()
      await azione()
      if (grande) setAperta(null)
    }

    if (isBooked || inWaitlist) {
      return (
        <button
          disabled={busy}
          onClick={poi(() => handleCancel(s.id, mine!.id, within24h, mine!.status))}
          className={`font-inter font-normal uppercase tracking-widest ${misura} rounded-full border transition-colors ${
            busy
              ? 'border-meetoo-accent-dark/15 text-meetoo-accent-dark/25 cursor-wait'
              : 'border-red-300 text-red-500 hover:bg-red-50'
          }`}
        >
          {busy ? '…' : inWaitlist ? 'Esci dalla lista' : grande ? 'Cancella la prenotazione' : 'Cancella'}
        </button>
      )
    }
    if (isFull && !closed) {
      return (
        <button
          disabled={busy}
          onClick={poi(() => handleWaitlist(s.id))}
          className={`font-inter font-normal uppercase tracking-widest ${misura} rounded-full border transition-colors ${
            busy
              ? 'border-meetoo-accent-dark/15 text-meetoo-accent-dark/25 cursor-wait'
              : 'border-meetoo-accent-dark/40 text-meetoo-accent-dark hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light'
          }`}
        >
          {busy ? '…' : grande ? 'Mettimi in lista d\'attesa' : 'Lista d\'attesa'}
        </button>
      )
    }
    if (isFull) {
      return (
        <button
          disabled
          onClick={(e) => e.stopPropagation()}
          className={`font-inter font-normal uppercase tracking-widest ${misura} rounded-full border border-meetoo-accent-dark/15 text-meetoo-accent-dark/25 cursor-not-allowed`}
        >
          Esaurito
        </button>
      )
    }
    return (
      <button
        disabled={busy}
        onClick={poi(() => handleBook(s.id))}
        className={`font-inter font-normal uppercase tracking-widest ${misura} rounded-full transition-colors ${
          busy
            ? 'bg-meetoo-accent-dark/40 text-meetoo-bg-light cursor-wait'
            : 'bg-meetoo-accent-dark text-meetoo-bg-light hover:bg-meetoo-accent-light'
        }`}
      >
        {busy ? '…' : 'Prenota'}
      </button>
    )
  }

  const lezioneAperta = aperta ? schedules.find((x) => x.id === aperta) ?? null : null

  const scelto = indiceGiorno(giorno)
  const oggi = startOfDay(new Date()).getTime()
  const giornoLabel = giorno.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-6 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="font-inter font-extrabold uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/60 mb-1">
              Mee Too Pilates
            </p>
            <h1 className="font-inter font-extrabold uppercase tracking-widest text-4xl text-meetoo-accent-dark leading-none">
              Palinsesto
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full transition-colors hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light"
          >
            ← Home
          </Link>
        </div>

        {/* Feedback — toast fisso in basso allo schermo: visibile ovunque sia lo
            scroll, così l'avviso compare dov'è il dito e non fuori campo (mobile). */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pointer-events-none"
          >
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className={`pointer-events-auto w-full max-w-md text-left rounded-xl px-4 py-3 font-inter text-sm border shadow-lg ${
                feedback.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : feedback.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {feedback.message}
            </button>
          </div>
        )}

        {/* Giorno scelto: toccando la data si apre il calendario del telefono */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            onClick={() => setGiorno((prev) => addDays(prev, -7))}
            aria-label="Settimana precedente"
            className="w-10 h-10 rounded-full border border-meetoo-accent-dark/20 flex items-center justify-center text-meetoo-accent-dark/50 hover:text-meetoo-accent-dark hover:border-meetoo-accent-dark/40 transition-colors font-inter text-sm shrink-0"
          >
            ←
          </button>
          <label className="relative inline-flex items-center gap-1.5 min-w-0 font-inter font-light text-sm text-meetoo-accent-dark cursor-pointer">
            <span className="truncate capitalize underline decoration-meetoo-accent-dark/25 underline-offset-4">{giornoLabel}</span>
            <span aria-hidden className="text-meetoo-accent-dark/40 text-xs">▾</span>
            <input
              type="date"
              aria-label="Scegli il giorno dal calendario"
              value={dataIso(giorno)}
              onChange={(e) => {
                if (!e.target.value) return
                const [y, m, d] = e.target.value.split('-').map(Number)
                setGiorno(new Date(y, m - 1, d))
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
          <button
            onClick={() => setGiorno((prev) => addDays(prev, 7))}
            aria-label="Settimana successiva"
            className="w-10 h-10 rounded-full border border-meetoo-accent-dark/20 flex items-center justify-center text-meetoo-accent-dark/50 hover:text-meetoo-accent-dark hover:border-meetoo-accent-dark/40 transition-colors font-inter text-sm shrink-0"
          >
            →
          </button>
        </div>

        {/* I sette giorni della settimana: un tocco e si vede solo quel giorno */}
        <div className="grid grid-cols-7 gap-1.5 mb-8" role="tablist" aria-label="Giorni della settimana">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(weekStart, i)
            const attivo = i === scelto
            const eOggi = d.getTime() === oggi
            const lezioni = byDay[i].length
            const mia = byDay[i].some((x) => myBookings.has(x.id))
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={attivo}
                aria-label={`${DAYS_IT[i]} ${d.getDate()}${lezioni === 0 && !loading ? ', nessuna lezione' : ''}`}
                onClick={() => setGiorno(d)}
                className={`flex flex-col items-center rounded-2xl py-2.5 transition-colors ${
                  attivo
                    ? 'bg-meetoo-accent-dark text-meetoo-bg-light'
                    : `bg-white/60 border ${eOggi ? 'border-meetoo-accent-dark/50' : 'border-white/80'} text-meetoo-accent-dark`
                } ${!attivo && lezioni === 0 && !loading ? 'opacity-45' : ''}`}
              >
                <span className="font-inter text-[10px] uppercase tracking-widest">{DAYS_BREVI[i]}</span>
                <span className="font-inter font-semibold text-base leading-tight">{d.getDate()}</span>
                <span
                  aria-hidden
                  className={`mt-1 h-1.5 w-1.5 rounded-full ${
                    mia ? (attivo ? 'bg-meetoo-bg-light' : 'bg-meetoo-accent-light') : 'bg-transparent'
                  }`}
                />
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-20 text-center font-inter text-sm text-meetoo-accent-dark/40">
            Caricamento…
          </div>
        ) : byDay[scelto].length === 0 ? (
          <div className="py-16 text-center bg-white/40 rounded-2xl border border-white/80">
            <p className="font-inter text-sm text-meetoo-accent-dark/60">
              {DAYS_IT[scelto]} non ci sono lezioni in programma.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {[scelto].map((i) => {
              const day = addDays(weekStart, i)
              const daySchedules = byDay[i]

              return (
                <section key={i} aria-label={`${DAYS_IT[i]} ${day.getDate()}`}>
                  {/* Lessons */}
                  <div className="space-y-2">
                    {daySchedules.map((s) => {
                      const { mine, isBooked, inWaitlist, freeSpots, price, showPrice } = statoLezione(s)
                      const nome = nomeInsegnante(s)

                      return (
                        <div
                          key={s.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`${s.classes?.name ?? 'Lezione'} alle ${formatTime(s.starts_at)}: apri i dettagli`}
                          onClick={() => setAperta(s.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setAperta(s.id)
                            }
                          }}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
                          style={stileLezione(s.classes?.color)}
                        >

                          {/* Time */}
                          <div className="shrink-0 w-14">
                            <p className="font-inter font-medium text-sm text-meetoo-accent-dark">
                              {formatTime(s.starts_at)}
                            </p>
                            <p className="font-inter font-light text-xs text-meetoo-accent-dark/40">
                              {formatTime(s.ends_at)}
                            </p>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-inter font-medium text-meetoo-accent-dark leading-snug">
                              {s.classes?.name ?? '—'}
                            </p>
                            {nome && (
                              <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 truncate">{nome}</p>
                            )}
                            {s.location && (
                              <p className="font-inter font-light text-xs text-meetoo-accent-dark/35 truncate">
                                {s.location}
                              </p>
                            )}
                            {mine?.fixed && isBooked && (
                              <p className="font-inter font-normal text-[10px] uppercase tracking-widest text-meetoo-bg-dark mt-0.5">
                                Il tuo posto fisso
                              </p>
                            )}
                            {inWaitlist && (
                              <p className="font-inter font-normal text-[10px] uppercase tracking-widest text-meetoo-accent-light mt-0.5">
                                Sei in lista d&apos;attesa
                              </p>
                            )}
                          </div>

                          {/* Right: spots + action */}
                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <div className="flex flex-col items-end gap-0.5">
                              {showPrice && (
                                <span className="font-inter font-normal text-xs text-meetoo-accent-dark/70">
                                  {fmtEuro(price!)}
                                </span>
                              )}
                              <span className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45">
                                {freeSpots}/{s.max_spots}
                              </span>
                            </div>

                            {tastoLezione(s, false)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {lezioneAperta && (() => {
        const s = lezioneAperta
        const { isBooked, inWaitlist, mine, freeSpots, isFull, closed, price, showPrice } = statoLezione(s)
        const nome = nomeInsegnante(s)
        const quando = new Date(s.starts_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
            onClick={() => setAperta(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={s.classes?.name ?? 'Lezione'}
              className="w-full sm:max-w-md bg-meetoo-bg-light rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto pb-[calc(1.5rem_+_env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-t-3xl px-6 pt-5 pb-5" style={stileLezione(s.classes?.color)}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-inter font-extrabold uppercase tracking-widest text-xl text-meetoo-accent-dark leading-tight">
                    {s.classes?.name ?? 'Lezione'}
                  </h2>
                  <button
                    type="button"
                    aria-label="Chiudi"
                    onClick={() => setAperta(null)}
                    className="-mr-2 -mt-1 w-9 h-9 shrink-0 flex items-center justify-center text-meetoo-accent-dark/60"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="font-inter text-sm text-meetoo-accent-dark mt-1 first-letter:uppercase">
                  {quando}, dalle {formatTime(s.starts_at)} alle {formatTime(s.ends_at)}
                </p>
              </div>

              <div className="px-6 pt-5 space-y-4">
                {s.classes?.description && (
                  <p className="font-inter font-light text-sm text-meetoo-accent-dark/80 leading-relaxed first-letter:uppercase">
                    {s.classes.description}
                  </p>
                )}

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 font-inter text-sm">
                  {nome && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45">Insegnante</dt>
                      <dd className="text-meetoo-accent-dark">{nome}</dd>
                    </div>
                  )}
                  {s.location && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45">Sala</dt>
                      <dd className="text-meetoo-accent-dark">{s.location}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45">Posti liberi</dt>
                    <dd className="text-meetoo-accent-dark">{freeSpots} su {s.max_spots}</dd>
                  </div>
                  {showPrice && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45">Prezzo</dt>
                      <dd className="text-meetoo-accent-dark">{fmtEuro(price!)}</dd>
                    </div>
                  )}
                </dl>

                {(isBooked || inWaitlist) && (
                  <p className="font-inter text-sm text-meetoo-bg-dark">
                    {inWaitlist
                      ? 'Sei in lista d\'attesa: se si libera un posto ti avvisiamo.'
                      : mine?.fixed
                      ? 'Questo è il tuo posto fisso.'
                      : 'Sei prenotata per questa lezione.'}
                  </p>
                )}
                {isFull && closed && !isBooked && (
                  <p className="font-inter text-sm text-meetoo-accent-dark/60">
                    La lezione è al completo e le iscrizioni sono chiuse.
                  </p>
                )}

                <div className="pt-1">{tastoLezione(s, true)}</div>
              </div>
            </div>
          </div>
        )
      })()}
    </main>
  )
}
