import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, User, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import DecisionCard from './DecisionCard'

type Profile = {
  first_name: string | null
  last_name: string | null
}

type UpcomingLesson = {
  id: string
  starts_at: string
  ends_at: string
  location: string | null
  classes: { name: string; color: string | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function fmtTodayLong(): string {
  return new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  async function logout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  // Fetch profile for personalized greeting
  const { data: profileData } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null
  const displayName = profile?.first_name ?? user.email?.split('@')[0] ?? 'ospite'

  // Fetch upcoming confirmed bookings (next 3)
  const now = new Date().toISOString()

  const { data: rawBookings } = await supabase
    .from('bookings')
    .select('schedule_id')
    .eq('client_id', user.id)
    .eq('status', 'confirmed')

  const scheduleIds = ((rawBookings ?? []) as { schedule_id: string }[]).map(
    (b) => b.schedule_id
  )

  let upcoming: UpcomingLesson[] = []
  if (scheduleIds.length > 0) {
    const { data } = await supabase
      .from('schedules')
      .select(
        `id, starts_at, ends_at, location,
         classes:class_id(name, color),
         profiles:instructor_id(first_name, last_name)`
      )
      .in('id', scheduleIds)
      .gte('starts_at', now)
      .order('starts_at')
      .limit(3)
    upcoming = (data as unknown as UpcomingLesson[]) ?? []
  }

  // Fetch pending subthreshold decision (if any)
  const { data: decisionRow } = await supabase
    .from('subthreshold_decisions')
    .select('id, schedule_id, state')
    .eq('client_id', user.id)
    .eq('state', 'pending')
    .limit(1)
    .maybeSingle()

  let decision: { id: string; className: string; startsAt: string } | null = null
  if (decisionRow) {
    const { data: schedRow } = await supabase
      .from('schedules')
      .select('starts_at, classes:class_id(name)')
      .eq('id', decisionRow.schedule_id)
      .maybeSingle()
    if (schedRow) {
      const s = schedRow as unknown as {
        starts_at: string
        classes: { name: string } | null
      }
      decision = {
        id: decisionRow.id,
        className: s.classes?.name ?? 'Lezione',
        startsAt: s.starts_at,
      }
    }
  }

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="font-inter font-extrabold uppercase tracking-[0.3em] text-[10px] text-meetoo-accent-dark/50 mb-1">
              Studio Pilates &amp; Yoga
            </p>
            <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl sm:text-4xl text-meetoo-accent-dark leading-none">
              MEE TOO
            </h1>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-[10px] px-5 py-2.5 rounded-full transition-colors duration-300 hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light"
            >
              Esci
            </button>
          </form>
        </div>

        {/* ── Decisione sotto-soglia (se presente) ── */}
        {decision && (
          <DecisionCard
            decisionId={decision.id}
            className={decision.className}
            startsAt={decision.startsAt}
          />
        )}

        {/* ── Welcome card ── */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-6 sm:px-8 py-7 mb-8">
          <p className="font-inter font-normal text-[10px] uppercase tracking-[0.25em] text-meetoo-accent-dark/40 mb-2">
            {fmtTodayLong()}
          </p>
          <h2 className="font-inter font-light text-2xl sm:text-3xl text-meetoo-accent-dark leading-snug">
            Ciao,{' '}
            <span className="font-semibold capitalize">{displayName}</span>!
          </h2>
        </div>

        {/* ── Le tue prossime lezioni ── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark">
              Le tue prossime lezioni
            </h3>
            <Link
              href="/palinsesto"
              className="font-inter font-light text-xs text-meetoo-accent-dark/45 hover:text-meetoo-accent-dark transition-colors"
            >
              Vai al palinsesto →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="bg-white/40 rounded-2xl border border-white/70 px-6 py-10 text-center">
              <p className="font-inter font-light text-sm text-meetoo-accent-dark/40 mb-5">
                Nessuna lezione prenotata
              </p>
              <Link
                href="/palinsesto"
                className="inline-block font-inter font-normal uppercase tracking-widest text-[11px] px-7 py-3 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light hover:bg-meetoo-accent-light transition-colors"
              >
                Vai al Palinsesto
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((lesson) => (
                <div
                  key={lesson.id}
                  className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-4 sm:px-5 py-4 flex items-center gap-4 shadow-sm"
                >
                  {/* Color stripe */}
                  <div
                    className="w-1 rounded-full self-stretch shrink-0"
                    style={{ backgroundColor: lesson.classes?.color ?? 'var(--meetoo-accent-light)' }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                      {fmtDay(lesson.starts_at)}
                    </p>
                    <p className="font-inter font-medium text-sm text-meetoo-accent-dark truncate mt-0.5">
                      {lesson.classes?.name ?? '—'}
                    </p>
                    {lesson.profiles && (
                      <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 truncate">
                        {lesson.profiles.first_name} {lesson.profiles.last_name}
                      </p>
                    )}
                    {lesson.location && (
                      <p className="font-inter font-light text-[11px] text-meetoo-accent-dark/35 truncate mt-0.5">
                        {lesson.location}
                      </p>
                    )}
                  </div>

                  {/* Time badge */}
                  <div className="shrink-0 text-right">
                    <p className="font-inter font-semibold text-sm text-meetoo-accent-dark">
                      {fmtTime(lesson.starts_at)}
                    </p>
                    <p className="font-inter font-light text-xs text-meetoo-accent-dark/40">
                      {fmtTime(lesson.ends_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Accesso rapido ── */}
        <section>
          <h3 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-4">
            Accesso rapido
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/palinsesto"
              className="group bg-white/60 backdrop-blur-sm rounded-2xl border border-white/80 px-5 py-7 flex flex-col justify-between gap-6 hover:bg-white/80 transition-colors shadow-sm"
            >
              <Calendar className="w-6 h-6 text-[#2c2c2c]" />
              <div>
                <p className="font-inter font-normal uppercase tracking-widest text-sm text-meetoo-accent-dark">
                  Palinsesto
                </p>
                <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-0.5">
                  Prenota lezioni
                </p>
              </div>
            </Link>

            <Link
              href="/profilo"
              className="group bg-white/60 backdrop-blur-sm rounded-2xl border border-white/80 px-5 py-7 flex flex-col justify-between gap-6 hover:bg-white/80 transition-colors shadow-sm"
            >
              <User className="w-6 h-6 text-[#2c2c2c]" />
              <div>
                <p className="font-inter font-normal uppercase tracking-widest text-sm text-meetoo-accent-dark">
                  Il mio profilo
                </p>
                <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-0.5">
                  Dati &amp; abbonamento
                </p>
              </div>
            </Link>

            <Link
              href="/contenuti"
              className="group bg-white/60 backdrop-blur-sm rounded-2xl border border-white/80 px-5 py-7 flex flex-col justify-between gap-6 hover:bg-white/80 transition-colors shadow-sm"
            >
              <Play className="w-6 h-6 text-[#2c2c2c]" />
              <div>
                <p className="font-inter font-normal uppercase tracking-widest text-sm text-meetoo-accent-dark">
                  Contenuti
                </p>
                <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-0.5">
                  Video on demand
                </p>
              </div>
            </Link>
          </div>
        </section>

      </div>
    </main>
  )
}
