import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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

  // Fetch next 3 confirmed bookings
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

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-6 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <p className="font-inter font-extrabold uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/60 mb-1">
              Studio Pilates &amp; Yoga
            </p>
            <h1 className="font-inter font-extrabold uppercase tracking-widest text-4xl text-meetoo-accent-dark leading-none">
              MEE TOO
            </h1>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full transition-colors duration-300 hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light"
            >
              Esci
            </button>
          </form>
        </div>

        {/* Welcome */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-8 py-8 mb-8">
          <p className="font-inter font-extrabold uppercase tracking-widest text-xs text-meetoo-accent-dark/50 mb-3">
            Area riservata
          </p>
          <h2 className="font-inter font-light text-2xl text-meetoo-accent-dark">
            Benvenuta,{' '}
            <span className="font-normal">{user.email}</span>
          </h2>
        </div>

        {/* Upcoming booked lessons */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-inter font-extrabold uppercase tracking-widest text-xs text-meetoo-accent-dark">
              Prossime lezioni
            </h3>
            <Link
              href="/palinsesto"
              className="font-inter font-light text-xs text-meetoo-accent-dark/50 hover:text-meetoo-accent-dark transition-colors"
            >
              Vai al palinsesto →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="bg-white/40 rounded-2xl border border-white/80 px-6 py-10 text-center">
              <p className="font-inter font-light text-sm text-meetoo-accent-dark/40 mb-4">
                Nessuna lezione prenotata
              </p>
              <Link
                href="/palinsesto"
                className="inline-block font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light hover:bg-meetoo-accent-light transition-colors"
              >
                Prenota una lezione
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((lesson) => (
                <div
                  key={lesson.id}
                  className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm"
                >
                  {/* Color stripe */}
                  <div
                    className="w-1 rounded-full self-stretch shrink-0"
                    style={{ backgroundColor: lesson.classes?.color ?? '#a8876a' }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                      {fmtDay(lesson.starts_at)}
                    </p>
                    <p className="font-inter font-medium text-meetoo-accent-dark truncate mt-0.5">
                      {lesson.classes?.name ?? '—'}
                    </p>
                    {lesson.profiles && (
                      <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 truncate">
                        {lesson.profiles.first_name} {lesson.profiles.last_name}
                      </p>
                    )}
                    {lesson.location && (
                      <p className="font-inter font-light text-xs text-meetoo-accent-dark/35 truncate">
                        {lesson.location}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="shrink-0 text-right">
                    <p className="font-inter font-medium text-sm text-meetoo-accent-dark">
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

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/palinsesto"
            className="group bg-white/60 backdrop-blur-sm rounded-2xl border border-white/80 px-6 py-8 flex items-center justify-between hover:bg-white/80 transition-colors shadow-sm"
          >
            <span className="font-inter font-normal uppercase tracking-widest text-sm text-meetoo-accent-dark">
              Palinsesto
            </span>
            <span className="text-meetoo-accent-dark/30 group-hover:text-meetoo-accent-light transition-colors text-lg">
              →
            </span>
          </Link>

          <div className="bg-white/40 rounded-2xl border border-white/80 px-6 py-8 flex items-center justify-between">
            <span className="font-inter font-normal uppercase tracking-widest text-sm text-meetoo-accent-dark/40">
              Il mio profilo
            </span>
            <span className="text-meetoo-accent-dark/20 text-lg">→</span>
          </div>
        </div>
      </div>
    </main>
  )
}
