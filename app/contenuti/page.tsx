import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'

// Contenuti online dello studio: per ora la pagina che li annuncia (Mattia 24/11/2026).
// Il riquadro "Contenuti" della home resta e porta qui; quando la sezione sara' pronta
// questa pagina diventa l'elenco dei contenuti.
export default async function ContenutiPage() {
  const supabase = await createClient()
  if (!(await utenteDaSessione(supabase))) redirect('/login')

  return (
    <main className="min-h-screen bg-meetoo-bg-light">
      <div className="relative h-[58vh] min-h-[340px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/apertura/4.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-meetoo-bg-light" />
        <Link
          href="/dashboard"
          className="absolute left-4 top-6 rounded-full bg-white/80 px-4 py-2 font-inter text-[11px] uppercase tracking-widest text-meetoo-accent-dark backdrop-blur-sm"
        >
          ← Home
        </Link>
      </div>

      <div className="relative -mt-16 px-4 pb-12 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/80 bg-white/70 px-6 py-7 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-meetoo-accent-dark">
              <Play className="h-4 w-4 text-white" />
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-inter text-[10px] font-semibold uppercase tracking-widest text-amber-800">
              In arrivo
            </span>
          </div>
          <h1 className="mt-4 font-inter text-2xl font-extrabold leading-tight text-meetoo-accent-dark">
            I nostri contenuti, anche a casa
          </h1>
          <p className="mt-3 font-inter text-[15px] font-light leading-relaxed text-meetoo-accent-dark/80">
            Qui troverai i contenuti che i nostri istruttori, le nostre istruttrici e i professionisti che collaborano con lo
            studio preparano per te: potrai guardarli da casa o da dove preferisci, quando hai un momento libero.
          </p>
          <p className="mt-3 font-inter text-[15px] font-light leading-relaxed text-meetoo-accent-dark/80">
            Stiamo preparando questa sezione con cura. Appena sarà pronta la troverai qui, dentro l&apos;app, e ti avviseremo noi!
          </p>
          <Link
            href="/dashboard"
            className="mt-6 block rounded-full bg-meetoo-accent-dark py-3.5 text-center font-inter text-[11px] uppercase tracking-widest text-white"
          >
            Torna alla home
          </Link>
        </div>
      </div>
    </main>
  )
}
