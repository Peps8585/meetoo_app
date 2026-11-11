import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, User, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'
import { Logo } from '../Logo'
import DecisionCard from './DecisionCard'
import Notifiche from './Notifiche'

// Pagina costruita sul server a ogni richiesta: leggere l'ora qui e' voluto.
const adesso = () => Date.now()


type Profile = {
  first_name: string | null
  last_name: string | null
}

type MiaPrenotazione = {
  schedule_id: string
  status: 'confirmed' | 'held' | 'waitlist'
  fixed_slot_id: string | null
  action_token: string
  response: string | null
  reminder_sent_at: string | null
  offered_at: string | null
}

type UpcomingLesson = {
  id: string
  starts_at: string
  ends_at: string
  location: string | null
  instructor_id: string | null
  classes: { name: string; color: string | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  })
}

// La pagina si costruisce sul server (Vercel gira in UTC): l'ora va resa esplicita.
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
}

function fmtTodayLong(): string {
  return new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)

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

  // Prossime lezioni: prenotate, posto fisso (anche tenuto) e lista d'attesa
  const now = new Date().toISOString()

  const { data: rawBookings } = await supabase
    .from('bookings')
    .select('schedule_id, status, fixed_slot_id, action_token, response, reminder_sent_at, offered_at')
    .eq('client_id', user.id)
    .in('status', ['confirmed', 'held', 'waitlist'])

  const mie = new Map<string, MiaPrenotazione>()
  for (const b of (rawBookings ?? []) as MiaPrenotazione[]) mie.set(b.schedule_id, b)
  const scheduleIds = [...mie.keys()]

  // nome e cognome delle insegnanti: una cliente non legge i loro profili
  const { data: nomiRows } = await supabase.rpc('nomi_insegnanti')
  const insegnanti = new Map(
    ((nomiRows ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((n) => [
      n.id,
      [n.first_name, n.last_name].filter(Boolean).join(' '),
    ])
  )

  let upcoming: UpcomingLesson[] = []
  if (scheduleIds.length > 0) {
    const { data } = await supabase
      .from('schedules')
      .select(
        `id, starts_at, ends_at, location, instructor_id,
         classes:class_id(name, color),
         profiles:instructor_id(first_name, last_name)`
      )
      .in('id', scheduleIds)
      .gte('starts_at', now)
      .order('starts_at')
      .limit(4)
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
  let targets: { id: string; starts_at: string; className: string }[] = []
  if (decisionRow) {
    const { data: schedRow } = await supabase
      .from('schedules')
      .select('class_id, starts_at, classes:class_id(name)')
      .eq('id', decisionRow.schedule_id)
      .maybeSingle()
    if (schedRow) {
      const s = schedRow as unknown as {
        class_id: string
        starts_at: string
        classes: { name: string } | null
      }
      decision = {
        id: decisionRow.id,
        className: s.classes?.name ?? 'Lezione',
        startsAt: s.starts_at,
      }

      // Lezioni target per lo spostamento (opzione A): stessa disciplina,
      // oltre le 12h, diverse dall'originale. Il filtro posti-disponibili
      // (current_bookings < max_spots) NON è esprimibile in PostgREST → in JS.
      const targetFrom = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
      const { data: targetRows } = await supabase
        .from('schedules')
        .select('id, starts_at, max_spots, current_bookings, classes:class_id(name)')
        .eq('class_id', s.class_id)
        .gt('starts_at', targetFrom)
        .neq('id', decisionRow.schedule_id)
        .eq('is_cancelled', false)
        .order('starts_at')

      const rows =
        (targetRows as unknown as {
          id: string
          starts_at: string
          max_spots: number
          current_bookings: number
          classes: { name: string } | null
        }[]) ?? []

      targets = rows
        .filter((r) => (r.current_bookings ?? 0) < (r.max_spots ?? 0))
        .map((r) => ({
          id: r.id,
          starts_at: r.starts_at,
          className: r.classes?.name ?? 'Lezione',
        }))
    }
  }

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="sr-only">La tua area Mee Too</h1>
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-10">
          <Logo
            variant="compact"
            className="text-meetoo-accent-dark [--mt-logo-w:96px] sm:[--mt-logo-w:112px]"
          />

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
            targets={targets}
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

        <Notifiche />

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
                    {(lesson.profiles || (lesson.instructor_id && insegnanti.get(lesson.instructor_id))) && (
                      <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 truncate">
                        {lesson.profiles
                          ? `${lesson.profiles.first_name ?? ''} ${lesson.profiles.last_name ?? ''}`.trim()
                          : insegnanti.get(lesson.instructor_id!)}
                      </p>
                    )}
                    {lesson.location && (
                      <p className="font-inter font-light text-[11px] text-meetoo-accent-dark/35 truncate mt-0.5">
                        {lesson.location}
                      </p>
                    )}
                    <StatoPrenotazione b={mie.get(lesson.id)} startsAt={lesson.starts_at} />
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

// Sotto ogni lezione: posto fisso, risposta al promemoria, lista d'attesa.
// "Rispondi" apre la stessa pagina della notifica (/presenza/<codice>).
function StatoPrenotazione({ b, startsAt }: { b?: MiaPrenotazione; startsAt: string }) {
  if (!b) return null
  const prima24 = new Date(startsAt).getTime() - adesso() > 24 * 60 * 60 * 1000
  const etichetta = 'font-inter font-normal text-[10px] uppercase tracking-widest mt-1'

  if (b.status === 'waitlist' && b.offered_at)
    return (
      <Link
        href={`/presenza/${b.action_token}`}
        className="inline-block mt-2 font-inter font-normal uppercase tracking-widest text-[10px] px-4 py-1.5 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light"
      >
        Posto libero per te · Rispondi
      </Link>
    )
  if (b.status === 'waitlist')
    return (
      <Link href={`/presenza/${b.action_token}`} className={`${etichetta} inline-block text-meetoo-accent-light`}>
        In lista d&apos;attesa →
      </Link>
    )
  if (!b.fixed_slot_id) return null
  if (b.response === 'ci_sono')
    return <p className={`${etichetta} text-meetoo-bg-dark`}>Posto fisso · hai confermato</p>
  if (b.reminder_sent_at && prima24)
    return (
      <Link
        href={`/presenza/${b.action_token}`}
        className="inline-block mt-2 font-inter font-normal uppercase tracking-widest text-[10px] px-4 py-1.5 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light"
      >
        Ci sei? Rispondi
      </Link>
    )
  return (
    <Link href={`/presenza/${b.action_token}`} className={`${etichetta} inline-block text-meetoo-bg-dark`}>
      Il tuo posto fisso
    </Link>
  )
}
