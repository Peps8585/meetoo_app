'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type TargetLesson = {
  id: string
  starts_at: string
  className: string
}

const ERROR_MESSAGES: Record<string, string> = {
  decision_not_pending: 'Questa decisione non è più attiva.',
  decision_not_found: "Impossibile completare l'operazione.",
  not_owner: "Impossibile completare l'operazione.",
  not_authenticated: 'Devi effettuare l’accesso.',
  full: 'Questa lezione è al completo. Scegline un’altra.',
  booking_closed: 'Le iscrizioni per questa lezione sono già chiuse.',
  already_booked: 'Sei già iscritta a questa lezione.',
  no_credits: 'Credito insufficiente per prenotare questa lezione.',
  schedule_cancelled: 'Questa lezione è stata annullata.',
  schedule_past: 'Questa lezione è già iniziata.',
  price_not_set: 'Prezzo della lezione non ancora disponibile. Contatta lo studio.',
  same_schedule: 'Scegli una lezione diversa da quella originale.',
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

function fmtDateShort(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  )
}

export default function DecisionCard({
  decisionId,
  className,
  startsAt,
  targets,
}: {
  decisionId: string
  className: string
  startsAt: string
  targets: TargetLesson[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string>(
    () => targets[0]?.id ?? ''
  )

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

  async function handleReschedule() {
    if (!selectedTarget) return
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('resolve_subthreshold_reschedule', {
      p_decision_id: decisionId,
      p_target_schedule_id: selectedTarget,
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
      </div>

      {/* Opzione A — sposta su un'altra lezione della stessa disciplina */}
      {targets.length > 0 && (
        <div className="mt-4 pt-4 border-t border-meetoo-accent-dark/10">
          <label className="block font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/60 mb-2">
            Oppure spostati su un’altra lezione
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              disabled={busy}
              className="flex-1 bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-sm text-meetoo-accent-dark focus:outline-none focus:border-meetoo-accent-light transition-colors disabled:opacity-40"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.className} · {fmtDateShort(t.starts_at)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleReschedule}
              disabled={busy || !selectedTarget}
              className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'Attendere…' : 'Sposta su questa lezione'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
