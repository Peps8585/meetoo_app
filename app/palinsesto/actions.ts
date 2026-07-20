'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { bookingConfirmationEmail } from '@/lib/email/templates'

type ScheduleRow = {
  starts_at: string
  location: string | null
  price_override: number | null
  classes: { name: string; price: number | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
}

// Chiamata fire-and-forget dal palinsesto dopo un book_lesson riuscito.
// L'email parte SOLO se a DB esiste davvero una prenotazione confermata
// dell'utente autenticato su quella lezione: il client fornisce solo lo
// scheduleId, tutto il resto si rilegge dal server sotto RLS.
export async function sendBookingConfirmationEmail(scheduleId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) return

    const { data: booking } = await supabase
      .from('bookings')
      .select('id')
      .eq('client_id', user.id)
      .eq('schedule_id', scheduleId)
      .eq('status', 'confirmed')
      .maybeSingle()
    if (!booking) return

    const { data: schData } = await supabase
      .from('schedules')
      .select(
        `starts_at, location, price_override,
         classes:class_id(name, price),
         profiles:instructor_id(first_name, last_name)`
      )
      .eq('id', scheduleId)
      .single()
    if (!schData) return
    const schedule = schData as unknown as ScheduleRow
    if (!schedule.classes) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single()

    const instructorName = schedule.profiles
      ? [schedule.profiles.first_name, schedule.profiles.last_name].filter(Boolean).join(' ') || null
      : null

    const h = await headers()
    const appUrl = h.get('origin') ?? 'https://meetoo-app-ntls.vercel.app'

    const { subject, html } = bookingConfirmationEmail({
      firstName: profile?.first_name ?? null,
      className: schedule.classes.name,
      startsAt: schedule.starts_at,
      instructorName,
      location: schedule.location,
      // Stessa logica di book_lesson: coalesce(price_override, classes.price)
      price: schedule.price_override ?? schedule.classes.price,
      appUrl,
    })
    await sendEmail({ to: user.email, subject, html })
  } catch (err) {
    // Best-effort: nessun errore deve risalire al flusso di prenotazione.
    console.error('[email] conferma prenotazione fallita:', err)
  }
}
