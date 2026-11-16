import Link from 'next/link'
import { Logo } from './Logo'
import WelcomeChoreography from './WelcomeChoreography'
import SfondoApertura from './SfondoApertura'

export default function Home() {
  return (
    <main className="mt-apertura relative flex flex-1 flex-col items-center justify-center min-h-screen bg-meetoo-accent-dark px-6 py-24">
      <SfondoApertura />

      {/* h1 reale per accessibilità/SEO: la landing non resta senza intestazione
          testuale anche se il wordmark è un'immagine. */}
      <h1 className="sr-only">Mee Too — Pilates, Yoga, Mindfulness</h1>

      <WelcomeChoreography>
        <div className="relative text-center flex flex-col items-center">
          {/* Lockup brand = sistema <Logo> (single source of truth: anelli +
              wordmark, taglia guidata da --mt-logo-w). Decorativo: il nome
              accessibile è già nell'h1 sr-only sopra. Nessun descriptor — la
              disciplina singola compare solo nelle sezioni dedicate. Gli hook
              di animazione (mt-mark-ring-*, mt-logo-wordmark) sono interni al
              componente: la coreografia li aggancia da globals.css. */}
          <Logo
            variant="full"
            className="text-meetoo-bg-light drop-shadow-[0_1px_12px_rgba(0,0,0,0.35)] [--mt-logo-w:240px] md:[--mt-logo-w:300px]"
          />

          {/* Tagline: solo desktop (resta nel DOM), stacco medio dal lockup (mt-10). */}
          <p className="mt-anim mt-copy hidden md:block font-inter font-light text-lg md:text-xl text-meetoo-bg-light max-w-md leading-relaxed mt-10">
            Ritrova il tuo equilibrio. Corpo, respiro e consapevolezza in ogni
            lezione.
          </p>

          {/* CTA + link: stacco medio dalla copy (mt-8), interno piccolo.
              Su mobile più aria prima del pulsante (mt-24). */}
          <div className="flex flex-col items-center gap-4 mt-24 md:mt-8">
            <Link
              href="/registrati"
              className="mt-anim mt-cta inline-block bg-meetoo-bg-light text-meetoo-accent-dark font-inter font-medium tracking-wide text-base px-12 py-4 rounded-full transition-colors duration-300 hover:bg-white"
            >
              Entra
            </Link>
            <Link
              href="/login"
              className="mt-anim mt-login font-inter text-sm text-meetoo-bg-light/90 underline underline-offset-4 decoration-meetoo-bg-light/50 transition-colors duration-300 hover:text-white"
            >
              Hai già un account? Accedi
            </Link>
          </div>
        </div>
      </WelcomeChoreography>
    </main>
  )
}
