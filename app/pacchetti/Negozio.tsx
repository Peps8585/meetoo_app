'use client'

import { useState } from 'react'
import { acquistaPacchetto } from './actions'

export type Voce = { id: string; name: string; credits: number; validity_days: number | null; price: number; bollo: number }

const euro = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n)

/**
 * Una disciplina alla volta, senza scorrere (Mattia: viste compatte, dettaglio al tocco).
 * Si tocca un pacchetto e in basso compare il pulsante con il totale, bollo compreso.
 */
export default function Negozio({ gruppi, puoComprare }: { gruppi: { d: string; lista: Voce[] }[]; puoComprare: boolean }) {
  const [disc, setDisc] = useState(gruppi[0]?.d ?? '')
  const [scelto, setScelto] = useState<Voce | null>(null)
  const [busy, setBusy] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const lista = gruppi.find((g) => g.d === disc)?.lista ?? []

  async function acquista() {
    if (!scelto) return
    setBusy(true)
    setErrore(null)
    const r = await acquistaPacchetto(scelto.id)
    if ('url' in r) {
      window.location.href = r.url
      return
    }
    setErrore(r.error)
    setBusy(false)
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {gruppi.map(({ d }) => (
          <button
            key={d}
            onClick={() => { setDisc(d); setScelto(null); setErrore(null) }}
            aria-pressed={d === disc}
            className={`rounded-full px-4 py-2 font-inter text-[11px] uppercase tracking-widest transition-colors ${
              d === disc ? 'bg-meetoo-accent-dark text-meetoo-bg-light' : 'border border-meetoo-accent-dark/15 bg-white/60 text-meetoo-accent-dark'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {lista.map((p) => {
          const on = scelto?.id === p.id
          const Tag = puoComprare ? 'button' : 'div'
          return (
            <Tag
              key={p.id}
              {...(puoComprare ? { onClick: () => { setScelto(on ? null : p); setErrore(null) }, 'aria-pressed': on } : {})}
              className={`w-full text-left rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 shadow-sm transition-colors ${
                on ? 'border-meetoo-accent-dark bg-white' : 'border-white/80 bg-white/60'
              }`}
            >
              <div className="min-w-0">
                <p className="font-inter font-medium text-sm text-meetoo-accent-dark">{p.credits} lezioni</p>
                <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 mt-0.5">
                  {euro(p.price / p.credits)} a lezione{p.validity_days ? `, valido ${p.validity_days} giorni` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-inter font-semibold text-xl text-meetoo-accent-dark leading-none">{euro(p.price)}</p>
                {p.bollo > 0 && <p className="font-inter font-light text-[10px] text-meetoo-accent-dark/45 mt-1">+ {euro(p.bollo)} di bollo</p>}
              </div>
            </Tag>
          )
        })}
      </div>

      {puoComprare && scelto && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-meetoo-accent-dark/10 bg-meetoo-bg-light/95 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            {errore && <p className="mb-2 font-inter text-xs text-red-700">{errore}</p>}
            <button
              disabled={busy}
              onClick={acquista}
              className="w-full rounded-full bg-meetoo-accent-dark py-3.5 font-inter text-[12px] uppercase tracking-widest text-meetoo-bg-light disabled:opacity-50"
            >
              {busy ? 'Apro il pagamento…' : `Acquista ${disc} ${scelto.credits} · ${euro(scelto.price + scelto.bollo)}`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
