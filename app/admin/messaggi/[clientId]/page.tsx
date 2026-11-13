import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAdminStaff } from '@/lib/gift/staff'
import Filo, { type Messaggio } from '@/components/messaggi/Filo'
import Scrivi from '@/components/messaggi/Scrivi'
import { scriviACliente } from '../actions'

// Il filo dello studio con una cliente. Aprendolo, le sue risposte risultano lette.
export default async function FiloClientePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const staff = await getAdminStaff()
  if (!staff) redirect('/login?next=/admin/messaggi')
  const supabase = await createClient()

  const [{ data: cliente }, { data }] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, studio_id').eq('id', clientId).maybeSingle(),
    supabase
      .from('messaggi')
      .select('id, da, testo, created_at, letto_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(200),
  ])
  if (!cliente || cliente.studio_id !== staff.studioId) notFound()

  const messaggi = ((data ?? []) as Messaggio[]).reverse()
  if (messaggi.some((m) => m.da === 'cliente' && !m.letto_at)) await supabase.rpc('studio_segna_letti', { p_client: clientId })

  const nome = [cliente.first_name, cliente.last_name].filter(Boolean).join(' ') || 'Cliente'
  const invia = scriviACliente.bind(null, clientId)

  return (
    <div className="max-w-2xl p-5 sm:p-8">
      <Link
        href="/admin/messaggi"
        className="mb-5 inline-flex items-center gap-2 font-inter text-[11px] uppercase tracking-widest text-meetoo-accent-dark/55"
      >
        <ArrowLeft className="h-4 w-4" /> Messaggi
      </Link>
      <div className="mb-6 flex items-end justify-between gap-3">
        <h1 className="font-inter text-2xl font-extrabold uppercase tracking-wide text-meetoo-accent-dark">{nome}</h1>
        <Link href={`/admin/clienti/${clientId}`} className="shrink-0 font-inter text-xs font-light text-meetoo-accent-dark/55">
          Apri la scheda →
        </Link>
      </div>
      <Filo messaggi={messaggi} io="studio" nomeAltro={cliente.first_name ?? nome} vuoto="Non ci sono ancora messaggi con questa cliente." />
      <Scrivi invia={invia} segnaposto={`Scrivi a ${cliente.first_name ?? nome}`} />
    </div>
  )
}
