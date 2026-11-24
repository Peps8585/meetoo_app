'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Interruttore "prenotazioni con crediti" (piano di lancio del 24/11/2026).
// Spento: le clienti prenotano e disdicono senza scalare niente, come in App Palestre.
export default function InterruttoreCrediti({ iniziale }: { iniziale: boolean }) {
  const [attivi, setAttivi] = useState(iniziale)
  const [busy, setBusy] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function cambia() {
    const nuovo = !attivi
    const domanda = nuovo
      ? 'Accendi i crediti? Da adesso ogni prenotazione scala dal pacchetto della cliente, e chi non ha crediti non può prenotare.'
      : 'Spegni i crediti? Da adesso le clienti prenotano senza scalare niente dal pacchetto.'
    if (!window.confirm(domanda)) return
    setBusy(true)
    setErrore(null)
    const { error } = await createClient().rpc('imposta_crediti', { p_attivi: nuovo })
    setBusy(false)
    if (error) {
      setErrore('Non è andata, riprova tra poco.')
      return
    }
    setAttivi(nuovo)
  }

  return (
    <section className="mb-8 rounded-2xl border border-white/80 bg-white/60 px-5 py-4 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-inter font-medium text-sm text-meetoo-accent-dark">Prenotazioni con crediti</p>
        <p className="font-inter font-light text-xs text-meetoo-accent-dark/60 mt-0.5">
          {attivi
            ? 'Accese: ogni prenotazione scala dal pacchetto della cliente.'
            : 'Spente: le clienti prenotano senza scalare niente. Le lezioni si segnano sui cartellini.'}
        </p>
        {errore && <p className="font-inter text-xs text-red-600 mt-1">{errore}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={attivi}
        aria-label="Prenotazioni con crediti"
        disabled={busy}
        onClick={cambia}
        className={`relative shrink-0 w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${
          attivi ? 'bg-meetoo-accent-dark' : 'bg-meetoo-accent-dark/20'
        }`}
      >
        <span
          className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${attivi ? 'left-7' : 'left-1'}`}
        />
      </button>
    </section>
  )
}
