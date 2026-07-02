import Link from 'next/link'
import Image from 'next/image'
import wordmark from '../public/brand/meetoo-wordmark-dark.png'
import WelcomeChoreography from './WelcomeChoreography'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen bg-meetoo-bg-light px-6 py-24">
      {/* h1 reale per accessibilità/SEO: la landing non resta senza intestazione
          testuale anche se il wordmark è un'immagine. */}
      <h1 className="sr-only">Mee Too Pilates</h1>

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

            {/* Wordmark lockup MEE/TOO/PILATES: PNG ritagliato a filo (619x544).
                Proporzione preservata da h-auto sulle dimensioni intrinseche del
                static import → nessuno stiramento. */}
            <Image
              src={wordmark}
              alt="Mee Too Pilates"
              priority
              sizes="(max-width: 768px) 240px, 300px"
              className="mt-anim mt-wordmark w-60 md:w-75 h-auto"
            />
          </div>

          {/* eyebrow + tagline: stacco medio dal brand (mt-10), interno piccolo. */}
          <div className="mt-anim mt-copy flex flex-col items-center gap-3 mt-10">
            <span className="font-inter font-extrabold uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark">
              Studio Pilates &amp; Yoga
            </span>
            <p className="font-inter font-light text-lg md:text-xl text-meetoo-accent-dark max-w-md leading-relaxed">
              Ritrova il tuo equilibrio. Corpo, respiro e consapevolezza in ogni
              lezione.
            </p>
          </div>

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
