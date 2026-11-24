'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Interruttore "Prenotazioni dall'app" (Mattia 24/11/2026).
// Chiuso: fase di prova, le clienti si iscrivono e guardano ma prenotano ancora da App Palestre.
export default function InterruttoreApp({ iniziale }: { iniziale: boolean }) {
  const [attivi, setAttivi] = useState(iniziale)
  const [busy, setBusy] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function cambia() {
    const nuovo = !attivi
    const domanda = nuovo
      ? 'Apri le prenotazioni dall\'app? Da adesso le clienti confermate prenotano da qui.'
      : 'Chiudi le prenotazioni dall\'app? Le clienti potranno guardare il palinsesto ma non prenotare.'
    if (!window.confirm(domanda)) return
    setBusy(true)
    setErrore(null)
    const { error } = await createClient().rpc('imposta_prenotazioni_app', { p_aperte: nuovo })
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
        <p className="font-inter font-medium text-sm text-meetoo-accent-dark">Prenotazioni dall&apos;app</p>
        <p className="font-inter font-light text-xs text-meetoo-accent-dark/60 mt-0.5">
          {attivi
            ? 'Aperte: le clienti confermate prenotano dall\'app.'
            : 'Chiuse, versione di prova: le clienti guardano e si iscrivono, lo studio può prenotare per loro.'}
        </p>
        {errore && <p className="font-inter text-xs text-red-600 mt-1">{errore}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={attivi}
        aria-label="Prenotazioni dall'app"
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
