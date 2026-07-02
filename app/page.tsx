import Link from 'next/link'
import WordmarkMeeToo from './WordmarkMeeToo'
import WelcomeChoreography from './WelcomeChoreography'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen bg-meetoo-bg-light px-6 py-24">
      {/* h1 reale per accessibilità/SEO: la landing non resta senza intestazione
          testuale anche se il wordmark è un'immagine. */}
      <h1 className="sr-only">Mee Too — Pilates, Yoga, Mindfulness</h1>

      <WelcomeChoreography>
        <div className="text-center flex flex-col items-center">
          {/* Lockup brand: anelli + wordmark leggono come UN'unità → gap piccolo. */}
          <div className="flex flex-col items-center gap-4">
            {/* Anelli del brand: due <circle> separati nel DOM così ognuno converge
                per conto suo. Decorativi → aria-hidden. */}
            <svg
              className="text-meetoo-accent-dark"
              width="120"
              height="90"
              viewBox="0 0 134 101"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <circle
                className="mt-anim mt-ring-left"
                cx="48"
                cy="50"
                r="33"
                stroke="currentColor"
                strokeWidth="10"
              />
              <circle
                className="mt-anim mt-ring-right"
                cx="86"
                cy="50"
                r="33"
                stroke="currentColor"
                strokeWidth="10"
              />
            </svg>

            {/* Wordmark MEE/TOO: SVG inline, currentColor eredita dal contenitore
                (text-meetoo-accent-dark = token scuro di palette). */}
            <div className="mt-anim mt-wordmark text-meetoo-accent-dark w-60 md:w-75 h-auto">
              <WordmarkMeeToo />
            </div>

            {/* Descrittore discipline: parte del lockup (gap piccolo), sale con
                il wordmark riusando la battuta mt-wordmark (rise, stesso easing). */}
            <p className="mt-anim mt-wordmark font-inter font-extrabold uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark">
              PILATES · YOGA · MINDFULNESS
            </p>
          </div>

          {/* Tagline: solo desktop (resta nel DOM), stacco medio dal lockup (mt-10). */}
          <p className="mt-anim mt-copy hidden md:block font-inter font-light text-lg md:text-xl text-meetoo-accent-dark max-w-md leading-relaxed mt-10">
            Ritrova il tuo equilibrio. Corpo, respiro e consapevolezza in ogni
            lezione.
          </p>

          {/* CTA + link: stacco medio dalla copy (mt-8), interno piccolo. */}
          <div className="flex flex-col items-center gap-4 mt-8">
            <Link
              href="/registrati"
              className="mt-anim mt-cta inline-block bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal tracking-wide text-base px-12 py-4 rounded-full transition-colors duration-300 hover:bg-meetoo-accent-light"
            >
              Entra
            </Link>
            <Link
              href="/login"
              className="mt-anim mt-login font-inter text-sm text-meetoo-accent-dark/80 underline underline-offset-4 decoration-meetoo-accent-light transition-colors duration-300 hover:text-meetoo-accent-light"
            >
              Hai già un account? Accedi
            </Link>
          </div>
        </div>
      </WelcomeChoreography>
    </main>
  )
}
