'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ListChecks, UserPlus } from 'lucide-react'
import { iniziali } from '@/lib/foto'
import { aggiungiCliente, rendiFissa, segnaPresenza, togliPrenotazione } from './actions'

export type Iscritta = {
  id: string // prenotazione
  clientId: string
  nome: string
  first: string | null
  last: string | null
  foto: string | null
  stato: 'confermata' | 'non_ha_risposto' | 'fissa_in_attesa' | 'non_viene' | 'lista'
  fissa: boolean
  daStudio: boolean
  presenza: 'presente' | 'assente' | null
  prenotataIl: string
  offerta?: string | null
}

export type Cliente = { id: string; nome: string; first: string | null; last: string | null; foto: string | null }

const CHIP: Partial<Record<Iscritta['stato'], { testo: string; cls: string }>> = {
  confermata: { testo: 'Confermata', cls: 'bg-meetoo-bg-dark/15 text-meetoo-bg-dark' },
  non_ha_risposto: { testo: 'Non ha risposto', cls: 'bg-amber-100 text-amber-700' },
}

function quando(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' }) +
    ' alle ' +
    d.toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Rome' }).replace(':', '.')
  )
}

function Faccina({ foto, first, last }: { foto: string | null; first: string | null; last: string | null }) {
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
  ) : (
    <span className="w-11 h-11 rounded-full bg-meetoo-accent-light/20 flex items-center justify-center shrink-0 font-inter font-semibold text-xs text-meetoo-accent-dark/50">
      {iniziali(first, last)}
    </span>
  )
}

const piccolo = 'font-inter font-normal uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40'

