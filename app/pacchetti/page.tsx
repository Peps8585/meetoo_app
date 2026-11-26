import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'
import { acquirente, acquistoAperto, pacchettiInVendita, SOGLIA_BOLLO } from '@/lib/pacchetti/negozio'
import Negozio from './Negozio'

export const metadata: Metadata = { title: 'Pacchetti · Mee Too Pilates', robots: { index: false } }
export const dynamic = 'force-dynamic'

const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

const ORDINE = ['Reformer', 'Matwork', 'MAM', 'Yoga', 'Altri pacchetti']

export default async function PacchettiPage() {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)
  if (!user) redirect('/login')

  const c = await acquirente(user.id)
  if (!c?.studio_id) redirect('/dashboard')
  const [pacchetti, aperto] = await Promise.all([pacchettiInVendita(c.studio_id), acquistoAperto(c.studio_id)])
  const puoComprare = aperto && c.role === 'client' && !!c.approvata_at

  const gruppi = ORDINE.map((d) => ({ d, lista: pacchetti.filter((p) => p.disciplina === d) })).filter((g) => g.lista.length)

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/profilo"
            className="inline-flex items-center gap-1.5 font-inter font-light text-[11px] uppercase tracking-widest text-meetoo-accent-dark/45 hover:text-meetoo-accent-dark transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Profilo
          </Link>
          <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl sm:text-4xl text-meetoo-accent-dark leading-none">
            Pacchetti
          </h1>
        </div>

        {!puoComprare && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 flex gap-3">
            <Store className="shrink-0 w-4 h-4 mt-0.5 text-amber-700" />
            <p className="font-inter text-sm leading-snug text-amber-800">
              {aperto
                ? 'Potrai acquistare i pacchetti da qui appena lo studio avrà confermato la tua iscrizione. Intanto puoi comprarli in studio, come sempre.'
                : 'Qui trovi i prezzi di tutti i nostri pacchetti. Presto potrai acquistarli anche dall’app; per ora si comprano in studio, come sempre.'}
            </p>
          </div>
        )}

        <Negozio gruppi={gruppi} puoComprare={puoComprare} />

        <p className="mt-6 mb-24 font-inter font-light text-xs leading-relaxed text-meetoo-accent-dark/50">
          Sopra {euro(SOGLIA_BOLLO)} la legge chiede la marca da bollo
          di 2 €, che si aggiunge al prezzo. Puoi sempre acquistare i pacchetti anche in studio.
        </p>
      </div>
    </main>
  )
}
