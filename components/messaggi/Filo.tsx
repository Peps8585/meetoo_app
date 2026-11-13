// Il filo dei messaggi tra una cliente e lo studio, come una chat: a destra i
// messaggi di chi guarda, a sinistra quelli dell'altra parte. Lo usano sia la
// pagina della cliente sia quella dello studio.

export type Messaggio = {
  id: string
  da: 'studio' | 'cliente'
  testo: string
  created_at: string
  letto_at: string | null
}

const ROMA = 'Europe/Rome'

function giorno(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ROMA })
}

function ora(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit', timeZone: ROMA }).replace(':', '.')
}

export default function Filo({
  messaggi,
  io,
  nomeAltro,
  vuoto,
}: {
  messaggi: Messaggio[]
  io: 'studio' | 'cliente'
  nomeAltro: string
  vuoto: string
}) {
  if (messaggi.length === 0)
    return (
      <div className="rounded-2xl border border-white/80 bg-white/60 px-5 py-6 text-center shadow-sm">
        <p className="font-inter text-sm font-light text-meetoo-accent-dark/70">{vuoto}</p>
      </div>
    )

  return (
    <ol className="space-y-2">
      {messaggi.map((m, i) => {
        const g = giorno(m.created_at)
        const nuovoGiorno = i === 0 || g !== giorno(messaggi[i - 1].created_at)
        const mio = m.da === io
        return (
          <li key={m.id}>
            {nuovoGiorno && (
              <p className="my-4 text-center font-inter text-[10px] uppercase tracking-[0.2em] text-meetoo-accent-dark/40">{g}</p>
            )}
            <div className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  mio ? 'bg-meetoo-accent-dark text-meetoo-bg-light' : 'border border-white/80 bg-white/70 text-meetoo-accent-dark'
                }`}
              >
                {!mio && (
                  <p className="mb-0.5 font-inter text-[10px] uppercase tracking-widest text-meetoo-accent-light">{nomeAltro}</p>
                )}
                <p className="whitespace-pre-line break-words font-inter text-[15px] font-light leading-relaxed">{m.testo}</p>
                <p className={`mt-1 text-right font-inter text-[10px] ${mio ? 'text-meetoo-bg-light/60' : 'text-meetoo-accent-dark/40'}`}>
                  {ora(m.created_at)}
                  {mio && m.letto_at ? ' · letto' : ''}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
