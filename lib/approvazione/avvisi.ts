import { createAdminClient } from '@/lib/supabase/admin'
import { avvisa } from '@/lib/posti-fissi/giro'

// Conferma delle clienti nuove da parte dello studio (Mattia 19/11/2026).

const APP_URL = process.env.APP_URL ?? 'https://meetoo-app-ntls.vercel.app'
type Admin = ReturnType<typeof createAdminClient>

/**
 * Avvisa le admin dello studio che una cliente si e' appena iscritta e aspetta
 * la conferma. Si chiama subito dopo la registrazione, quando la cliente non ha
 * ancora una sessione: per questo controlla da se' che l'iscrizione sia di
 * pochi minuti fa e ancora da confermare, e non restituisce niente.
 */
export async function avvisaStudioNuovaIscritta(email: string): Promise<void> {
  const indirizzo = email.trim().toLowerCase()
  if (!indirizzo) return
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const u = data?.users.find((x) => x.email?.toLowerCase() === indirizzo)
  if (!u || Date.now() - new Date(u.created_at).getTime() > 15 * 60 * 1000) return

  const { data: p } = await admin
    .from('profiles')
    .select('studio_id, first_name, last_name, approvata_at, role')
    .eq('id', u.id)
    .maybeSingle()
  if (!p || p.role !== 'client' || p.approvata_at || !p.studio_id) return

  const meta = (u.user_metadata ?? {}) as { nome?: string; cognome?: string }
  const nome =
    [p.first_name ?? meta.nome, p.last_name ?? meta.cognome].filter(Boolean).join(' ') || indirizzo
  await avvisaAdmin(admin, p.studio_id, {
    titolo: 'Una nuova cliente da confermare',
    testo: `${nome} si è iscritta all'app e vuole iniziare a prenotare. Confermala dalla pagina Clienti.`,
  })
}

async function avvisaAdmin(admin: Admin, studioId: string, a: { titolo: string; testo: string }) {
  const { data: staff } = await admin
    .from('profiles')
    .select('id')
    .eq('studio_id', studioId)
    .eq('role', 'admin')
    .eq('is_active', true)
  await Promise.all(
    (staff ?? []).map((s) =>
      avvisa(admin, s.id, a, `${APP_URL}/admin/clienti`, {
        primo: { href: `${APP_URL}/admin/clienti`, label: 'Apri le clienti' },
      })
    )
  )
}

/** Avvisa la cliente che lo studio l'ha confermata. */
export async function avvisaClienteConfermata(clientId: string): Promise<void> {
  const admin = createAdminClient()
  await avvisa(
    admin,
    clientId,
    {
      titolo: 'Sei dentro!',
      testo: 'Lo studio ha confermato la tua iscrizione: da adesso puoi prenotare le lezioni dall’app.',
    },
    `${APP_URL}/palinsesto`,
    { primo: { href: `${APP_URL}/palinsesto`, label: 'Vai al palinsesto' } }
  )
}
