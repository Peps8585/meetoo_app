import { Hourglass } from 'lucide-react'

// Cliente appena iscritta, non ancora confermata dallo studio (Mattia 19/11/2026):
// puo' guardare l'app ma non prenotare finche' Giorgia non le da' l'ok.
export default function InAttesaConferma() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 flex gap-3">
      <Hourglass className="shrink-0 w-4 h-4 mt-0.5 text-amber-700" />
      <p className="font-inter text-sm leading-snug text-amber-800">
        Grazie per esserti iscritta! Lo studio deve confermare la tua iscrizione prima che tu possa prenotare.
        Intanto puoi guardare il palinsesto: appena sei confermata ti avvisiamo.
      </p>
    </div>
  )
}
