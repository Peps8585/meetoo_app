'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── types ───────────────────────────────────────────────────────────────────

type WeekSchedule = {
  id: string
  starts_at: string
  max_spots: number
  current_bookings: number
  classes: { name: string } | null
}

type ExpiringPkg = {
  id: string
  expires_at: string
  profiles: { first_name: string | null; last_name: string | null } | null
  packages: { name: string } | null
}

type UnderHalfItem = {
  id: string
  name: string
  starts_at: string
  booked: number
  max: number
}

type KpiData = {
  todayCount: number
  weekCount: number
  avgOccupancy: number
  underHalf: UnderHalfItem[]
  totalClients: number
  newThisMonth: number
  newLastMonth: number
  inactiveCount: number
  expiringPackages: ExpiringPkg[]
}

// ─── date helpers ─────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  const pulse = 'animate-pulse bg-meetoo-accent-dark/8 rounded-2xl'
  return (
    <div className="space-y-10">
      {[0, 1].map((s) => (
        <div key={s} className="space-y-4">
          <div className="h-2.5 w-44 animate-pulse bg-meetoo-accent-dark/10 rounded-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`${pulse} h-28`} />
            <div className={`${pulse} h-28`} />
            <div className={`${pulse} h-28`} />
            <div className={`${pulse} h-44`} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── shared card primitives ───────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark shrink-0">
        {children}
      </h2>
      <div className="flex-1 h-px bg-meetoo-accent-dark/10" />
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  warn = false,
}: {
  label: string
  value: string | number
  sub?: React.ReactNode
  warn?: boolean
}) {
  return (
    <div
      className={[
        'bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-5 shadow-sm flex flex-col justify-between gap-3 border',
        warn ? 'border-meetoo-accent-light/40' : 'border-white/80',
      ].join(' ')}
    >
      <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
        {label}
      </p>
      <p className="font-inter font-extrabold text-3xl text-meetoo-accent-dark leading-none">
        {value}
      </p>
      {sub && <div>{sub}</div>}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) { setError('Non autenticato'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, studio_id')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' || !profile.studio_id) {
      setError('Accesso riservato agli amministratori')
      setLoading(false)
      return
    }
    const studioId = profile.studio_id as string

    // ── date boundaries ──────────────────────────────────────────────────
    const now = new Date()

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)

    const weekStart = getMonday(now)
    const weekEnd   = addDays(weekStart, 7)

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const thirtyDaysAgo      = addDays(now, -30)
    const fourteenDaysFromNow = addDays(now, 14)

    // ── single round of parallel queries ────────────────────────────────
    const [todayRes, weekRes, clientsRes, recentActiveRes, expiringRes] =
      await Promise.all([
        // Lezioni oggi
        supabase
          .from('schedules')
          .select('id')
          .eq('studio_id', studioId)
          .gte('starts_at', todayStart.toISOString())
          .lte('starts_at', todayEnd.toISOString()),

        // Lezioni questa settimana (current_bookings già in colonna)
        supabase
          .from('schedules')
          .select('id, starts_at, max_spots, current_bookings, classes:class_id(name)')
          .eq('studio_id', studioId)
          .gte('starts_at', weekStart.toISOString())
          .lt('starts_at', weekEnd.toISOString())
          .order('starts_at'),

        // Tutti i clienti
        supabase
          .from('profiles')
          .select('id, created_at')
          .eq('role', 'client'),

        // Clienti con almeno 1 prenotazione confermata negli ultimi 30gg
        supabase
          .from('bookings')
          .select('client_id')
          .eq('status', 'confirmed')
          .gte('created_at', thirtyDaysAgo.toISOString()),

        // Pacchetti in scadenza nei prossimi 14gg
        supabase
          .from('client_packages')
          .select(
            'id, expires_at, profiles:client_id(first_name, last_name), packages:package_id(name)'
          )
          .gte('expires_at', now.toISOString())
          .lte('expires_at', fourteenDaysFromNow.toISOString())
          .order('expires_at', { ascending: true })
          .limit(5),
      ])

    // ── compute KPIs ─────────────────────────────────────────────────────
    const weekSchedules = (weekRes.data as unknown as WeekSchedule[]) ?? []

    const totalSpots  = weekSchedules.reduce((n, s) => n + (s.max_spots ?? 0), 0)
    const totalBooked = weekSchedules.reduce((n, s) => n + (s.current_bookings ?? 0), 0)
    const avgOccupancy = totalSpots > 0 ? Math.round((totalBooked / totalSpots) * 100) : 0

    const underHalf: UnderHalfItem[] = weekSchedules
      .map((s) => ({
        id: s.id,
        name: s.classes?.name ?? '—',
        starts_at: s.starts_at,
        booked: s.current_bookings ?? 0,
        max: s.max_spots ?? 0,
      }))
      .filter((s) => s.max === 0 || s.booked / s.max < 0.5)
      .slice(0, 5)

    const allClients  = clientsRes.data ?? []
    const totalClients = allClients.length

    const newThisMonth = allClients.filter(
      (c) => new Date(c.created_at) >= thisMonthStart
    ).length
    const newLastMonth = allClients.filter((c) => {
      const d = new Date(c.created_at)
      return d >= lastMonthStart && d < thisMonthStart
    }).length

    const activeIds = new Set(
      (recentActiveRes.data ?? []).map((b: { client_id: string }) => b.client_id)
    )
    const inactiveCount = allClients.filter((c) => !activeIds.has(c.id)).length

    setKpi({
      todayCount: todayRes.data?.length ?? 0,
      weekCount: weekSchedules.length,
      avgOccupancy,
      underHalf,
      totalClients,
      newThisMonth,
      newLastMonth,
      inactiveCount,
      expiringPackages: (expiringRes.data as unknown as ExpiringPkg[]) ?? [],
    })
    setLoading(false)
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 sm:p-8 max-w-4xl">

      {/* Header */}
      <div className="mb-10">
        <p className="font-inter font-normal uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/50 mb-1">
          Admin
        </p>
        <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl text-meetoo-accent-dark">
          Dashboard
        </h1>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-inter font-light text-sm">
          {error}
        </div>
      )}

      {loading && <Skeleton />}

      {!loading && kpi && (
        <div className="space-y-10">

          {/* ══ SEZIONE 1: Palinsesto & Lezioni ══════════════════════════ */}
          <section>
            <SectionTitle>Palinsesto &amp; Lezioni</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <KpiCard label="Lezioni oggi" value={kpi.todayCount} />

              <KpiCard label="Lezioni questa settimana" value={kpi.weekCount} />

              <KpiCard
                label="Occupazione media settimana"
                value={`${kpi.avgOccupancy}%`}
                warn={kpi.avgOccupancy < 50}
              />

              {/* Lezioni sotto 50% */}
              <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-5 shadow-sm flex flex-col gap-3">
                <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                  Lezioni sotto 50% occupazione
                </p>

                {kpi.underHalf.length === 0 ? (
                  <p className="font-inter font-light text-sm text-meetoo-accent-dark/30 py-4 text-center">
                    Nessuna lezione sotto soglia
                  </p>
                ) : (
                  <div className="overflow-y-auto max-h-40 space-y-2.5 pr-0.5">
                    {kpi.underHalf.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-inter font-medium text-sm text-meetoo-accent-dark truncate">
                            {item.name}
                          </p>
                          <p className="font-inter font-light text-xs text-meetoo-accent-dark/40">
                            {fmtDateShort(item.starts_at)} · {fmtTime(item.starts_at)}
                          </p>
                        </div>
                        <span className="shrink-0 font-inter text-xs text-meetoo-accent-dark/55 bg-meetoo-accent-dark/5 rounded-full px-2.5 py-0.5">
                          {item.booked}/{item.max}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </section>

          {/* ══ SEZIONE 2: Clienti & Retention ═══════════════════════════ */}
          <section>
            <SectionTitle>Clienti &amp; Retention</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <KpiCard label="Clienti totali attivi" value={kpi.totalClients} />

              <KpiCard
                label="Nuovi iscritti questo mese"
                value={kpi.newThisMonth}
                sub={
                  <div className="flex items-center gap-1.5">
                    <span
                      className={[
                        'font-inter font-semibold text-sm',
                        kpi.newThisMonth > kpi.newLastMonth
                          ? 'text-meetoo-bg-dark'
                          : kpi.newThisMonth < kpi.newLastMonth
                            ? 'text-red-400'
                            : 'text-meetoo-accent-dark/30',
                      ].join(' ')}
                    >
                      {kpi.newThisMonth > kpi.newLastMonth
                        ? '↑'
                        : kpi.newThisMonth < kpi.newLastMonth
                          ? '↓'
                          : '→'}
                    </span>
                    <span className="font-inter font-light text-xs text-meetoo-accent-dark/40">
                      {kpi.newLastMonth} il mese scorso
                    </span>
                  </div>
                }
              />

              <KpiCard
                label="Inattivi da 30+ giorni"
                value={kpi.inactiveCount}
                warn={kpi.inactiveCount > 0}
              />

              {/* Pacchetti in scadenza */}
              <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-5 shadow-sm flex flex-col gap-3">
                <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                  Pacchetti in scadenza (14 giorni)
                </p>

                {kpi.expiringPackages.length === 0 ? (
                  <p className="font-inter font-light text-sm text-meetoo-accent-dark/30 py-4 text-center">
                    Nessun pacchetto in scadenza
                  </p>
                ) : (
                  <div className="overflow-y-auto max-h-40 space-y-2.5 pr-0.5">
                    {kpi.expiringPackages.map((pkg) => (
                      <div key={pkg.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-inter font-medium text-sm text-meetoo-accent-dark truncate">
                            {pkg.profiles?.first_name} {pkg.profiles?.last_name}
                          </p>
                          <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 truncate">
                            {pkg.packages?.name ?? '—'}
                          </p>
                        </div>
                        <span className="shrink-0 font-inter text-xs text-meetoo-accent-light bg-meetoo-accent-light/10 rounded-full px-2.5 py-0.5">
                          {fmtDateShort(pkg.expires_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </section>

          {/* ══ SEZIONE 3: Fatturazione placeholder ══════════════════════ */}
          <section>
            <SectionTitle>Fatturazione</SectionTitle>
            <div className="border-2 border-dashed border-meetoo-accent-dark/15 rounded-2xl px-8 py-10 text-center opacity-50">
              <p className="font-inter font-extrabold uppercase tracking-widest text-sm text-meetoo-accent-dark mb-2">
                Incassi &amp; Fatturazione
              </p>
              <p className="font-inter font-light text-sm text-meetoo-accent-dark/60">
                Disponibile dalla Fase 4
              </p>
            </div>
          </section>

        </div>
      )}
    </div>
  )
}
