import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'

// Gli eventi dello studio. La bacheca vera (post con foto e data) arriva nel
// passo successivo (S35); per ora la pagina esiste perche' la barra la apre.
export default async function EventiPage() {
  const supabase = await createClient()
  if (!(await utenteDaSessione(supabase))) redirect('/login')
  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="font-inter text-[11px] font-semibold uppercase tracking-[0.3em] text-meetoo-accent-dark/50">Mee Too Pilates</p>
        <h1 className="mb-8 font-inter text-3xl font-extrabold uppercase tracking-wide text-meetoo-accent-dark">Eventi</h1>
        <div className="rounded-2xl border border-white/80 bg-white/60 px-5 py-6 text-center shadow-sm">
          <p className="font-inter text-sm font-light text-meetoo-accent-dark/70">Per ora non ci sono eventi in programma.</p>
        </div>
      </div>
    </main>
  )
}
