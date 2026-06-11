import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

type Profile = {
  first_name: string | null
  last_name: string | null
  phone: string | null
}

type ClientPackage = {
  id: string
  credits_total: number
  credits_used: number
  expires_at: string | null
  is_active: boolean
  packages: { name: string } | null
}

type BookingRow = {
  id: string
  schedule_id: string
  status: string
  created_at: string
}

type ScheduleRow = {
  id: string
  starts_at: string
  classes: { name: string; color: string | null } | null
}

type HistoryItem = {
  bookingId: string
  status: string
  starts_at: string
  className: string
  classColor: string | null
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confermata',
  cancelled: 'Cancellata',
  pending: 'In attesa',
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function ProfiloPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ── Dati personali ──────────────────────────────────────────────────
  const { data: profileData } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null

  // ── Pacchetti attivi ────────────────────────────────────────────────
  const now = new Date().toISOString()
  const { data: packagesData } = await supabase
    .from('client_packages')
    .select('id, credits_total, credits_used, expires_at, is_active, packages:package_id(name)')
    .eq('client_id', user.id)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('expires_at', { ascending: true })

  const activePackages = (packagesData as unknown as ClientPackage[]) ?? []

  // ── Storico prenotazioni (ultime 5) ─────────────────────────────────
  const { data: rawBookings } = await supabase
    .from('bookings')
    .select('id, schedule_id, status, created_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const recentBookings = (rawBookings as BookingRow[]) ?? []

  let historyItems: HistoryItem[] = []
  if (recentBookings.length > 0) {
    const scheduleIds = recentBookings.map((b) => b.schedule_id)

    const { data: schedulesData } = await supabase
      .from('schedules')
      .select('id, starts_at, classes:class_id(name, color)')
      .in('id', scheduleIds)

    const schedules = (schedulesData as unknown as ScheduleRow[]) ?? []
    const scheduleMap = new Map(schedules.map((s) => [s.id, s]))

    historyItems = recentBookings.map((b) => {
      const sched = scheduleMap.get(b.schedule_id)
      return {
        bookingId: b.id,
        status: b.status,
        starts_at: sched?.starts_at ?? b.created_at,
        className: sched?.classes?.name ?? '—',
        classColor: sched?.classes?.color ?? null,
      }
    })
  }

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">

        {/* ── Back link + Title ── */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 font-inter font-light text-[11px] uppercase tracking-widest text-meetoo-accent-dark/45 hover:text-meetoo-accent-dark transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl sm:text-4xl text-meetoo-accent-dark leading-none">
            Il mio profilo
          </h1>
        </div>

        {/* ── Dati personali ── */}
        <section className="mb-8">
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-4">
            Dati personali
          </h2>

          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-6 sm:px-8 py-6">
            <dl className="space-y-0">
              {(
                [
                  { label: 'Nome', value: profile?.first_name },
                  { label: 'Cognome', value: profile?.last_name },
                  { label: 'Email', value: user.email },
                  { label: 'Telefono', value: profile?.phone },
                ] as { label: string; value: string | null | undefined }[]
              ).map((field, i) => (
                <div key={field.label}>
                  {i > 0 && <div className="h-px bg-meetoo-accent-dark/5 my-4" />}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <dt className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                      {field.label}
                    </dt>
                    <dd className="font-inter font-normal text-sm text-meetoo-accent-dark">
                      {field.value ?? '—'}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="mt-6 pt-5 border-t border-meetoo-accent-dark/5">
              <button
                type="button"
                className="font-inter font-normal uppercase tracking-widest text-[11px] px-6 py-3 rounded-full border border-meetoo-accent-dark/30 text-meetoo-accent-dark hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors duration-300"
              >
                Modifica dati
              </button>
            </div>
          </div>
        </section>

        {/* ── I miei pacchetti ── */}
        <section className="mb-8">
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-4">
            I miei pacchetti
          </h2>

          {activePackages.length === 0 ? (
            <div className="bg-white/40 rounded-2xl border border-white/70 px-6 py-10 text-center">
              <Package className="w-5 h-5 text-meetoo-accent-dark/20 mx-auto mb-3" />
              <p className="font-inter font-light text-sm text-meetoo-accent-dark/40">
                Nessun pacchetto attivo
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activePackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="font-inter font-medium text-sm text-meetoo-accent-dark truncate">
                      {pkg.packages?.name ?? '—'}
                    </p>
                    {pkg.expires_at && (
                      <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-0.5">
                        Scade il {fmtDateLong(pkg.expires_at)}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-inter font-semibold text-xl text-meetoo-accent-dark leading-none">
                      {pkg.credits_total - pkg.credits_used} / {pkg.credits_total}
                    </p>
                    <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 mt-0.5">
                      lezioni
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Storico prenotazioni ── */}
        <section>
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-4">
            Storico prenotazioni
          </h2>

          {historyItems.length === 0 ? (
            <div className="bg-white/40 rounded-2xl border border-white/70 px-6 py-10 text-center">
              <Clock className="w-5 h-5 text-meetoo-accent-dark/20 mx-auto mb-3" />
              <p className="font-inter font-light text-sm text-meetoo-accent-dark/40">
                Nessuna prenotazione effettuata
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyItems.map((item) => (
                <div
                  key={item.bookingId}
                  className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-4 sm:px-5 py-4 flex items-center gap-4 shadow-sm"
                >
                  {/* Color stripe */}
                  <div
                    className="w-1 rounded-full self-stretch shrink-0"
                    style={{
                      backgroundColor: item.classColor ?? 'var(--meetoo-accent-light)',
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-medium text-sm text-meetoo-accent-dark truncate">
                      {item.className}
                    </p>
                    <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-0.5">
                      {fmtDateShort(item.starts_at)}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={[
                      'shrink-0 font-inter font-normal text-[10px] uppercase tracking-widest px-3 py-1 rounded-full',
                      item.status === 'confirmed'
                        ? 'bg-meetoo-bg-dark/15 text-meetoo-bg-dark'
                        : 'bg-meetoo-accent-dark/10 text-meetoo-accent-dark/50',
                    ].join(' ')}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
