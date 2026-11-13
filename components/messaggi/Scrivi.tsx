'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// Il campo per scrivere in fondo a un filo. `invia` e' l'azione del server:
// quella della cliente (risponde allo studio) o quella dello studio (scrive a
// quella cliente).
export default function Scrivi({
  invia,
  segnaposto,
}: {
  invia: (testo: string) => Promise<{ ok: boolean; messaggio?: string }>
  segnaposto: string
}) {
  const router = useRouter()
  const [testo, setTesto] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, parti] = useTransition()

  function manda() {
    const t = testo.trim()
    if (!t) return
    setErrore(null)
    parti(async () => {
      const r = await invia(t)
      if (r.ok) {
        setTesto('')
        router.refresh()
      } else setErrore(r.messaggio ?? 'Il messaggio non è partito. Riprova.')
    })
  }

  return (
    <div className="mt-5">
      <div className="flex items-end gap-2">
        <textarea
          aria-label={segnaposto}
          placeholder={segnaposto}
          rows={2}
          maxLength={2000}
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          className="min-w-0 flex-1 resize-none rounded-2xl border border-meetoo-accent-dark/15 bg-white/80 px-4 py-3 font-inter text-[15px] text-meetoo-accent-dark outline-none focus:border-meetoo-accent-light"
        />
        <button
          type="button"
          disabled={inCorso || !testo.trim()}
          onClick={manda}
          className="h-12 shrink-0 rounded-full bg-meetoo-accent-dark px-5 font-inter text-[11px] uppercase tracking-widest text-meetoo-bg-light transition-colors hover:bg-meetoo-bg-dark disabled:opacity-40"
        >
          {inCorso ? '…' : 'Invia'}
        </button>
      </div>
      {errore && <p className="mt-2 font-inter text-xs text-amber-800">{errore}</p>}
    </div>
  )
}
