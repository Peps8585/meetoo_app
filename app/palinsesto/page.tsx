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
  classes: { name: string; color: string | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
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

const DAYS_IT = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

export default function PalinsestoPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
        `id, starts_at, ends_at, max_spots, current_bookings, location,
         classes:class_id(name, color),
         profiles:instructor_id(first_name, last_name)`
      )
      .eq('studio_id', studioId)
      .gte('starts_at', weekStart.toISOString())
      .lt('starts_at', weekEnd.toISOString())
      .order('starts_at')

    if (schErr) {
      setError(schErr.message)
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

  async function handleBook(scheduleId: string, currentCount: number) {
    if (!userId) return
    toggleBusy(scheduleId, true)
    setError(null)
    const supabase = createClient()

    const { error: bkErr } = await supabase.from('bookings').insert({
      client_id: userId,
      schedule_id: scheduleId,
      studio_id: studioId,
      status: 'confirmed',
    })

    if (bkErr) {
      setError(bkErr.message)
      await loadSchedules(true)
      toggleBusy(scheduleId, false)
      return
    }

    await supabase
      .from('schedules')
      .update({ current_bookings: currentCount + 1 })
      .eq('id', scheduleId)

    await loadSchedules(true)
    toggleBusy(scheduleId, false)
  }

  async function handleCancel(scheduleId: string, bookingId: string, currentCount: number) {
    if (!userId) return
    toggleBusy(scheduleId, true)
    setError(null)
    const supabase = createClient()

    const { error: cancelErr } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    if (cancelErr) {
      setError(cancelErr.message)
      toggleBusy(scheduleId, false)
      return
    }

    await supabase
      .from('schedules')
      .update({ current_bookings: Math.max(0, currentCount - 1) })
      .eq('id', scheduleId)

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

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-inter text-sm">
            {error}
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
                            <span className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45">
                              {freeSpots}/{s.max_spots}
                            </span>

                            {isBooked ? (
                              <span
                                title={
                                  within24h
                                    ? 'Cancellazione non disponibile entro 24h'
                                    : undefined
                                }
                              >
                                <button
                                  disabled={busy || within24h}
                                  onClick={() =>
                                    handleCancel(s.id, bookingId!, s.current_bookings)
                                  }
                                  className={`font-inter font-normal uppercase tracking-widest text-[10px] px-4 py-1.5 rounded-full border transition-colors ${
                                    busy || within24h
                                      ? 'border-meetoo-accent-dark/15 text-meetoo-accent-dark/25 cursor-not-allowed'
                                      : 'border-red-300 text-red-500 hover:bg-red-50'
                                  }`}
                                >
                                  {busy ? '…' : 'Cancella'}
                                </button>
                              </span>
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
                                onClick={() => handleBook(s.id, s.current_bookings)}
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
