'use client'

import { useState } from 'react'
import { aggiungiPostoFisso, togliPostoFisso } from './posto-fisso-actions'

export type SlotAttivo = { id: string; label: string; prossime: number }
export type SlotPossibile = { key: string; classId: string; weekday: number; time: string; label: string }

function fmtGiorno(d: string): string {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })
}

export default function PostoFisso({
  clientId,
  attivi,
  possibili,
  haPacchetto,
}: {
  clientId: string
  attivi: SlotAttivo[]
  possibili: SlotPossibile[]
  haPacchetto: boolean
}) {
  const [scelta, setScelta] = useState('')
  const [busy, setBusy] = useState(false)
  const [esito, setEsito] = useState<{ testo: string; tipo: 'ok' | 'errore' } | null>(null)
  const [daTogliere, setDaTogliere] = useState<string | null>(null)

  const liberi = possibili.filter((p) => !attivi.some((a) => a.label === p.label))

  async function aggiungi() {
    const p = possibili.find((x) => x.key === scelta)
    if (!p) return
    setBusy(true)
    setEsito(null)
    const r = await aggiungiPostoFisso(clientId, p.classId, p.weekday, p.time)
    setBusy(false)
    if (r.error) return setEsito({ testo: r.error, tipo: 'errore' })
    setScelta('')
    let testo =
      r.held === 0
        ? 'Posto fisso salvato, ma non ci sono lezioni da tenere: controlla il pacchetto della cliente.'
        : `Posto tenuto su ${r.held} ${r.held === 1 ? 'lezione' : 'lezioni'}${r.until ? `, fino al ${fmtGiorno(r.until)}` : ''}.`
    if (r.full && r.full.length > 0)
      testo += ` Già piene, senza posto: ${r.full.map(fmtGiorno).join(', ')}.`
    setEsito({ testo, tipo: r.full && r.full.length > 0 ? 'errore' : 'ok' })
  }

  async function togli(slotId: string) {
    setBusy(true)
    setEsito(null)
    const r = await togliPostoFisso(clientId, slotId)
    setBusy(false)
    setDaTogliere(null)
    if (r.error) return setEsito({ testo: r.error, tipo: 'errore' })
    setEsito({
      testo: `Posto fisso tolto. ${r.freed} ${r.freed === 1 ? 'posto liberato' : 'posti liberati'}. Le lezioni di questa settimana già scalate restano.`,
      tipo: 'ok',
    })
  }

  return (
    <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 sm:px-6 py-5 shadow-sm space-y-4">
      {attivi.length === 0 ? (
        <p className="font-inter font-light text-sm text-meetoo-accent-dark/45">
          Nessun posto fisso: la cliente prenota da sola (jolly).
        </p>
      ) : (
        <ul className="space-y-2">
          {attivi.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-inter font-medium text-sm text-meetoo-accent-dark truncate">{a.label}</p>
                <p className="font-inter font-light text-xs text-meetoo-accent-dark/40">
                  {a.prossime} {a.prossime === 1 ? 'lezione' : 'lezioni'} in calendario
                </p>
              </div>
              {daTogliere === a.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={busy}
                    onClick={() => togli(a.id)}
                    className="font-inter font-normal uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-full bg-red-500 text-white disabled:opacity-40"
                  >
                    Togli
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setDaTogliere(null)}
                    className="font-inter font-normal uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-full border border-meetoo-accent-dark/20 text-meetoo-accent-dark/60"
                  >
                    Annulla
                  </button>
                </div>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => setDaTogliere(a.id)}
                  className="shrink-0 font-inter font-normal uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-full border border-red-300 text-red-500 hover:bg-red-50"
                >
                  Togli
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!haPacchetto && (
        <p className="font-inter font-light text-xs text-amber-700">
          La cliente non ha un pacchetto attivo: il posto fisso si tiene solo fino alla scadenza del pacchetto.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={scelta}
          onChange={(e) => setScelta(e.target.value)}
          aria-label="Lezione da rendere fissa"
          className="flex-1 min-w-0 bg-meetoo-bg-light border border-meetoo-accent-dark/20 rounded-full px-4 py-2.5 font-inter font-light text-sm text-meetoo-accent-dark"
        >
          <option value="">Scegli giorno e ora…</option>
          {liberi.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !scelta}
          onClick={aggiungi}
          className="bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-meetoo-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? 'Un attimo…' : 'Aggiungi posto fisso'}
        </button>
      </div>

      {esito && (
        <p
          role="status"
          className={`font-inter font-light text-xs ${esito.tipo === 'ok' ? 'text-meetoo-bg-dark' : 'text-amber-700'}`}
        >
          {esito.testo}
        </p>
      )}
    </div>
  )
}
