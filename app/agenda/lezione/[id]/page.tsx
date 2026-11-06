import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { linkFoto } from '@/lib/foto'
import Iscritte, { type Iscritta } from './Iscritte'

// La pagina di una lezione per lo studio (admin e insegnanti: lo garantisce il
// layout di /agenda). Sul modello della "Gestione prenotazioni" di App Palestre.

type Riga = {
  id: string
  starts_at: string
  ends_at: string
  max_spots: number
  notes: string | null
  is_cancelled: boolean | null
  classes: { name: string; color: string | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
  bookings:
    | {
        id: string
        status: string
        booked_at: string
        fixed_slot_id: string | null
        response: string | null
        reminder_sent_at: string | null
        profiles: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null
      }[]
    | null
}

function quando(iso: string) {
  const d = new Date(iso)
  return {
    giorno: d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }),
    ora: d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
    iso: d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }), // yyyy-mm-dd
  }
}

export default async function LezionePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('schedules')
    .select(
      `id, starts_at, ends_at, max_spots, notes, is_cancelled,
       classes:class_id(name, color),
       profiles:instructor_id(first_name, last_name),
       bookings(id, status, booked_at, fixed_slot_id, response, reminder_sent_at,
         profiles:client_id(first_name, last_name, avatar_url))`
    )
    .eq('id', id)
    .maybeSingle()
  const s = data as unknown as Riga | null
  if (!s) notFound()

  const inizio = quando(s.starts_at)
  const fine = quando(s.ends_at)
  const bookings = s.bookings ?? []
  const foto = await linkFoto(supabase, bookings.map((b) => b.profiles?.avatar_url))

  const righe: Iscritta[] = bookings
    .filter((b) => b.status !== 'cancelled' || b.response === 'non_vengo')
    .map((b): Iscritta => ({
      id: b.id,
      nome: [b.profiles?.first_name, b.profiles?.last_name].filter(Boolean).join(' ') || 'Cliente',
      first: b.profiles?.first_name ?? null,
      last: b.profiles?.last_name ?? null,
      foto: b.profiles?.avatar_url ? foto.get(b.profiles.avatar_url) ?? null : null,
      stato:
        b.status === 'waitlist'
          ? 'lista'
          : b.status === 'cancelled'
            ? 'non_viene'
            : !b.fixed_slot_id || b.response === 'ci_sono'
              ? 'confermata'
              : b.reminder_sent_at
                ? 'non_ha_risposto'
                : 'fissa_in_attesa',
      fissa: !!b.fixed_slot_id,
      prenotataIl: b.booked_at,
    }))
    .sort((a, b) => a.prenotataIl.localeCompare(b.prenotataIl))

  const dentro = righe.filter((r) => r.stato !== 'lista' && r.stato !== 'non_viene').length
  const insegnante = [s.profiles?.first_name, s.profiles?.last_name].filter(Boolean).join(' ')

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/agenda?giorno=${inizio.iso}`}
          className="inline-flex items-center gap-1.5 font-inter font-light text-[11px] uppercase tracking-widest text-meetoo-accent-dark/45 hover:text-meetoo-accent-dark transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Agenda
        </Link>

        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-5 sm:px-7 py-6 mb-6 flex gap-4">
          <div className="w-1 rounded-full self-stretch shrink-0" style={{ backgroundColor: s.classes?.color ?? '#a8876a' }} />
          <div className="min-w-0 flex-1">
            <p className="font-inter font-light text-[10px] uppercase tracking-[0.2em] text-meetoo-accent-dark/45">
              {inizio.giorno}
            </p>
            <h1 className="font-inter font-semibold text-xl text-meetoo-accent-dark leading-snug mt-1">
              {s.classes?.name ?? 'Lezione'}
            </h1>
            <p className="font-inter font-light text-sm text-meetoo-accent-dark/70 mt-0.5">
              dalle {inizio.ora} alle {fine.ora}
              {insegnante && <> · {insegnante}</>}
            </p>
            {s.notes && <p className="font-inter font-light text-xs text-meetoo-accent-dark/45 mt-1">{s.notes}</p>}
            {s.is_cancelled && (
              <p className="font-inter font-normal text-[10px] uppercase tracking-widest text-red-600 mt-2">Annullata</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-inter font-semibold text-2xl text-meetoo-accent-dark leading-none">
              {dentro}
              <span className="font-light text-meetoo-accent-dark/40">/{s.max_spots}</span>
            </p>
            <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 mt-1">
              Prenotate
            </p>
          </div>
        </div>

        <Iscritte righe={righe} />
      </div>
    </main>
  )
}
