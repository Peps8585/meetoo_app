'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Schedule = {
  id: string
  starts_at: string
  ends_at: string
  max_spots: number
  current_bookings: number
  location: string | null
  price_override: number | null
  classes: { name: string; color: string | null; price: number | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
}

type Feedback = { message: string; type: 'error' | 'success' | 'warning' }

const RPC_ERRORS: Record<string, string> = {
  no_credits:         'Non hai crediti disponibili. Acquista un pacchetto per prenotare.',
  full:               'Lezione al completo.',
  already_booked:     'Hai già prenotato questa lezione.',
  schedule_cancelled: 'Questa lezione è stata annullata.',
  schedule_past:      'Non puoi prenotare una lezione già iniziata.',
  not_authenticated:  'Devi effettuare l\'accesso.',
  not_owner:          'Impossibile annullare questa prenotazione.',
  booking_not_found:  'Impossibile annullare questa prenotazione.',
  not_active:         'Impossibile annullare questa prenotazione.',
}

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

export default function PalinsestoPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [studioId, setStudioId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [myBookings, setMyBookings] = useState<Map<string, string>>(new Map())
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

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
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (!studioId || !userId) return
    void loadSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, studioId, userId])

  async function loadSchedules(silent = false) {
    if (!studioId || !userId) return
    if (!silent) setLoading(true)

    const supabase = createClient()
    const weekEnd = addDays(weekStart, 7)

    const { data: schData, error: schErr } = await supabase
      .from('schedules')
      .select(
        `id, starts_at, ends_at, max_spots, current_bookings, location, price_override,
         classes:class_id(name, color, price),
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
        .select('id, schedule_id')
        .eq('client_id', userId)
        .eq('status', 'confirmed')
        .in(
          'schedule_id',
          fetched.map((s) => s.id)
        )
      const map = new Map<string, string>()
      for (const b of bkData ?? []) map.set(b.schedule_id, b.id)
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

    await loadSchedules(true)
    toggleBusy(scheduleId, false)
  }

  async function handleCancel(scheduleId: string, bookingId: string, within24h: boolean) {
    if (!userId) return

    if (within24h) {
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
      message: refunded
        ? 'Prenotazione annullata, credito riaccreditato.'
        : 'Prenotazione annullata. Credito trattenuto (penale entro 24h).',
      type: refunded ? 'success' : 'warning',
    })

    await loadSchedules(true)
    toggleBusy(scheduleId, false)
  }

  const isEmpty = byDay.every((d) => d.length === 0)
  const weekLabel = `${addDays(weekStart, 0).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
  })} — ${addDays(weekStart, 6).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`

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

        {/* Feedback */}
        {feedback && (
          <div className={`mb-6 rounded-xl px-4 py-3 font-inter text-sm border ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {feedback.message}
          </div>
        )}

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setWeekStart((prev) => addDays(prev, -7))}
            className="w-10 h-10 rounded-full border border-meetoo-accent-dark/20 flex items-center justify-center text-meetoo-accent-dark/50 hover:text-meetoo-accent-dark hover:border-meetoo-accent-dark/40 transition-colors font-inter text-sm"
          >
            ←
          </button>
          <span className="font-inter font-light text-sm text-meetoo-accent-dark">{weekLabel}</span>
          <button
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
            className="w-10 h-10 rounded-full border border-meetoo-accent-dark/20 flex items-center justify-center text-meetoo-accent-dark/50 hover:text-meetoo-accent-dark hover:border-meetoo-accent-dark/40 transition-colors font-inter text-sm"
          >
            →
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-20 text-center font-inter text-sm text-meetoo-accent-dark/40">
            Caricamento…
          </div>
        ) : isEmpty ? (
          <div className="py-20 text-center bg-white/40 rounded-2xl border border-white/80">
            <p className="font-inter text-sm text-meetoo-accent-dark/40">
              Nessuna lezione programmata questa settimana
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(weekStart, i)
              const daySchedules = byDay[i]
              if (daySchedules.length === 0) return null
              const isToday = day.toDateString() === new Date().toDateString()

              return (
                <section key={i}>
                  {/* Day label */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        isToday ? 'bg-meetoo-accent-dark' : 'bg-white/60 border border-white/80'
                      }`}
                    >
                      <span
                        className={`font-inter font-bold text-xs ${
                          isToday ? 'text-meetoo-bg-light' : 'text-meetoo-accent-dark'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    <div>
                      <p
                        className={`font-inter font-light uppercase tracking-widest text-xs ${
                          isToday ? 'text-meetoo-accent-dark' : 'text-meetoo-accent-dark/50'
                        }`}
                      >
                        {DAYS_IT[i]}
                      </p>
                      <p className="font-inter font-light text-[10px] text-meetoo-accent-dark/30 uppercase tracking-widest">
                        {day.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Lessons */}
                  <div className="space-y-2 pl-12">
                    {daySchedules.map((s) => {
                      const bookingId = myBookings.get(s.id)
                      const isBooked = bookingId !== undefined
                      const freeSpots = Math.max(0, s.max_spots - s.current_bookings)
                      const isFull = freeSpots === 0 && !isBooked
                      const within24h =
                        new Date(s.starts_at).getTime() - Date.now() < 24 * 60 * 60 * 1000
                      const busy = busyIds.has(s.id)
                      const price = effectivePrice(s)
                      const showPrice = price !== null && price > 0

                      return (
                        <div
                          key={s.id}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-sm"
                        >
                          {/* Color stripe */}
                          <div
                            className="w-1 h-10 rounded-full shrink-0"
                            style={{ backgroundColor: s.classes?.color ?? '#a8876a' }}
                          />

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
                            <p className="font-inter font-medium text-meetoo-accent-dark truncate">
                              {s.classes?.name ?? '—'}
                            </p>
                            {s.profiles && (
                              <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 truncate">
                                {s.profiles.first_name} {s.profiles.last_name}
                              </p>
                            )}
                            {s.location && (
                              <p className="font-inter font-light text-xs text-meetoo-accent-dark/35 truncate">
                                {s.location}
                              </p>
                            )}
                          </div>

                          {/* Right: spots + action */}
                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <div className="flex flex-col items-end gap-0.5">
                              {showPrice && (
                                <span className="font-inter font-normal text-xs text-meetoo-accent-dark/70">
                                  {fmtEuro(price)}
                                </span>
                              )}
                              <span className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45">
                                {freeSpots}/{s.max_spots}
                              </span>
                            </div>

                            {isBooked ? (
                              <button
                                disabled={busy}
                                onClick={() => handleCancel(s.id, bookingId!, within24h)}
                                className={`font-inter font-normal uppercase tracking-widest text-[10px] px-4 py-1.5 rounded-full border transition-colors ${
                                  busy
                                    ? 'border-meetoo-accent-dark/15 text-meetoo-accent-dark/25 cursor-wait'
                                    : 'border-red-300 text-red-500 hover:bg-red-50'
                                }`}
                              >
                                {busy ? '…' : 'Cancella'}
                              </button>
                            ) : isFull ? (
                              <button
                                disabled
                                className="font-inter font-normal uppercase tracking-widest text-[10px] px-4 py-1.5 rounded-full border border-meetoo-accent-dark/15 text-meetoo-accent-dark/25 cursor-not-allowed"
                              >
                                Esaurito
                              </button>
                            ) : (
                              <button
                                disabled={busy}
                                onClick={() => handleBook(s.id)}
                                className={`font-inter font-normal uppercase tracking-widest text-[10px] px-4 py-1.5 rounded-full transition-colors ${
                                  busy
                                    ? 'bg-meetoo-accent-dark/40 text-meetoo-bg-light cursor-wait'
                                    : 'bg-meetoo-accent-dark text-meetoo-bg-light hover:bg-meetoo-accent-light'
                                }`}
                              >
                                {busy ? '…' : 'Prenota'}
                              </button>
                            )}
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
    </main>
  )
}
