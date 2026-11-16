import Link from 'next/link'
import { fotoEvento, giornoEvento, oreEvento, whatsappEvento, type Evento } from '@/lib/eventi'

// Il post di un evento, come compare in home e nella pagina Eventi: foto,
// quando, titolo, due righe e il pulsante per scrivere allo studio.
// Toccando foto o titolo si apre la pagina dell'evento, quella da condividere.
export default function CartaEvento({
  evento,
  intera = false,
  compatta = false,
}: {
  evento: Evento
  intera?: boolean
  compatta?: boolean
}) {
  const foto = fotoEvento(evento.foto)
  const pagina = `/evento/${evento.id}`

  // In home l'evento sta in una riga sola (foto piccola, quando, titolo): un
  // tocco apre la pagina con tutto. Cosi' non spinge in basso le lezioni.
  if (compatta)
    return (
      <Link
        href={pagina}
        className="flex items-center gap-4 overflow-hidden rounded-2xl border border-white/80 bg-white/60 pr-4 shadow-sm"
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" className="h-20 w-20 shrink-0 object-cover" loading="lazy" />
        ) : (
          <span aria-hidden className="h-20 w-2 shrink-0 bg-meetoo-accent-light/40" />
        )}
        <span className="min-w-0 flex-1 py-2">
          <span className="block font-inter text-[10px] font-normal uppercase tracking-[0.15em] text-meetoo-accent-dark/70">
            {giornoEvento(evento.inizio)} · {oreEvento(evento)}
          </span>
          <span className="mt-0.5 block truncate font-inter text-base font-bold text-meetoo-accent-dark">{evento.titolo}</span>
        </span>
        <span aria-hidden className="shrink-0 font-inter text-sm text-meetoo-accent-dark/50">→</span>
      </Link>
    )
  return (
    <article className="overflow-hidden rounded-2xl border border-white/80 bg-white/60 shadow-sm">
      {foto && (
        <Link href={pagina} aria-label={evento.titolo} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="" className="aspect-[2/1] w-full object-cover" loading="lazy" />
        </Link>
      )}
      <div className="px-5 py-5">
        <p className="font-inter text-[10px] font-normal uppercase tracking-[0.2em] text-meetoo-accent-dark/50">
          {giornoEvento(evento.inizio)} · {oreEvento(evento)}
        </p>
        <h3 className="mt-1 font-inter text-lg font-bold leading-snug text-meetoo-accent-dark">
          <Link href={pagina}>{evento.titolo}</Link>
        </h3>
        {evento.descrizione && (
          <p
            className={`mt-2 whitespace-pre-line font-inter text-sm font-light leading-relaxed text-meetoo-accent-dark/75 ${
              intera ? '' : 'line-clamp-3'
            }`}
          >
            {evento.descrizione}
          </p>
        )}
        <a
          href={whatsappEvento(evento)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block rounded-full border border-meetoo-accent-dark/30 py-3 text-center font-inter text-[11px] font-normal uppercase tracking-widest text-meetoo-accent-dark transition-colors hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light"
        >
          Scrivici su WhatsApp
        </a>
      </div>
    </article>
  )
}
