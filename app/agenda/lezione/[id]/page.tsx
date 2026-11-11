import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { linkFoto } from '@/lib/foto'
import Iscritte, { type Cliente, type Iscritta } from './Iscritte'
import AzioniLezione from './AzioniLezione'

// La pagina di una lezione per lo studio (admin e insegnanti: lo garantisce il
// layout di /agenda). Sul modello della "Gestione prenotazioni" di App Palestre:
// iscritte e aggiungi, piu' il menu delle azioni (solo admin).

// Pagina costruita sul server a ogni richiesta: leggere l'ora qui e' voluto.
const adesso = () => Date.now()

type Persona = { first_name: string | null; last_name: string | null; avatar_url: string | null }

type Riga = {
  id: string
  starts_at: string
  ends_at: string
  max_spots: number
  notes: string | null
  is_cancelled: boolean | null
  bookings_locked: boolean
  instructor_id: string | null
  classes: { name: string; color: string | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
  bookings:
    | {
        id: string
        client_id: string
        status: string
        booked_at: string
        booked_by: string
        presenza: 'presente' | 'assente' | null
        fixed_slot_id: string | null
        response: string | null
        reminder_sent_at: string | null
        offered_at: string | null
        offer_expires_at: string | null
        profiles: Persona | null
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

const nomeDi = (p: { first_name: string | null; last_name: string | null } | null) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(' ')

export default async function LezionePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: io } = await supabase.from('profiles').select('role, studio_id').eq('id', user.id).single()
  const ruolo = io?.role === 'admin' ? 'admin' : 'instructor'

  const { data } = await supabase
    .from('schedules')
    .select(
      `id, starts_at, ends_at, max_spots, notes, is_cancelled, bookings_locked, instructor_id,
       classes:class_id(name, color),
       profiles:instructor_id(first_name, last_name),
       bookings(id, client_id, status, booked_at, booked_by, presenza, fixed_slot_id, response, reminder_sent_at, offered_at, offer_expires_at,
         profiles:client_id(first_name, last_name, avatar_url))`
    )
    .eq('id', id)
    .maybeSingle()
  const s = data as unknown as Riga | null
  if (!s) notFound()

  // per l'admin: insegnanti (Modifica) e clienti dello studio (Aggiungi)
  const [insRes, cliRes] =
    ruolo === 'admin'
      ? await Promise.all([
          supabase.from('profiles').select('id, first_name, last_name').eq('studio_id', io!.studio_id).eq('role', 'instructor').eq('is_active', true).order('first_name'),
          supabase.from('profiles').select('id, first_name, last_name, avatar_url').eq('studio_id', io!.studio_id).eq('role', 'client').order('first_name'),
        ])
      : [{ data: [] }, { data: [] }]

  const bookings = s.bookings ?? []
  const clientiRows = (cliRes.data ?? []) as ({ id: string } & Persona)[]
  const foto = await linkFoto(supabase, [...bookings.map((b) => b.profiles?.avatar_url), ...clientiRows.map((c) => c.avatar_url)])

  const righe: Iscritta[] = bookings
    .filter((b) => b.status !== 'cancelled' || b.response === 'non_vengo')
    .map((b): Iscritta => ({
      id: b.id,
      clientId: b.client_id,
      nome: nomeDi(b.profiles) || 'Cliente',
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
      daStudio: b.booked_by === 'studio',
      presenza: b.presenza,
      prenotataIl: b.booked_at,
      // lista d'attesa: posto tenuto per lei (offerta in corso) e fino a quando
      offerta: b.status === 'waitlist' && b.offered_at ? b.offer_expires_at ?? 'in_arrivo' : null,
    }))
    .sort((a, b) => a.prenotataIl.localeCompare(b.prenotataIl))

  const clienti: Cliente[] = clientiRows.map((c) => ({
    id: c.id,
    nome: nomeDi(c) || 'Cliente',
    first: c.first_name,
    last: c.last_name,
    foto: c.avatar_url ? foto.get(c.avatar_url) ?? null : null,
  }))

  const inizio = quando(s.starts_at)
  const fine = quando(s.ends_at)
  const dentro = righe.filter((r) => r.stato !== 'lista' && r.stato !== 'non_viene').length
  const conIscritte = bookings.some((b) => b.status !== 'cancelled')
  const insegnante = nomeDi(s.profiles)
  const passata = new Date(s.starts_at).getTime() <= adesso()

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-wrap items-center justify-between mb-6">
          <Link
            href={`/agenda?giorno=${inizio.iso}`}
            className="inline-flex items-center gap-1.5 font-inter font-light text-[11px] uppercase tracking-widest text-meetoo-accent-dark/45 hover:text-meetoo-accent-dark transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Agenda
          </Link>
          {ruolo === 'admin' && (
            <AzioniLezione
              scheduleId={s.id}
              inizio={s.starts_at}
              fine={s.ends_at}
              insegnanteId={s.instructor_id}
              posti={s.max_spots}
              note={s.notes}
              bloccate={s.bookings_locked}
              annullata={!!s.is_cancelled}
              conIscritte={conIscritte}
              insegnanti={((insRes.data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((i) => ({
                id: i.id,
                nome: nomeDi(i),
              }))}
            />
          )}
        </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-5 sm:px-7 py-6 mb-6 flex gap-4">
          <div className="w-1 rounded-full self-stretch shrink-0" style={{ backgroundColor: s.classes?.color ?? '#a8876a' }} />
          <div className="min-w-0 flex-1">
            <p className="font-inter font-light text-[10px] uppercase tracking-[0.2em] text-meetoo-accent-dark/45">{inizio.giorno}</p>
            <h1 className="font-inter font-semibold text-xl text-meetoo-accent-dark leading-snug mt-1">{s.classes?.name ?? 'Lezione'}</h1>
            <p className="font-inter font-light text-sm text-meetoo-accent-dark/70 mt-0.5">
              dalle {inizio.ora} alle {fine.ora}
              {insegnante ? <> · {insegnante}</> : <> · <span className="text-amber-700">insegnante da assegnare</span></>}
            </p>
            {s.notes && <p className="font-inter font-light text-xs text-meetoo-accent-dark/45 mt-1">{s.notes}</p>}
            {(s.is_cancelled || s.bookings_locked) && (
              <p className={`font-inter font-normal text-[10px] uppercase tracking-widest mt-2 ${s.is_cancelled ? 'text-red-600' : 'text-amber-700'}`}>
                {s.is_cancelled ? 'Annullata' : 'Iscrizioni bloccate'}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-inter font-semibold text-2xl text-meetoo-accent-dark leading-none">
              {dentro}
              <span className="font-light text-meetoo-accent-dark/40">/{s.max_spots}</span>
            </p>
            <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 mt-1">Prenotate</p>
          </div>
        </div>

        <Iscritte scheduleId={s.id} righe={righe} clienti={clienti} ruolo={ruolo} passata={passata || !!s.is_cancelled} />
      </div>
    </main>
  )
}
