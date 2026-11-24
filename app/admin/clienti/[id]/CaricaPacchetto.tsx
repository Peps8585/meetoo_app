'use client'

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { caricaPacchetto } from './carica-pacchetto-actions'

export type PacchettoStudio = {
  id: string
  name: string
  credits: number
  price: number
  validity_days: number | null
}

function dataIso(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

function euro(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

// Tasto "Carica pacchetto" nella scheda della cliente (Mattia 24/11/2026):
// una vendita in studio, oppure le lezioni rimaste sul cartellino di carta.
export default function CaricaPacchetto({ clientId, pacchetti }: { clientId: string; pacchetti: PacchettoStudio[] }) {
  const [aperto, setAperto] = useState(false)
  const [tipo, setTipo] = useState<'nuovo' | 'cartellino'>('nuovo')
  const [pkgId, setPkgId] = useState(pacchetti[0]?.id ?? '')
  const pkg = useMemo(() => pacchetti.find((p) => p.id === pkgId), [pacchetti, pkgId])
  const [lezioni, setLezioni] = useState<number>(pacchetti[0]?.credits ?? 1)
  const scadenzaStd = (p?: PacchettoStudio) =>
    p?.validity_days ? dataIso(new Date(Date.now() + p.validity_days * 86400000)) : ''
  const [scadenza, setScadenza] = useState(() => scadenzaStd(pacchetti[0]))
  const [oggi] = useState(() => dataIso(new Date()))
  const [busy, setBusy] = useState(false)
  const [nota, setNota] = useState<{ ok: boolean; testo: string } | null>(null)

  function scegli(id: string) {
    setPkgId(id)
    const p = pacchetti.find((x) => x.id === id)
    setLezioni(p?.credits || 1)
    setScadenza(scadenzaStd(p))
  }

  async function salva() {
    if (!pkg) return
    setBusy(true)
    setNota(null)
    const r = await caricaPacchetto({
      clientId,
      packageId: pkg.id,
      lezioni: tipo === 'nuovo' ? pkg.credits || 1 : lezioni,
      scadenza: scadenza || null,
      pagatoOggi: tipo === 'nuovo',
    })
    setBusy(false)
    if (!r.ok) {
      setNota({ ok: false, testo: r.errore ?? 'Non è andata, riprova.' })
      return
    }
    setAperto(false)
    // ricarica la scheda, cosi' il pacchetto nuovo compare subito nell'elenco
    window.location.reload()
  }

  if (pacchetti.length === 0) return null

  const etichetta = 'font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45'
  const campo =
    'mt-1 w-full rounded-xl border border-meetoo-accent-dark/15 bg-white px-4 py-3 font-inter text-sm text-meetoo-accent-dark focus:outline-none focus:border-meetoo-accent-dark/40'

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setNota(null)
          setAperto(true)
        }}
        className="mt-3 w-full flex items-center justify-center gap-2 font-inter uppercase tracking-widest text-[11px] px-4 py-3 rounded-full border border-meetoo-accent-dark/30 text-meetoo-accent-dark hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors"
      >
        <Plus className="w-4 h-4" /> Carica pacchetto
      </button>
      {nota && <p className={`mt-2 font-inter text-xs ${nota.ok ? 'text-green-700' : 'text-red-600'}`}>{nota.testo}</p>}

      {aperto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => !busy && setAperto(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Carica pacchetto"
            className="w-full sm:max-w-md bg-meetoo-bg-light rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto px-6 pt-5 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-inter font-extrabold uppercase tracking-widest text-base text-meetoo-accent-dark">
                Carica pacchetto
              </h2>
              <button type="button" aria-label="Chiudi" onClick={() => setAperto(false)} className="w-9 h-9 -mr-2 flex items-center justify-center text-meetoo-accent-dark/60">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {(
                [
                  ['nuovo', 'Venduto oggi'],
                  ['cartellino', 'Dal cartellino'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTipo(v)}
                  className={`font-inter uppercase tracking-widest text-[10px] py-3 rounded-full border ${
                    tipo === v
                      ? 'bg-meetoo-accent-dark text-meetoo-bg-light border-meetoo-accent-dark'
                      : 'border-meetoo-accent-dark/20 text-meetoo-accent-dark/70'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="font-inter font-light text-xs text-meetoo-accent-dark/60 -mt-3 mb-5">
              {tipo === 'nuovo'
                ? 'La cliente ha appena comprato il pacchetto in studio.'
                : 'Il pacchetto che la cliente ha già: scrivi le lezioni che le restano e la scadenza del cartellino.'}
            </p>

            <label className="block mb-4">
              <span className={etichetta}>Pacchetto</span>
              <select className={campo} value={pkgId} onChange={(e) => scegli(e.target.value)}>
                {pacchetti.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {euro(p.price)}
                  </option>
                ))}
              </select>
            </label>

            {tipo === 'cartellino' && pkg && pkg.credits > 0 && (
              <label className="block mb-4">
                <span className={etichetta}>Lezioni rimaste</span>
                <input
                  className={campo}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={pkg.credits}
                  value={lezioni}
                  onChange={(e) => setLezioni(Math.max(1, Math.min(pkg.credits, Number(e.target.value) || 1)))}
                />
                <span className="font-inter font-light text-xs text-meetoo-accent-dark/45">su {pkg.credits} del pacchetto</span>
              </label>
            )}

            <label className="block mb-6">
              <span className={etichetta}>Scade il</span>
              <input className={campo} type="date" value={scadenza} min={oggi} onChange={(e) => setScadenza(e.target.value)} />
            </label>

            <button
              type="button"
              onClick={salva}
              disabled={busy || !pkg}
              className="w-full font-inter uppercase tracking-widest text-xs py-4 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light disabled:opacity-50"
            >
              {busy ? 'Carico…' : tipo === 'nuovo' ? `Carica ${pkg?.name ?? ''}` : `Carica ${lezioni} lezioni`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
