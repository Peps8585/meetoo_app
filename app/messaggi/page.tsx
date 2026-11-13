import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'
import Filo, { type Messaggio } from '@/components/messaggi/Filo'
import Scrivi from '@/components/messaggi/Scrivi'
import { rispondi } from './actions'

// Il filo della cliente con lo studio: i messaggi che lo studio le ha mandato
// (a lei, alla sua lezione o a tutte) e le sue risposte. Aprendo la pagina i
// messaggi dello studio risultano letti.
export default async function MessaggiPage() {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('messaggi')
    .select('id, da, testo, created_at, letto_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  const messaggi = ((data ?? []) as Messaggio[]).reverse()

  if (messaggi.some((m) => m.da === 'studio' && !m.letto_at)) await supabase.rpc('messaggi_segna_letti')

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="font-inter text-[11px] font-semibold uppercase tracking-[0.3em] text-meetoo-accent-dark/50">Mee Too Pilates</p>
        <h1 className="mb-8 font-inter text-3xl font-extrabold uppercase tracking-wide text-meetoo-accent-dark">Messaggi</h1>
        <Filo
          messaggi={messaggi}
          io="cliente"
          nomeAltro="Lo studio"
          vuoto="Qui trovi i messaggi dello studio. Se hai bisogno di qualcosa puoi scriverci da qui sotto."
        />
        <Scrivi invia={rispondi} segnaposto="Scrivi allo studio" />
      </div>
    </main>
  )
}
