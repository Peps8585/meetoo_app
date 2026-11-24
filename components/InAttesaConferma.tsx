import { Hourglass } from 'lucide-react'

// Cliente appena iscritta, non ancora confermata dallo studio (Mattia 19/11/2026):
// puo' guardare l'app ma non prenotare finche' Giorgia non le da' l'ok.
// inProva: lo studio tiene chiuse le prenotazioni dall'app (fase di prova, 24/11/2026):
// vale per tutte le clienti, confermate o no.
export default function InAttesaConferma({ inProva = false }: { inProva?: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 flex gap-3">
      <Hourglass className="shrink-0 w-4 h-4 mt-0.5 text-amber-700" />
      <p className="font-inter text-sm leading-snug text-amber-800">
        {inProva ? (
          <>
            Grazie per esserti iscritta! Questa è una versione di prova della nuova app di Mee Too: puoi già entrare,
            guardare il palinsesto e completare il tuo profilo. Ti avviseremo noi quando potrai prenotare le lezioni da
            qui. Fino ad allora continua a prenotare come fai adesso.
          </>
        ) : (
          <>
            Grazie per esserti iscritta! Lo studio deve confermare la tua iscrizione prima che tu possa prenotare.
            Intanto puoi guardare il palinsesto: appena sei confermata ti avvisiamo.
          </>
        )}
      </p>
    </div>
  )
}
