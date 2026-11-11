'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type BookingProfile = {
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

type Booking = {
  status: string
  client_id: string
  booked_at: string
  fixed_slot_id: string | null
  response: string | null
  reminder_sent_at: string | null
  profiles: BookingProfile | null
}


type Schedule = {
  id: string
  starts_at: string
  ends_at: string
  max_spots: number
  location: string | null
  classes: {
    name: string
    color: string | null
    duration_minutes: number | null
  } | null
  profiles: { first_name: string | null; last_name: string | null } | null
  bookings: Booking[] | null
}

function startOfDay(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// yyyy-mm-dd nel giorno locale (il valore che vuole <input type="date">)
function dataIso(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}


const DAYS_IT = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
]

export default function AgendaPage() {
  const router = useRouter()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const giorno = useSearchParams().get('giorno')
  const [day, setDay] = useState<Date>(() => {
    const m = giorno?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : startOfDay(new Date())
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studioId, setStudioId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      // la sessione salvata sul telefono basta a sapere chi e': nessun viaggio in piu'.
      // I dati restano protetti dalle regole del database (RLS) a ogni lettura.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('studio_id, role')
        .eq('id', user.id)
        .single()
      if (profile?.studio_id) setStudioId(profile.studio_id)
      if (profile?.role) setRole(profile.role)
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (!studioId || !role || !userId) return
    void loadSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, studioId, role, userId])

  async function loadSchedules() {
    if (!studioId || !role || !userId) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const dayStart = startOfDay(day)
    const dayEnd = addDays(dayStart, 1)

    let query = supabase
      .from('schedules')
      .select(
        `id, starts_at, ends_at, max_spots, location,
         classes:class_id(name, color, duration_minutes),
         profiles:instructor_id(first_name, last_name),
         bookings(status, client_id, booked_at)`
      )
      .eq('studio_id', studioId)
      .gte('starts_at', dayStart.toISOString())
      .lt('starts_at', dayEnd.toISOString())
      .order('starts_at')

    // Un'istruttrice vede solo le proprie lezioni; l'admin le vede tutte.
    if (role === 'instructor') {
      query = query.eq('instructor_id', userId)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const righe = (data as unknown as Schedule[]) ?? []
    setSchedules(righe)
    setLoading(false)

  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const isToday = day.toDateString() === new Date().toDateString()
  const dayLabel = `${DAYS_IT[day.getDay()]} ${day.toLocaleDateString('it-IT', {
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
              Agenda
            </h1>
          </div>
          {role === 'admin' ? (
            <Link
              href="/admin/dashboard"
              className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full transition-colors hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light"
            >
              ← Home
            </Link>
          ) : role === 'instructor' ? (
            <button
              onClick={logout}
              className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full transition-colors hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light"
            >
              Esci
            </button>
          ) : null}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl px-4 py-3 font-inter text-sm border bg-red-50 border-red-200 text-red-700">
            {error}
          </div>
        )}

        {/* Day navigation */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <button
            onClick={() => { setDay((prev) => startOfDay(addDays(prev, -1))) }}
            aria-label="Giorno precedente"
            className="w-10 h-10 rounded-full border border-meetoo-accent-dark/20 flex items-center justify-center text-meetoo-accent-dark/50 hover:text-meetoo-accent-dark hover:border-meetoo-accent-dark/40 transition-colors font-inter text-sm shrink-0"
          >
            ←
          </button>
          <div className="flex flex-col items-center gap-1 text-center min-w-0">
            {/* Toccando la data si apre il calendario del telefono: qualsiasi giorno */}
            <label className="relative inline-flex items-center gap-1.5 font-inter font-light text-sm text-meetoo-accent-dark cursor-pointer">
              <span className="truncate underline decoration-meetoo-accent-dark/25 underline-offset-4">{dayLabel}</span>
              <span aria-hidden className="text-meetoo-accent-dark/40 text-xs">▾</span>
              <input
                type="date"
                aria-label="Scegli il giorno"
                value={dataIso(day)}
                onChange={(e) => {
                  if (!e.target.value) return
                  const [y, m, d] = e.target.value.split('-').map(Number)
                  setDay(new Date(y, m - 1, d))
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            {!isToday && (
              <button
                onClick={() => setDay(startOfDay(new Date()))}
                className="font-inter font-normal uppercase tracking-widest text-[10px] text-meetoo-accent-dark/50 hover:text-meetoo-accent-dark transition-colors"
              >
                Torna a oggi
              </button>
            )}
          </div>
          <button
            onClick={() => { setDay((prev) => startOfDay(addDays(prev, 1))) }}
            aria-label="Giorno successivo"
            className="w-10 h-10 rounded-full border border-meetoo-accent-dark/20 flex items-center justify-center text-meetoo-accent-dark/50 hover:text-meetoo-accent-dark hover:border-meetoo-accent-dark/40 transition-colors font-inter text-sm shrink-0"
          >
            →
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-20 text-center font-inter text-sm text-meetoo-accent-dark/40">
            Caricamento…
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-20 text-center bg-white/40 rounded-2xl border border-white/80">
            <p className="font-inter text-sm text-meetoo-accent-dark/40">
              Nessuna lezione programmata in questa giornata
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((s) => {
              const active = (s.bookings ?? []).filter(
                (b) => b.status !== 'cancelled'
              )
              const byBookedAt = (a: Booking, b: Booking) =>
                a.booked_at.localeCompare(b.booked_at)
              // il posto fisso tenuto conta come prenotato
              const confirmed = active
                .filter((b) => b.status === 'confirmed' || b.status === 'held')
                .sort(byBookedAt)


              return (
                <section
                  key={s.id}
                  className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl shadow-sm overflow-hidden"
                >
                  {/* Un tocco apre la pagina della lezione con le iscritte */}
                  <Link
                    href={`/agenda/lezione/${s.id}`}
                    className="w-full text-left flex items-center gap-3 px-5 py-4 hover:bg-white/40 transition-colors"
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
                      <p className="font-inter font-medium text-meetoo-accent-dark leading-snug">
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

                    {/* Confirmed count */}
                    <div className="shrink-0 text-right">
                      <p className="font-inter font-semibold text-lg text-meetoo-accent-dark leading-none">
                        {confirmed.length}
                        <span className="font-light text-meetoo-accent-dark/40">
                          /{s.max_spots}
                        </span>
                      </p>
                      <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 mt-1">
                        Prenotate
                      </p>
                    </div>
                    <span aria-hidden className="shrink-0 font-inter text-meetoo-accent-dark/35">
                      →
                    </span>
                  </Link>

                </section>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
