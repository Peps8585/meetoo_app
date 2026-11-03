import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type GiftStaff = { id: string; name: string; studioId: string }

/**
 * Chi sta guardando e' dello studio? Admin o istruttrice attiva, entrata con il
 * suo account. Serve a mostrare il pulsante di attivazione solo a loro: per
 * tutti gli altri il QR mostra il regalo e basta.
 */
export async function getGiftStaff(): Promise<GiftStaff | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, studio_id, is_active')
    .eq('id', user.id)
    .maybeSingle()
  if (!data?.studio_id || !['admin', 'instructor'].includes(data.role) || data.is_active === false) return null
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || user.email || 'Studio'
  return { id: data.id, name, studioId: data.studio_id }
}

/** Solo admin (non istruttrici): per le pagine con i dati delle persone. */
export async function getAdminStaff(): Promise<GiftStaff | null> {
  const staff = await getGiftStaff()
  if (!staff) return null
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('role').eq('id', staff.id).maybeSingle()
  return data?.role === 'admin' ? staff : null
}
