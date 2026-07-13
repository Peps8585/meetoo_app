// <Logo> — composizione canonica del brand Mee Too: anelli (<Mark/>) + wordmark
// (<WordmarkMeeToo/>). Questo file è SOLO composizione + layout + a11y; nessuna
// animazione. I container della variant 'full' portano hook di classe stabili
// (mt-logo-wordmark, mt-logo-descriptor) che affiancano gli mt-mark-ring-* già
// sui <circle> del Mark: le coreografie (es. welcome, in globals.css sotto
// [data-mt-animate="play"]) si agganciano lì, senza che <Logo> sappia nulla.
//
// SORGENTE DI TAGLIA UNICA — W = larghezza resa del wordmark, passata dal consumer
// come CSS var `--mt-logo-w` sul root (responsiva via Tailwind arbitrary variants,
// es. `[--mt-logo-w:240px] md:[--mt-logo-w:300px]`). Mark, gap e descrittore
// derivano TUTTI da W via calc() → il lockstep regge a ogni breakpoint senza
// tarare larghezze fisse per-breakpoint sul mark. Fallback 240px (taglia welcome).
//
// Scala-unità condivisa: la larghezza del mark è W × 0.499 (=127.758/256), cioè
// 1u=1u col wordmark → i px-per-unità coincidono. Lo stroke degli anelli è il
// valore canonico del <Mark> (9, filo fine): NON più in parità con l'anello della
// "O" (la parità geometrica 18.234u è stata superata al bake perché troppo pesante).
import WordmarkMeeToo from './WordmarkMeeToo'
import { Mark } from './Mark'

/** W di riferimento: CSS var dal consumer, fallback alla taglia welcome. */
const W = 'var(--mt-logo-w, 240px)'

/**
 * STRUTTURALE — non toccare: rapporto larghezza mark / larghezza wordmark.
 * 127.758 (viewBox mark) / 256 (larghezza viewBox wordmark). Fissa la scala-unità
 * condivisa 1u=1u tra mark e wordmark (i px-per-unità coincidono): è ciò che tiene
 * il lockstep a ogni taglia, indipendentemente dallo stroke. Cambiarlo lo rompe.
 */
const MARK_RATIO = 0.499

/**
 * TUNABLE — coefficienti di layout espressi come frazione di W, da affinare in
 * browser. Tutti in un punto solo: NON spargere magic number nel JSX.
 */
const TUNE = {
  /** 'full': gap verticale mark↔wordmark (≈0.25× cap-height). */
  fullMarkGap: 0.076,
  /** 'full': gap verticale wordmark↔descrittore. */
  descGap: 0.06,
  /** 'full': font-size del descrittore (frazione di W) — piccolo, NON riempie W. */
  descFont: 0.046,
  /** 'full': tracking del descrittore. */
  descTracking: '0.32em',
  /** 'full': peso del descrittore (tunable, non più una classe). */
  descWeight: 600,
  /** 'compact': gap orizzontale mark↔wordmark (≈0.3× larghezza mark). */
  compactGap: 0.15,
} as const

const mul = (k: number) => `calc(${W} * ${k})`
const MARK_WIDTH = mul(MARK_RATIO)

type LogoProps = {
  /** Layout. 'full' = colonna (mark sopra wordmark, + descrittore opzionale);
   *  'mark' = soli anelli; 'compact' = riga (mark a sinistra del wordmark). */
  variant?: 'full' | 'mark' | 'compact'
  /**
   * Testo sotto il wordmark. Renderizzato SOLO da variant='full'; su 'mark' e
   * 'compact' è ignorato silenziosamente (regola di rendering, non asse hardcoded).
   */
  descriptor?: string
  /**
   * Nome accessibile. Assente (default) → l'intero logo è decorativo
   * (root aria-hidden, contenuto già nominato altrove, es. h1 sr-only di pagina).
   * Presente → root role="img" + aria-label; contenuto interno decorativo.
   */
  label?: string
  /** Sull'<div> root: colore (text-*), taglia (--mt-logo-w), opt-in animazione. */
  className?: string
}

const cx = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(' ')

export function Logo({
  variant = 'full',
  descriptor,
  label,
  className,
}: LogoProps) {
  // <Logo> possiede l'a11y: o l'intero root è decorativo, o il root porta il nome
  // e il contenuto interno è decorativo. In entrambi i casi il Mark è decorativo.
  const rootA11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true } as const)

  if (variant === 'mark') {
    return (
      <div className={cx('inline-flex', className)} {...rootA11y}>
        <div style={{ width: MARK_WIDTH }}>
          <Mark className="block h-auto w-full" decorative />
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    // Centratura verticale OTTICA: items-center allinea i centri dei due box.
    // Il mark (85.172u) sborda un filo sopra le lettere — accettato per design.
    return (
      <div
        className={cx('inline-flex flex-row items-center', className)}
        {...rootA11y}
      >
        <div
          className="shrink-0"
          style={{ width: MARK_WIDTH, marginRight: mul(TUNE.compactGap) }}
        >
          <Mark className="block h-auto w-full" decorative />
        </div>
        <div style={{ width: W }}>
          <WordmarkMeeToo />
        </div>
      </div>
    )
  }

  // variant === 'full'
  return (
    <div
      className={cx('inline-flex flex-col items-center', className)}
      {...rootA11y}
    >
      <div style={{ width: MARK_WIDTH }}>
        <Mark className="block h-auto w-full" decorative />
      </div>
      <div
        className="mt-logo-wordmark"
        style={{ width: W, marginTop: mul(TUNE.fullMarkGap) }}
      >
        <WordmarkMeeToo />
      </div>
      {descriptor ? (
        <p
          className="mt-logo-descriptor font-inter uppercase leading-none"
          style={{
            marginTop: mul(TUNE.descGap),
            fontSize: mul(TUNE.descFont),
            letterSpacing: TUNE.descTracking,
            fontWeight: TUNE.descWeight,
          }}
        >
          {descriptor}
        </p>
      ) : null}
    </div>
  )
}