export default function Iscritte({
  scheduleId,
  righe,
  clienti,
  ruolo,
  passata,
}: {
  scheduleId: string
  righe: Iscritta[]
  clienti: Cliente[]
  ruolo: 'admin' | 'instructor'
  passata: boolean
}) {
  const router = useRouter()
  const [scheda, setScheda] = useState<'iscritte' | 'aggiungi'>('iscritte')
  const [cerca, setCerca] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [esito, setEsito] = useState<{ testo: string; ok: boolean } | null>(null)
  const [daTogliere, setDaTogliere] = useState<string | null>(null)
  // "Rendi fissa" e "Togli" stanno dietro un tocco: la lista resta corta
  const [altro, setAltro] = useState<string | null>(null)
  const admin = ruolo === 'admin'

  async function esegui(chiave: string, fn: () => Promise<{ ok: boolean; messaggio?: string }>, okTesto?: string) {
    setBusy(chiave)
    setEsito(null)
    const r = await fn()
    setBusy(null)
    setDaTogliere(null)
    setAltro(null)
    if (!r.ok) setEsito({ testo: r.messaggio ?? 'Riprova.', ok: false })
    else if (r.messaggio || okTesto) setEsito({ testo: r.messaggio ?? okTesto!, ok: true })
    router.refresh()
  }

  const q = cerca.trim().toLowerCase()
  const visibili = q ? righe.filter((r) => r.nome.toLowerCase().includes(q)) : righe
  const dentro = visibili.filter((r) => r.stato !== 'lista' && r.stato !== 'non_viene')
  const nonVengono = visibili.filter((r) => r.stato === 'non_viene')
  const lista = visibili.filter((r) => r.stato === 'lista')

  const giaDentro = new Set(righe.filter((r) => r.stato !== 'non_viene').map((r) => r.clientId))
  const candidate = clienti.filter((c) => !giaDentro.has(c.id) && (!q || c.nome.toLowerCase().includes(q)))

  // funzioni che disegnano (non componenti): restano stabili a ogni tocco
  function persona(r: Iscritta) {
    const chip = CHIP[r.stato]
    const attiva = r.stato !== 'lista' && r.stato !== 'non_viene'
    return (
      <li key={r.id} className="py-3.5">
        <div className="flex items-start gap-3">
          <Faccina foto={r.foto} first={r.first} last={r.last} />
          <div className="min-w-0 flex-1">
            <p className={`font-inter text-[15px] leading-snug ${r.stato === 'non_viene' ? 'text-meetoo-accent-dark/45 line-through decoration-meetoo-accent-dark/25' : 'text-meetoo-accent-dark'}`}>
              {r.nome}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45">
                {r.fissa ? 'Fissa' : 'Jolly'}
              </span>
              {chip && (
                <span className={`font-inter font-normal text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.testo}</span>
              )}
            </p>
            <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-1">
              {r.fissa
                ? 'Posto fisso'
                : r.stato === 'lista' && r.offerta
                  ? r.offerta === 'in_arrivo'
                    ? 'Posto tenuto per lei, l’avviso parte alle 8'
                    : `Posto tenuto per lei, risponde entro ${quando(r.offerta)}`
                  : r.stato === 'lista'
                  ? `In lista dal ${quando(r.prenotataIl)}`
                  : `Prenotata il ${quando(r.prenotataIl)} ${r.daStudio ? 'dallo studio' : 'dall’app'}`}
            </p>
          </div>
        </div>

        {/* Azioni sulla persona */}
        {(attiva || (admin && r.stato === 'lista')) && (
          <div className="mt-3 pl-14 flex flex-wrap gap-2">
            {attiva &&
              (['presente', 'assente'] as const).map((p) => (
                <button
                  key={p}
                  disabled={busy !== null}
                  onClick={() => esegui(`${r.id}-${p}`, () => segnaPresenza(scheduleId, r.id, r.presenza === p ? null : p))}
                  className={`${piccolo} ${
                    r.presenza === p
                      ? p === 'presente'
                        ? 'bg-meetoo-bg-dark text-white border-meetoo-bg-dark'
                        : 'bg-amber-500 text-white border-amber-500'
                      : 'border-meetoo-accent-dark/20 text-meetoo-accent-dark/60'
                  }`}
                >
                  {p === 'presente' ? 'Presente' : 'Assente'}
                </button>
              ))}
            {admin && !passata && altro !== r.id && (
              <button
                onClick={() => setAltro(r.id)}
                aria-label="Altre azioni"
                className={`${piccolo} border-meetoo-accent-dark/20 text-meetoo-accent-dark/60`}
              >
                ···
              </button>
            )}
            {admin && attiva && !r.fissa && !passata && altro === r.id && (
              <button
                disabled={busy !== null}
                onClick={() => esegui(`${r.id}-fissa`, () => rendiFissa(scheduleId, r.clientId))}
                className={`${piccolo} border-meetoo-accent-dark/20 text-meetoo-accent-dark/60`}
              >
                Rendi fissa
              </button>
            )}
            {admin && !passata && altro === r.id &&
              (daTogliere === r.id ? (
                <>
                  <button
                    disabled={busy !== null}
                    onClick={() => esegui(`${r.id}-togli`, () => togliPrenotazione(scheduleId, r.id, r.clientId), r.stato === 'lista' ? 'Tolta dalla lista.' : 'Tolta: la lezione le torna intera e riceve un avviso.')}
                    className={`${piccolo} bg-red-500 text-white border-red-500`}
                  >
                    {busy === `${r.id}-togli` ? '…' : 'Sì, togli'}
                  </button>
                  <button onClick={() => setDaTogliere(null)} className={`${piccolo} border-meetoo-accent-dark/20 text-meetoo-accent-dark/60`}>
                    No
                  </button>
                </>
              ) : (
                <button
                  disabled={busy !== null}
                  onClick={() => setDaTogliere(r.id)}
                  className={`${piccolo} border-red-300 text-red-500`}
                >
                  Togli
                </button>
              ))}
          </div>
        )}
      </li>
    )
  }

  function gruppo(titolo: string, elenco: Iscritta[]) {
    if (elenco.length === 0) return null
    return (
      <section key={titolo} className="mb-5">
        <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-2">
          {titolo} · {elenco.length}
        </h2>
        <ul className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-5 divide-y divide-meetoo-accent-dark/5">
          {elenco.map((r) => persona(r))}
        </ul>
      </section>
    )
  }

  const tab = (attiva: boolean) =>
    `flex items-center gap-2 pb-2.5 font-inter text-sm border-b-2 transition-colors ${
      attiva ? 'border-meetoo-accent-dark text-meetoo-accent-dark' : 'border-transparent text-meetoo-accent-dark/45'
    }`

  return (
    <>
      {admin && (
        <div className="flex gap-6 mb-5 border-b border-meetoo-accent-dark/10">
          <button className={tab(scheda === 'iscritte')} onClick={() => { setScheda('iscritte'); setEsito(null) }}>
            <ListChecks className="w-4 h-4" /> Iscritte
          </button>
          {!passata && (
            <button className={tab(scheda === 'aggiungi')} onClick={() => { setScheda('aggiungi'); setEsito(null) }}>
              <UserPlus className="w-4 h-4" /> Aggiungi
            </button>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 bg-white/60 border border-white/80 rounded-full px-4 py-2.5 mb-5 shadow-sm">
        <Search className="w-4 h-4 text-meetoo-accent-dark/40 shrink-0" />
        <input
          type="search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca per nome"
          className="min-w-0 flex-1 bg-transparent font-inter font-light text-sm text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/35 focus:outline-none"
        />
      </label>

      {esito && (
        <p role="status" className={`font-inter font-light text-xs mb-4 ${esito.ok ? 'text-meetoo-bg-dark' : 'text-amber-700'}`}>
          {esito.testo}
        </p>
      )}

      {scheda === 'iscritte' ? (
        dentro.length === 0 && nonVengono.length === 0 && lista.length === 0 ? (
          <p className="font-inter font-light text-sm text-meetoo-accent-dark/40 text-center py-10">
            {q ? 'Nessuna con questo nome' : 'Nessuna prenotazione'}
          </p>
        ) : (
          <>
            {gruppo('Iscritte', dentro)}
            {gruppo('Questa volta non vengono', nonVengono)}
            {gruppo('Lista d\'attesa', lista)}
          </>
        )
      ) : (
        <section>
          <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 mb-3">
            La lezione si scala dal suo pacchetto, come se si fosse prenotata da sola. Funziona anche a iscrizioni chiuse.
          </p>
          {candidate.length === 0 ? (
            <p className="font-inter font-light text-sm text-meetoo-accent-dark/40 text-center py-10">
              {q ? 'Nessuna con questo nome' : 'Nessuna cliente da aggiungere'}
            </p>
          ) : (
            <ul className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-5 divide-y divide-meetoo-accent-dark/5">
              {candidate.slice(0, 40).map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <Faccina foto={c.foto} first={c.first} last={c.last} />
                  <span className="min-w-0 flex-1 font-inter text-[15px] text-meetoo-accent-dark leading-snug">{c.nome}</span>
                  <button
                    disabled={busy !== null}
                    onClick={() => esegui(`add-${c.id}`, () => aggiungiCliente(scheduleId, c.id), `${c.nome} aggiunta alla lezione.`)}
                    className="shrink-0 font-inter font-normal uppercase tracking-widest text-[10px] px-4 py-2 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light disabled:opacity-40"
                  >
                    {busy === `add-${c.id}` ? '…' : 'Aggiungi'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
