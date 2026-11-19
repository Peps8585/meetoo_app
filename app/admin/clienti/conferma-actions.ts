'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { avvisaClienteConfermata } from '@/lib/approvazione/avvisi'

// Lo studio conferma o non accetta una cliente appena iscritta (19/11/2026).
// Il controllo che chi chiama sia admin dello stesso studio lo fa approva_cliente.
export async function decidiCliente(clientId: string, si: boolean): Promise<{ ok: boolean; errore?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('approva_cliente', { p_client: clientId, p_si: si })
  if (error) return { ok: false, errore: 'Non è andata, riprova tra poco.' }
  if (si) {
    try {
      await avvisaClienteConfermata(clientId)
    } catch (e) {
      console.error('[clienti] avviso di conferma non partito', e)
    }
  }
  revalidatePath('/admin/clienti')
  revalidatePath('/agenda')
  return { ok: true }
}
