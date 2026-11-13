import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminStaff } from '@/lib/gift/staff'
import { iniziali, linkFoto } from '@/lib/foto'
import { whatsappAcceso } from '@/lib/whatsapp/send'
import NuovoMessaggio, { type LezioneScelta } from './NuovoMessaggio'

// La sezione Messaggi dello studio: scrivere (a tutte, alle iscritte di una
// lezione, a una cliente), le conversazioni con le risposte da leggere in
// cima, e gli invii gia' fatti con quante li hanno letti.

const ROMA = 'Europe/Rome'
const scheda = 'rounded-2xl border border-white/80 bg-white/60 shadow-sm'
const titoletto = 'mb-3 font-inter text-[11px] font-extrabold uppercase tracking-widest text-meetoo-accent-dark'

function quando(iso: string): string {
  const d = new Date(iso)
  const giorno = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ROMA })
  const ora = d.toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit', timeZone: ROMA }).replace(':', '.')
  return `${giorno}, ${ora}`
}

function lezioneBreve(iso: string, nome: string): string {
  const d = new Date(iso)
  const giorno = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: ROMA })
  const ora = d.toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit', timeZone: ROMA }).replace(':', '.')
  return `${giorno} · ${ora} · ${nome}`
}

type Filo = {
  client_id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  ultimo_testo: string
  ultimo_da: 'studio' | 'cliente'
  ultimo_at: string
  da_leggere: number
}

type Invio = {
  invio_id: string
  destinatari: 'tutte' | 'lezione' | 'cliente'
  schedule_id: string | null
  testo: string
  created_at: string
  mandati: number
  letti: number
}

export default async function AdminMessaggiPage({
  searchParams,
}: {
  searchParams: Promise<{ lezione?: string; cliente?: string }>
}) {
  const staff = await getAdminStaff()
  if (!staff) redirect('/login?next=/admin/messaggi')
  const sp = await searchParams
  const supabase = await createClient()

  const adesso = new Date()
  const da = new Date(adesso.getTime() - 3 * 60 * 60 * 1000).toISOString()
  const a = new Date(adesso.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: fili }, { data: invii }, { data: lezioni }, { data: clienti }] = await Promise.all([
    supabase.rpc('studio_fili_messaggi'),
    supabase.rpc('studio_invii_messaggi', { p_limite: 20 }),
    supabase
      .from('schedules')
      .select('id, starts_at, classes:class_id(name), bookings(status)')
      .eq('studio_id', staff.studioId)
      .eq('is_cancelled', false)
      .gte('starts_at', da)
      .lte('starts_at', a)
      .order('starts_at'),
    supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('studio_id', staff.studioId)
      .eq('role', 'client')
      .neq('is_active', false)
      .order('first_name'),
  ])

  // un invio rimasto senza destinatarie non e' arrivato a nessuna: non si elenca
  const inviati = ((invii ?? []) as Invio[]).filter((i) => i.mandati > 0)
  const righeFili = (fili ?? []) as Filo[]
  const foto = await linkFoto(supabase, righeFili.map((f) => f.avatar_url))
  const daLeggere = righeFili.filter((f) => f.da_leggere > 0)
  const altri = righeFili.filter((f) => f.da_leggere === 0)

  const scelte: LezioneScelta[] = (
    (lezioni ?? []) as unknown as {
      id: string
      starts_at: string
      classes: { name: string } | null
      bookings: { status: string }[] | null
    }[]
  ).map((l) => {
    const iscritte = (l.bookings ?? []).filter((b) => b.status === 'confirmed' || b.status === 'held').length
    return { id: l.id, etichetta: `${lezioneBreve(l.starts_at, l.classes?.name ?? 'Lezione')} · ${iscritte} ${iscritte === 1 ? 'iscritta' : 'iscritte'}`, iscritte }
  })
  const nomiLezioni = new Map(scelte.map((s) => [s.id, s.etichetta]))

  const rigaFilo = (f: Filo) => {
    const nome = [f.first_name, f.last_name].filter(Boolean).join(' ') || 'Cliente'
    const link = f.avatar_url ? foto.get(f.avatar_url) : null
    return (
      <li key={f.client_id}>
        <Link href={`/admin/messaggi/${f.client_id}`} className={`${scheda} flex items-center gap-3 px-4 py-3`}>
          {link ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={link} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-meetoo-accent-light/20 font-inter text-sm font-extrabold text-meetoo-accent-dark/50">
              {iniziali(f.first_name, f.last_name)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-inter text-sm text-meetoo-accent-dark ${f.da_leggere ? 'font-bold' : 'font-medium'}`}>{nome}</span>
            <span className={`block truncate font-inter text-xs ${f.da_leggere ? 'text-meetoo-accent-dark' : 'font-light text-meetoo-accent-dark/55'}`}>
              {f.ultimo_da === 'studio' ? 'Tu: ' : ''}
              {f.ultimo_testo}
            </span>
          </span>
          {f.da_leggere > 0 && (
            <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-meetoo-accent-light px-1.5 font-inter text-xs font-bold text-white">
              {f.da_leggere}
            </span>
          )}
        </Link>
      </li>
    )
  }

  return (
    <div className="max-w-2xl p-5 sm:p-8">
      <div className="mb-6">
        <p className="mb-1 font-inter text-xs font-normal uppercase tracking-[0.3em] text-meetoo-accent-dark/50">Admin</p>
        <h1 className="font-inter text-3xl font-extrabold uppercase tracking-widest text-meetoo-accent-dark">Messaggi</h1>
        <p className="mt-2 max-w-[60ch] font-inter text-sm font-light text-meetoo-accent-dark/55">
          I messaggi arrivano alle clienti come notifica e restano nella loro app, dove possono rispondere.
        </p>
      </div>

      {daLeggere.length > 0 && (
        <section className="mb-8">
          <h2 className={titoletto}>Da leggere</h2>
          <ul className="space-y-2">{daLeggere.map(rigaFilo)}</ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className={titoletto}>Scrivi un messaggio</h2>
        <NuovoMessaggio
          lezioni={scelte}
          clienti={((clienti ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((c) => ({
            id: c.id,
            nome: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Cliente senza nome',
          }))}
          lezioneIniziale={sp.lezione && nomiLezioni.has(sp.lezione) ? sp.lezione : null}
          clienteIniziale={sp.cliente ?? null}
          whatsapp={whatsappAcceso('lezione')}
        />
      </section>

      {altri.length > 0 && (
        <section className="mb-8">
          <h2 className={titoletto}>Conversazioni</h2>
          <ul className="space-y-2">{altri.map(rigaFilo)}</ul>
        </section>
      )}

      {inviati.length > 0 && (
        <section>
          <h2 className={titoletto}>Già inviati</h2>
          <ul className="space-y-2">
            {inviati.map((i) => (
              <li key={i.invio_id} className={`${scheda} px-5 py-4`}>
                <p className="font-inter text-[10px] uppercase tracking-[0.2em] text-meetoo-accent-dark/50">
                  {quando(i.created_at)} ·{' '}
                  {i.destinatari === 'tutte'
                    ? 'a tutte'
                    : i.destinatari === 'lezione'
                      ? 'alle iscritte di una lezione'
                      : 'a una cliente'}
                </p>
                <p className="mt-1 whitespace-pre-line font-inter text-sm font-light leading-relaxed text-meetoo-accent-dark">{i.testo}</p>
                <p className="mt-2 font-inter text-xs font-light text-meetoo-accent-dark/55">
                  Letto da {i.letti} su {i.mandati}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
