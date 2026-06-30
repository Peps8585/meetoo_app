'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ERROR_MESSAGES: Record<string, string> = {
  decision_not_pending: 'Questa decisione non è più attiva.',
  decision_not_found: "Impossibile completare l'operazione.",
  not_owner: "Impossibile completare l'operazione.",
  not_authenticated: 'Devi effettuare l’accesso.',
}

function mapError(message: string): string {
  return ERROR_MESSAGES[message] ?? 'Si è verificato un errore. Riprova.'
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' alle ' +
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  )
}

export default function DecisionCard({
  decisionId,
  className,
  startsAt,
}: {
  decisionId: string
  className: string
  startsAt: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRefund() {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('resolve_subthreshold_refund', {
      p_decision_id: decisionId,
    })

    if (rpcError) {
      setError(mapError(rpcError.message))
      setBusy(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-meetoo-accent-light/40 px-6 sm:px-8 py-7 mb-8">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="w-5 h-5 text-meetoo-accent-light shrink-0 mt-0.5" />
        <div>
          <p className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-1">
            Lezione sotto il minimo
          </p>
          <h2 className="font-inter font-light text-lg sm:text-xl text-meetoo-accent-dark leading-snug">
            La lezione <span className="font-semibold">{className}</span> del{' '}
            <span className="font-semibold">{fmtDateTime(startsAt)}</span> non ha
            raggiunto il minimo di partecipanti.
          </h2>
        </div>
      </div>

      <p className="font-inter font-light text-sm text-meetoo-accent-dark/60 mb-5">
        Puoi annullare la prenotazione e riavere subito il credito sul tuo saldo.
      </p>

      {error && (
        <p className="font-inter font-light text-xs text-red-600 mb-4">{error}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleRefund}
          disabled={busy}
          className="bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-meetoo-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? 'Annullamento…' : 'Annulla e riaccredita'}
        </button>
        {/* TODO opzione A (reschedule): secondo pulsante "Sposta su altra lezione" → resolve_subthreshold_reschedule */}
      </div>
    </div>
  )
}
