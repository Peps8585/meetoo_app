'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// "Prenotazioni dall'app" (Mattia 24/11/2026): chiuse, di prova o aperte.
// - chiuse: le clienti guardano e si iscrivono, prenota solo lo studio per loro;
// - di prova: le clienti provano a prenotare, ma le prenotazioni non valgono
//   (niente crediti, niente lista d'attesa, niente email) e si annullano tutte al lancio;
// - aperte: l'app funziona davvero.
type Modo = 'chiuse' | 'prova' | 'aperte'

const MODI: { id: Modo; label: string; spiega: string; domanda: string }[] = [
  {
    id: 'chiuse',
    label: 'Chiuse',
    spiega: 'Le clienti guardano e si iscrivono, ma non prenotano. Lo studio può prenotare per loro.',
    domanda: 'Chiudere le prenotazioni dall\'app? Le clienti potranno solo guardare.',
  },
  {
    id: 'prova',
    label: 'Di prova',
    spiega:
      'Le clienti provano a prenotare e disdire, ma le prenotazioni non valgono: niente crediti, niente email. Si annullano tutte il giorno del lancio.',
    domanda: 'Passare alle prenotazioni di prova? Le clienti potranno provare a prenotare, ma non varrà niente.',
  },
  {
    id: 'aperte',
    label: 'Aperte',
    spiega: 'L\'app funziona davvero: le clienti confermate prenotano da qui.',
    domanda: 'Aprire davvero le prenotazioni dall\'app? Prima annulla le prenotazioni di prova, se ce ne sono.',
  },
]

export default function InterruttoreApp({ iniziale }: { iniziale: Modo }) {
  const [modo, setModo] = useState<Modo>(iniziale)
  const [busy, setBusy] = useState(false)
  const [esito, setEsito] = useState<string | null>(null)

  async function scegli(m: (typeof MODI)[number]) {
    if (m.id === modo || !window.confirm(m.domanda)) return
    setBusy(true)
    setEsito(null)
    const { error } = await createClient().rpc('imposta_modo_prenotazioni', { p_modo: m.id })
    setBusy(false)
    if (error) return setEsito('Non è andata, riprova tra poco.')
    setModo(m.id)
  }

  async function annullaProva() {
    if (!window.confirm('Annullare tutte le prenotazioni di prova? Le clienti non ricevono nessun avviso.')) return
    setBusy(true)
    const { data, error } = await createClient().rpc('annulla_prenotazioni_prova')
    setBusy(false)
    setEsito(error ? 'Non è andata, riprova tra poco.' : `Annullate ${data ?? 0} prenotazioni di prova.`)
  }

  const attuale = MODI.find((m) => m.id === modo)!
  return (
    <section className="mb-8 rounded-2xl border border-white/80 bg-white/60 px-5 py-4">
      <p className="font-inter font-medium text-sm text-meetoo-accent-dark">Prenotazioni dall&apos;app</p>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-meetoo-accent-dark/5 p-1" role="radiogroup">
        {MODI.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={m.id === modo}
            disabled={busy}
            onClick={() => scegli(m)}
            className={`rounded-full py-2 font-inter text-[11px] uppercase tracking-widest transition-colors disabled:opacity-50 ${
              m.id === modo ? 'bg-meetoo-accent-dark text-white' : 'text-meetoo-accent-dark/60'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="font-inter font-light text-xs text-meetoo-accent-dark/60 mt-2">{attuale.spiega}</p>
      <button
        type="button"
        disabled={busy}
        onClick={annullaProva}
        className="mt-3 font-inter text-[11px] uppercase tracking-widest text-meetoo-accent-dark/50 underline underline-offset-4 disabled:opacity-50"
      >
        Annulla le prenotazioni di prova
      </button>
      {esito && <p className="font-inter text-xs text-meetoo-accent-dark mt-2">{esito}</p>}
    </section>
  )
}
