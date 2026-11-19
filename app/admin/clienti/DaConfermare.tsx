'use client'

import { useState } from 'react'
import { decidiCliente } from './conferma-actions'

export type InAttesa = {
  id: string
  nome: string
  email: string | null
  created_at: string
}

function quando(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

// Clienti appena iscritte che aspettano l'ok dello studio prima di prenotare.
export default function DaConfermare({ clienti }: { clienti: InAttesa[] }) {
  const [fatte, setFatte] = useState<Record<string, 'si' | 'no'>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  if (clienti.length === 0) return null

  async function decidi(id: string, si: boolean) {
    if (!si && !window.confirm('Non accetti questa iscrizione? La persona non potrà prenotare.')) return
    setBusy(id)
    setErrore(null)
    const r = await decidiCliente(id, si)
    setBusy(null)
    if (r.ok) setFatte((f) => ({ ...f, [id]: si ? 'si' : 'no' }))
    else setErrore(r.errore ?? 'Non è andata, riprova.')
  }

  return (
    <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
      <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-amber-800 mb-1">
        Da confermare
      </h2>
      <p className="font-inter font-light text-xs text-amber-800/80 mb-4">
        Si sono iscritte all’app e aspettano il tuo ok per prenotare.
      </p>
      <ul className="space-y-2">
        {clienti.map((c) => {
          const esito = fatte[c.id]
          return (
            <li key={c.id} className="bg-white/80 rounded-xl px-4 py-3">
              <div className="min-w-0">
                <p className="font-inter font-medium text-sm text-meetoo-accent-dark">{c.nome}</p>
                <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 truncate">
                  {c.email ? `${c.email} · ` : ''}iscritta il {quando(c.created_at)}
                </p>
              </div>
              {esito ? (
                <p className={`mt-2 font-inter text-xs ${esito === 'si' ? 'text-green-700' : 'text-meetoo-accent-dark/50'}`}>
                  {esito === 'si' ? 'Confermata, le abbiamo scritto' : 'Non accettata'}
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    disabled={busy === c.id}
                    onClick={() => decidi(c.id, false)}
                    className="font-inter uppercase tracking-widest text-[10px] px-3 py-2 rounded-full border border-meetoo-accent-dark/20 text-meetoo-accent-dark/60"
                  >
                    Non accettare
                  </button>
                  <button
                    disabled={busy === c.id}
                    onClick={() => decidi(c.id, true)}
                    className="font-inter uppercase tracking-widest text-[10px] px-4 py-2 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light disabled:opacity-50"
                  >
                    {busy === c.id ? '…' : 'Conferma'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {errore && <p className="font-inter text-xs text-red-600 mt-3">{errore}</p>}
    </section>
  )
}
