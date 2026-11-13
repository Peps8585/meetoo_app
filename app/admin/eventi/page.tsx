import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminStaff } from '@/lib/gift/staff'
import { CAMPI_EVENTO, type Evento } from '@/lib/eventi'
import { whatsappAcceso } from '@/lib/whatsapp/send'
import EventiManager from './EventiManager'

// Bacheca degli eventi, lato studio: Giorgia crea il post, sceglie se avvisare
// tutte, e da qui lo cambia o lo toglie.
export default async function AdminEventiPage() {
  const staff = await getAdminStaff()
  if (!staff) redirect('/login?next=/admin/eventi')
  const supabase = await createClient()
  const { data } = await supabase
    .from('eventi')
    .select(CAMPI_EVENTO)
    .eq('studio_id', staff.studioId)
    .order('inizio', { ascending: false })
    .limit(60)

  return (
    <div className="max-w-2xl p-5 sm:p-8">
      <div className="mb-6">
        <p className="mb-1 font-inter text-xs font-normal uppercase tracking-[0.3em] text-meetoo-accent-dark/50">Admin</p>
        <h1 className="font-inter text-3xl font-extrabold uppercase tracking-widest text-meetoo-accent-dark">Eventi</h1>
        <p className="mt-2 max-w-[60ch] font-inter text-sm font-light text-meetoo-accent-dark/55">
          I post della bacheca: compaiono nella home delle clienti e spariscono da soli quando l’evento è passato.
        </p>
      </div>
      <EventiManager
        eventi={(data ?? []) as Evento[]}
        studioId={staff.studioId}
        whatsapp={whatsappAcceso('evento')}
        adesso={new Date().toISOString()}
      />
    </div>
  )
}
