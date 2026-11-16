import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'

// Le mie prenotazioni: le lezioni in arrivo con il loro stato (prenotata, posto
// fisso, in lista d'attesa) e lo storico. Per cancellare o rispondere si apre la
// stessa pagina degli avvisi (/presenza/<codice>), che applica le regole di sempre.

export const dynamic = 'force-dynamic'

type Riga = {
  id: string
  status: string
  action_token: string
  fixed_slot_id: string | null
  response: string | null
  offered_at: string | null
  schedules: {
    starts_at: string
    ends_at: string
    instructor_id: string | null
    sostituta_id: string | null
    is_cancelled: boolean | null
    classes: { name: string; color: string | null } | null
  } | null
}

const adesso = () => Date.now()

// quante lezioni in arrivo restano in vista senza toccare niente
const IN_VISTA = 3

const apri =
  'block cursor-pointer list-none rounded-full border border-meetoo-accent-dark/25 py-3 text-center font-inter text-[11px] uppercase tracking-widest text-meetoo-accent-dark [&::-webkit-details-marker]:hidden'

function quando(iso: string) {
  const d = new Date(iso)
  return {
    giorno: d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }),
    ora: d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
  }
}

function stato(r: Riga, futura: boolean): { testo: string; cls: string } {
  if (r.schedules?.is_cancelled) return { testo: 'Lezione annullata', cls: 'text-amber-700' }
  if (r.status === 'waitlist')
    return r.offered_at
      ? { testo: 'Posto libero per te', cls: 'text-meetoo-accent-dark font-medium' }
      : { testo: 'In lista d’attesa', cls: 'text-meetoo-accent-light' }
  if (r.status === 'cancelled') return { testo: r.response === 'non_vengo' ? 'Hai liberato il posto' : 'Cancellata', cls: 'text-meetoo-accent-dark/40' }
  if (!futura) return { testo: 'Fatta', cls: 'text-meetoo-bg-dark' }
  if (r.fixed_slot_id) return { testo: r.response === 'ci_sono' ? 'Posto fisso · confermata' : 'Il tuo posto fisso', cls: 'text-meetoo-bg-dark' }
  return { testo: 'Prenotata', cls: 'text-meetoo-bg-dark' }
}

export default async function PrenotazioniPage() {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)
  if (!user) redirect('/login')

  const [{ data }, { data: nomiRows }] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        `id, status, action_token, fixed_slot_id, response, offered_at,
         schedules:schedule_id!inner(starts_at, ends_at, instructor_id, sostituta_id, is_cancelled, classes:class_id(name, color))`
      )
      .eq('client_id', user.id)
      .in('status', ['confirmed', 'held', 'waitlist', 'attended', 'cancelled'])
      .order('starts_at', { referencedTable: 'schedules', ascending: true }),
    supabase.rpc('nomi_insegnanti'),
  ])
  const insegnanti = new Map(
    ((nomiRows ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((n) => [
      n.id,
      [n.first_name, n.last_name].filter(Boolean).join(' '),
    ])
  )

  const ora = adesso()
  const righe = ((data ?? []) as unknown as Riga[]).filter((r) => r.schedules)
  const inArrivo = righe
    .filter((r) => new Date(r.schedules!.starts_at).getTime() > ora && r.status !== 'cancelled')
    .sort((a, b) => a.schedules!.starts_at.localeCompare(b.schedules!.starts_at))
  const storico = righe
    .filter((r) => new Date(r.schedules!.starts_at).getTime() <= ora || r.status === 'cancelled')
    .sort((a, b) => b.schedules!.starts_at.localeCompare(a.schedules!.starts_at))
    .slice(0, 20)

  const Scheda = ({ r, futura }: { r: Riga; futura: boolean }) => {
    const s = r.schedules!
    const { giorno, ora: alle } = quando(s.starts_at)
    const st = stato(r, futura)
    // chi tiene davvero la lezione: la sostituta, se c'e'
    const chi = s.sostituta_id ?? s.instructor_id
    const contenuto = (
      <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/60 px-5 py-4 shadow-sm">
        <div className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.classes?.color ?? '#a8876a' }} />
        <div className="min-w-0 flex-1">
          <p className="font-inter text-[10px] font-normal uppercase tracking-widest text-meetoo-accent-dark/45">{giorno}</p>
          <p className="font-inter font-medium leading-snug text-meetoo-accent-dark">{s.classes?.name ?? 'Lezione'}</p>
          {chi && insegnanti.get(chi) && (
            <p className="truncate font-inter text-xs font-light text-meetoo-accent-dark/50">{insegnanti.get(chi)}</p>
          )}
          <p className={`mt-1 font-inter text-[10px] uppercase tracking-widest ${st.cls}`}>{st.testo}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-inter text-sm font-medium text-meetoo-accent-dark">{alle}</p>
          {futura && <p className="mt-1 font-inter text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">Gestisci →</p>}
        </div>
      </div>
    )
    return futura ? (
      <Link href={`/presenza/${r.action_token}`} prefetch={true} className="block">
        {contenuto}
      </Link>
    ) : (
      contenuto
    )
  }

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="font-inter text-[11px] font-semibold uppercase tracking-[0.3em] text-meetoo-accent-dark/50">Mee Too Pilates</p>
        <h1 className="mb-8 font-inter text-3xl font-extrabold uppercase tracking-wide text-meetoo-accent-dark">Prenotazioni</h1>

        <h2 className="mb-3 font-inter text-xs font-bold uppercase tracking-widest text-meetoo-accent-dark">In arrivo</h2>
        {inArrivo.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/60 px-5 py-6 text-center shadow-sm">
            <p className="font-inter text-sm font-light text-meetoo-accent-dark/70">Non hai lezioni prenotate.</p>
            <Link href="/palinsesto" className="mt-3 inline-block font-inter text-xs uppercase tracking-widest text-meetoo-accent-dark">
              Vai al palinsesto →
            </Link>
          </div>
        ) : (
          <>
            {/* In vista le prossime tre: le altre (un posto fisso ne ha una fila
                fino alla scadenza del pacchetto) si aprono con un tocco. */}
            <div className="space-y-2">
              {inArrivo.slice(0, IN_VISTA).map((r) => (
                <Scheda key={r.id} r={r} futura />
              ))}
            </div>
            {inArrivo.length > IN_VISTA && (
              <details className="group mt-2">
                <summary className={apri}>
                  <span className="group-open:hidden">Vedi le altre {inArrivo.length - IN_VISTA}</span>
                  <span className="hidden group-open:inline">Mostra solo le prossime</span>
                </summary>
                <div className="mt-2 space-y-2">
                  {inArrivo.slice(IN_VISTA).map((r) => (
                    <Scheda key={r.id} r={r} futura />
                  ))}
                </div>
              </details>
            )}
          </>
        )}

        {storico.length > 0 && (
          <details className="group mt-8">
            <summary className={apri}>
              <span className="group-open:hidden">Lezioni passate e cancellate ({storico.length})</span>
              <span className="hidden group-open:inline">Chiudi le lezioni passate</span>
            </summary>
            <div className="mt-2 space-y-2 opacity-80">
              {storico.map((r) => (
                <Scheda key={r.id} r={r} futura={false} />
              ))}
            </div>
          </details>
        )}
      </div>
    </main>
  )
}
