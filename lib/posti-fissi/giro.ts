import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { avvisoEmail } from '@/lib/email/templates'
import { inviaNotifica } from '@/lib/push/send'
import {
  testoPacchetto,
  testoPacchettoStudio,
  testoPostoLibero,
  testoPromemoria,
  type Avviso,
} from '@/lib/posti-fissi/testi'

const APP_URL = process.env.APP_URL ?? 'https://meetoo-app-ntls.vercel.app'

export type Admin = ReturnType<typeof createAdminClient>

async function contatto(admin: Admin, clientId: string) {
  const [{ data: u }, { data: p }] = await Promise.all([
    admin.auth.admin.getUserById(clientId),
    admin.from('profiles').select('first_name, last_name').eq('id', clientId).maybeSingle(),
  ])
  return {
    email: u.user?.email ?? null,
    nome: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || (u.user?.email ?? 'Una cliente'),
  }
}

/**
 * Prima la notifica sul telefono; se non arriva a nessun dispositivo, l'email
 * con gli stessi testi. Ritorna il canale usato.
 */
export async function avvisa(
  admin: Admin,
  clientId: string,
  a: Avviso,
  url: string,
  pulsanti?: { primo: { href: string; label: string }; secondo?: { href: string; label: string } }
): Promise<'push' | 'email' | 'nessuno'> {
  if ((await inviaNotifica(clientId, { titolo: a.titolo, testo: a.testo, url })) > 0) return 'push'
  const { email } = await contatto(admin, clientId)
  if (!email) return 'nessuno'
  const { subject, html } = avvisoEmail({
    titolo: a.titolo,
    testo: a.testo,
    pulsante: pulsanti?.primo ?? { href: url, label: 'Apri' },
    secondo: pulsanti?.secondo,
  })
  return (await sendEmail({ to: email, subject, html })).ok ? 'email' : 'nessuno'
}

async function emailStudio(admin: Admin, studioId: string): Promise<string | null> {
  if (process.env.GIFT_STUDIO_EMAIL) return process.env.GIFT_STUDIO_EMAIL
  const { data } = await admin.from('studios').select('email').eq('id', studioId).maybeSingle()
  return data?.email ?? null
}

/**
 * Lista d'attesa: avvisa chi ha un posto tenuto per lei (la prima in lista per
 * ogni posto libero). Lo usa il giro, e la pagina della risposta subito dopo un
 * "Questa volta no", cosi' la seconda non aspetta il giro dopo.
 */
export async function avvisiLista(admin: Admin) {
  const canali: ('push' | 'email' | 'nessuno')[] = []
  const { data: lista, error } = await admin.rpc('posti_fissi_avvisi_lista')
  if (error) throw new Error(`posti_fissi_avvisi_lista: ${error.message}`)
  for (const r of (lista ?? []) as {
    client_id: string
    action_token: string
    starts_at: string
    class_name: string
    offer_expires_at: string
  }[]) {
    const url = `${APP_URL}/presenza/${r.action_token}`
    canali.push(
      await avvisa(admin, r.client_id, testoPostoLibero(r.class_name, r.starts_at, r.offer_expires_at), url, {
        primo: { href: `${url}?r=prendo`, label: 'Lo prendo' },
        secondo: { href: `${url}?r=lascia`, label: 'Questa volta no' },
      })
    )
  }
  return canali
}

/** Il giro dei posti fissi: lo chiama /api/posti-fissi/giro ogni 10 minuti. */
export async function giroPostiFissi() {
  const admin = createAdminClient()
  const esito = { posti: null as unknown, promemoria: 0, pacchetto: 0, lista: 0, email: 0, push: 0 }

  // 1. posti tenuti, prenotazioni a una settimana, posti liberati per pacchetto finito
  const { data: giro, error } = await admin.rpc('posti_fissi_giro')
  if (error) throw new Error(`posti_fissi_giro: ${error.message}`)
  esito.posti = giro

  const conta = (canale: string) => {
    if (canale === 'push') esito.push++
    if (canale === 'email') esito.email++
  }

  // 2. promemoria alle fisse: "ci sei?"
  const { data: prom } = await admin.rpc('posti_fissi_promemoria')
  for (const r of (prom ?? []) as {
    booking_id: string
    client_id: string
    action_token: string
    starts_at: string
    class_name: string
  }[]) {
    const url = `${APP_URL}/presenza/${r.action_token}`
    const canale = await avvisa(admin, r.client_id, testoPromemoria(r.class_name, r.starts_at), url, {
      primo: { href: `${url}?r=ci_sono`, label: 'Ci sono' },
      secondo: { href: `${url}?r=non_vengo`, label: 'Questa volta no' },
    })
    await admin.from('bookings').update({ reminder_channel: canale }).eq('id', r.booking_id)
    esito.promemoria++
    conta(canale)
  }

  // 3. pacchetto finito: alla cliente e allo studio
  const { data: pac } = await admin.rpc('posti_fissi_avvisi_pacchetto')
  for (const r of (pac ?? []) as {
    client_id: string
    studio_id: string
    issue: string
    starts_at: string
    class_name: string
  }[]) {
    const { data: entro } = await admin.rpc('reminder_due_at', { p_starts: r.starts_at })
    conta(
      await avvisa(
        admin,
        r.client_id,
        testoPacchetto(r.issue, r.class_name, r.starts_at, (entro as string) ?? r.starts_at),
        `${APP_URL}/dashboard`
      )
    )
    const studio = await emailStudio(admin, r.studio_id)
    if (studio) {
      const { nome } = await contatto(admin, r.client_id)
      const a = testoPacchettoStudio(r.issue, nome, r.class_name, r.starts_at)
      const { subject, html } = avvisoEmail({
        titolo: a.titolo,
        testo: a.testo,
        pulsante: { href: `${APP_URL}/admin/clienti/${r.client_id}`, label: 'Apri la scheda' },
      })
      await sendEmail({ to: studio, subject, html })
    }
    esito.pacchetto++
  }

  // 4. lista d'attesa: offerte scadute passano avanti, poi gli avvisi alle prime in lista
  const { error: errScad } = await admin.rpc('lista_scadenze')
  if (errScad) throw new Error(`lista_scadenze: ${errScad.message}`)
  for (const canale of await avvisiLista(admin)) {
    conta(canale)
    esito.lista++
  }

  return esito
}
