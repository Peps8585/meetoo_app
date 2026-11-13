'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { utenteDaSessione } from '@/lib/supabase/utente'
import { avvisaStudio } from '@/lib/messaggi'

const ERRORI: Record<string, string> = {
  not_client: 'Da questo account non si può scrivere allo studio.',
  testo_vuoto: 'Scrivi qualcosa prima di inviare.',
  testo_lungo: 'Il messaggio è troppo lungo.',
  troppi_messaggi: 'Hai scritto molti messaggi in poco tempo. Riprova tra un po’, oppure scrivici su WhatsApp.',
}

/** La cliente scrive (o risponde) allo studio dal suo filo. */
export async function rispondi(testo: string): Promise<{ ok: boolean; messaggio?: string }> {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)
  if (!user) return { ok: false, messaggio: 'Entra di nuovo nell’app e riprova.' }
  const { error } = await supabase.rpc('messaggio_rispondi', { p_testo: testo })
  if (error) return { ok: false, messaggio: ERRORI[error.message] ?? 'Il messaggio non è partito. Riprova.' }
  await avvisaStudio(createAdminClient(), user.id, testo.trim())
  revalidatePath('/messaggi')
  revalidatePath('/admin/messaggi')
  return { ok: true }
}
