'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ERRORI: Record<string, string> = {
  not_admin: 'Solo lo studio può caricare un pacchetto.',
  client_not_found: 'Cliente non trovata.',
  package_not_found: 'Pacchetto non trovato.',
  lezioni_non_valide: 'Il numero di lezioni rimaste non torna con il pacchetto.',
  scadenza_passata: 'La scadenza è già passata.',
}

// Lo studio carica un pacchetto a una cliente (24/11/2026). I controlli
// (admin dello stesso studio, numeri sensati) li fa carica_pacchetto.
export async function caricaPacchetto(p: {
  clientId: string
  packageId: string
  lezioni: number
  scadenza: string | null
  pagatoOggi: boolean
}): Promise<{ ok: boolean; errore?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('carica_pacchetto', {
    p_client: p.clientId,
    p_package: p.packageId,
    p_lezioni_rimaste: p.lezioni,
    p_scadenza: p.scadenza,
    p_pagato_oggi: p.pagatoOggi,
  })
  if (error) {
    const chiave = Object.keys(ERRORI).find((k) => error.message.includes(k))
    return { ok: false, errore: chiave ? ERRORI[chiave] : 'Non è andata, riprova tra poco.' }
  }
  revalidatePath(`/admin/clienti/${p.clientId}`)
  return { ok: true }
}
