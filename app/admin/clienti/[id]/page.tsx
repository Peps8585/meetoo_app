/*
 * ─── SQL: tabella client_notes ────────────────────────────────────────────────
 *
 * CREATE TABLE IF NOT EXISTS client_notes (
 *   id          uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
 *   client_id   uuid         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *   author_id   uuid         NOT NULL REFERENCES profiles(id),
 *   note_text   text         NOT NULL,
 *   studio_id   uuid         NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
 *   created_at  timestamptz  DEFAULT now() NOT NULL
 * );
 *
 * ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
 *
 * -- Admin e instructor dello stesso studio possono leggere e scrivere
 * CREATE POLICY "studio_staff_notes" ON client_notes
 *   FOR ALL
 *   USING (
 *     EXISTS (
 *       SELECT 1 FROM profiles
 *       WHERE profiles.id = auth.uid()
 *         AND profiles.studio_id = client_notes.studio_id
 *         AND profiles.role IN ('admin', 'instructor')
 *     )
 *   )
 *   WITH CHECK (
 *     EXISTS (
 *       SELECT 1 FROM profiles
 *       WHERE profiles.id = auth.uid()
 *         AND profiles.studio_id = client_notes.studio_id
 *         AND profiles.role IN ('admin', 'instructor')
 *     )
 *   );
 *
 * CREATE INDEX IF NOT EXISTS client_notes_client_id_idx ON client_notes(client_id);
 * CREATE INDEX IF NOT EXISTS client_notes_studio_id_idx  ON client_notes(studio_id);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTE: questa pagina è sotto app/admin/ quindi il layout garantisce già
 * l'accesso ai soli utenti con role = 'admin'. Per estendere l'accesso
 * agli istruttori sarà necessario un layout separato (es. /studio/*).
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import NoteForm from './NoteForm'

// ─── types ────────────────────────────────────────────────────────────────────

type ClientProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  role: string
  studio_id: string | null
}

type ClientPackage = {
  id: string
  credits_total: number | null
  credits_used: number | null
  expires_at: string | null
  packages: { name: string } | null
}

type RawBooking = {
  id: string
  status: string
  created_at: string
  schedules: {
    starts_at: string
    classes: { name: string } | null
  } | null
}

type Note = {
  id: string
  note_text: string
  created_at: string
  author: {
    first_name: string | null
    last_name: string | null
    role: string
  } | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confermata',
  cancelled: 'Cancellata',
  pending: 'In attesa',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  )
}

function initials(first: string | null, last: string | null): string {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase()
}

function sessionsBadge(n: number | null): { label: string; cls: string } {
  if (n === null) return { label: '—', cls: 'bg-meetoo-accent-dark/10 text-meetoo-accent-dark/40' }
  if (n === 0)   return { label: '0',          cls: 'bg-red-100 text-red-700' }
  if (n <= 2)    return { label: String(n),     cls: 'bg-amber-100 text-amber-700' }
  return               { label: String(n),     cls: 'bg-meetoo-bg-dark/15 text-meetoo-bg-dark' }
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params

  // Viewer auth — admin layout already enforces role = 'admin'
  const supabase = await createClient()
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()
  if (!viewer) redirect('/login')

  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('role, studio_id')
    .eq('id', viewer.id)
    .single()

  if (!viewerProfile?.studio_id) redirect('/admin/clienti')

  const studioId = viewerProfile.studio_id as string

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY mancante')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Parallel fetch
  const [profileRes, authRes, packagesRes, bookingsRes, notesRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, first_name, last_name, phone, avatar_url, role, studio_id')
      .eq('id', clientId)
      .single(),

    admin.auth.admin.getUserById(clientId),

    admin
      .from('client_packages')
      .select('id, credits_total, credits_used, expires_at, packages:package_id(name)')
      .eq('client_id', clientId)
      .order('expires_at', { ascending: true }),

    admin
      .from('bookings')
      .select(
        `id, status, created_at,
         schedules:schedule_id ( starts_at, classes:class_id ( name ) )`
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10),

    admin
      .from('client_notes')
      .select(
        `id, note_text, created_at,
         author:author_id ( first_name, last_name, role )`
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
  ])

  if (!profileRes.data) redirect('/admin/clienti')

  const profile   = profileRes.data as ClientProfile
  const email     = authRes.data.user?.email ?? null
  const packages  = (packagesRes.data  as unknown as ClientPackage[]) ?? []
  const bookings  = (bookingsRes.data  as unknown as RawBooking[])    ?? []
  const notes     = (notesRes.data     as unknown as Note[])          ?? []

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || '—'

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 sm:p-8 max-w-3xl">

      {/* Back link */}
      <Link
        href="/admin/clienti"
        className="inline-flex items-center gap-1.5 font-inter font-light text-[11px] uppercase tracking-widest text-meetoo-accent-dark/45 hover:text-meetoo-accent-dark transition-colors mb-8"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Torna ai clienti
      </Link>

      {/* ── SEZIONE 1: Header cliente ──────────────────────────────────── */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-6 sm:px-8 py-7 mb-6 shadow-sm">
        <div className="flex items-start gap-5">

          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-meetoo-accent-light/20 flex items-center justify-center">
                <span className="font-inter font-extrabold text-xl text-meetoo-accent-dark/50">
                  {initials(profile.first_name, profile.last_name)}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-inter font-extrabold text-xl text-meetoo-accent-dark leading-tight">
                {displayName}
              </h1>
              <span className="font-inter font-normal text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-meetoo-accent-dark/10 text-meetoo-accent-dark/60">
                {profile.role}
              </span>
            </div>

            <dl className="mt-3 space-y-1.5">
              {email && (
                <div className="flex items-center gap-2">
                  <dt className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 w-16 shrink-0">Email</dt>
                  <dd className="font-inter font-light text-sm text-meetoo-accent-dark truncate">{email}</dd>
                </div>
              )}
              {profile.phone && (
                <div className="flex items-center gap-2">
                  <dt className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 w-16 shrink-0">Tel</dt>
                  <dd className="font-inter font-light text-sm text-meetoo-accent-dark">{profile.phone}</dd>
                </div>
              )}
              <div className="flex items-center gap-2">
                <dt className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 w-16 shrink-0">Iscritto</dt>
                <dd className="font-inter font-light text-sm text-meetoo-accent-dark">
                  {authRes.data.user?.created_at ? fmtDate(authRes.data.user.created_at) : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* ── SEZIONE 2: Pacchetti attivi ────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-3">
          Pacchetti attivi
        </h2>

        {packages.length === 0 ? (
          <div className="bg-white/40 rounded-2xl border border-white/70 px-6 py-8 text-center">
            <p className="font-inter font-light text-sm text-meetoo-accent-dark/35">
              Nessun pacchetto
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => {
              const badge = sessionsBadge((pkg.credits_total ?? 0) - (pkg.credits_used ?? 0))
              return (
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
                        Scade il {fmtDateShort(pkg.expires_at)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <span className={`font-inter font-semibold text-xs px-2.5 py-1 rounded-full ${badge.cls}`}>
                      {badge.label} sessioni
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── SEZIONE 3: Storico prenotazioni ────────────────────────────── */}
      <section className="mb-6">
        <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-3">
          Storico prenotazioni
        </h2>

        {bookings.length === 0 ? (
          <div className="bg-white/40 rounded-2xl border border-white/70 px-6 py-8 text-center">
            <p className="font-inter font-light text-sm text-meetoo-accent-dark/35">
              Nessuna prenotazione
            </p>
          </div>
        ) : (
          <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl shadow-sm overflow-hidden">
            {bookings.map((b, i) => (
              <div
                key={b.id}
                className={[
                  'flex items-center justify-between gap-4 px-5 py-3.5',
                  i < bookings.length - 1 ? 'border-b border-meetoo-accent-dark/5' : '',
                ].join(' ')}
              >
                <div className="min-w-0">
                  <p className="font-inter font-medium text-sm text-meetoo-accent-dark truncate">
                    {b.schedules?.classes?.name ?? '—'}
                  </p>
                  <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-0.5">
                    {b.schedules?.starts_at ? fmtDateTime(b.schedules.starts_at) : '—'}
                  </p>
                </div>
                <span
                  className={[
                    'shrink-0 font-inter font-normal text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full',
                    b.status === 'confirmed'
                      ? 'bg-meetoo-bg-dark/15 text-meetoo-bg-dark'
                      : 'bg-meetoo-accent-dark/8 text-meetoo-accent-dark/45',
                  ].join(' ')}
                >
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── SEZIONE 4: Note ────────────────────────────────────────────── */}
      <section>
        <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-3">
          Note
        </h2>

        {/* Existing notes */}
        {notes.length > 0 && (
          <div className="space-y-2 mb-5">
            {notes.map((note) => {
              const isAdmin = note.author?.role === 'admin'
              return (
                <div
                  key={note.id}
                  className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-4 shadow-sm"
                >
                  <p className="font-inter font-light text-sm text-meetoo-accent-dark leading-relaxed mb-3">
                    {note.note_text}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={[
                        'font-inter font-normal text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full',
                        isAdmin
                          ? 'bg-meetoo-bg-dark/15 text-meetoo-bg-dark'
                          : 'bg-blue-100 text-blue-700',
                      ].join(' ')}
                    >
                      {isAdmin ? 'Admin' : 'Istruttore'}
                    </span>
                    <span className="font-inter font-light text-xs text-meetoo-accent-dark/50">
                      {note.author?.first_name} {note.author?.last_name}
                    </span>
                    <span className="font-inter font-light text-[10px] text-meetoo-accent-dark/30">
                      · {fmtDateShort(note.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add note form */}
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 sm:px-6 py-5 shadow-sm">
          <NoteForm
            clientId={clientId}
            studioId={studioId}
            authorId={viewer.id}
          />
        </div>
      </section>

    </div>
  )
}
