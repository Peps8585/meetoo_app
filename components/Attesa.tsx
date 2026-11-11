// Schermata d'attesa: compare nell'istante del tocco, mentre il server prepara
// la pagina vera. Riprende la forma delle schede dell'app (blocchi chiari che
// pulsano piano), cosi' il telefono risponde subito e non sembra fermo.
export function Blocco({ className = '' }: { className?: string }) {
  return <div className={`rounded-2xl bg-white/60 border border-white/80 animate-pulse ${className}`} />
}

export default function Attesa({ titolo = true, righe = 4 }: { titolo?: boolean; righe?: number }) {
  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 sm:px-6 py-8 sm:py-12" aria-busy="true" aria-label="Caricamento">
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="h-4 w-24 rounded-full bg-meetoo-accent-dark/10 animate-pulse mb-6" />
        {titolo && <Blocco className="h-28" />}
        <div className="h-9" />
        {Array.from({ length: righe }).map((_, i) => (
          <Blocco key={i} className="h-20" />
        ))}
      </div>
    </main>
  )
}
