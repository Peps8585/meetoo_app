'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Iscrizione = { endpoint: string; keys: { p256dh: string; auth: string } }

// Salva il telefono su cui la cliente ha detto si' alle notifiche. Lo stesso
// telefono riattivato aggiorna la riga (endpoint unico), non ne crea un'altra.
export async function salvaIscrizione(sub: Iscrizione): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false }

  const { data: profile } = await supabase.from('profiles').select('studio_id').eq('id', user.id).single()
  if (!profile?.studio_id) return { ok: false }

  const { error } = await createAdminClient()
    .from('push_subscriptions')
    .upsert(
      {
        studio_id: profile.studio_id,
        client_id: user.id,
        endpoint: sub.endpoint,
        key_p256dh: sub.keys.p256dh,
        key_auth: sub.keys.auth,
        is_active: true,
      },
      { onConflict: 'endpoint' }
    )
  if (error) console.error('[push] iscrizione non salvata:', error.message)
  return { ok: !error }
}
