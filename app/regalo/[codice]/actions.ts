'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGiftCardByCode } from '@/lib/gift/data'
import { getGiftStaff } from '@/lib/gift/staff'
import { addMonths, fmtDay, giftContents } from '@/lib/gift/format'
import { sendEmail } from '@/lib/email/send'
import { giftActivatedEmail } from '@/lib/email/templates'

/**
 * Attiva il regalo in studio: lo fa solo chi e' dello studio, una volta sola.
 * Il controllo vero e' nell'update (status non ancora 'redeemed'): due telefoni
 * che premono insieme non lo attivano due volte.
 */
export async function activateGift(input: {
  code: string
  holderName: string
  holderPhone: string
  note: string
}): Promise<{ ok: true } | { error: string }> {
  const staff = await getGiftStaff()
  if (!staff) return { error: "Per attivare un regalo bisogna essere entrati con l'account dello studio." }

  const card = await getGiftCardByCode(input.code)
  if (!card || card.studio_id !== staff.studioId) return { error: 'Regalo non trovato.' }
  if (card.status === 'redeemed') return { error: `Questo regalo è già stato attivato.` }
  if (card.status === 'void') return { error: 'Questo regalo è stato annullato.' }
  if (card.status === 'pending') return { error: 'Questo regalo non risulta pagato.' }
  if (card.valid_until && new Date(card.valid_until) < new Date()) {
    return { error: `Questo regalo è scaduto il ${fmtDay(card.valid_until)}.` }
  }

  const holderName = input.holderName.trim().slice(0, 80)
  if (!holderName) return { error: 'Scrivi il nome di chi usa il regalo.' }

  const ora = new Date()
  const db = createAdminClient()
  const { data } = await db
    .from('gift_cards')
    .update({
      status: 'redeemed',
      redeemed_at: ora.toISOString(),
      activated_by: staff.id,
      holder_name: holderName,
      holder_phone: input.holderPhone.trim().slice(0, 30) || null,
      studio_note: input.note.trim().slice(0, 300) || null,
      // regalo programmato non ancora arrivato ma gia' in studio: i mesi partono da oggi
      ...(card.valid_until ? {} : { valid_until: addMonths(ora, card.valid_months).toISOString(), delivered_at: ora.toISOString() }),
    })
    .eq('id', card.id)
    .in('status', ['paid', 'delivered'])
    .select('id')
  if (!data?.length) return { error: 'Questo regalo è già stato attivato.' }

  // a chi ha regalato: best effort, non blocca l'attivazione
  const { subject, html } = giftActivatedEmail({ fromName: card.from_name, toName: card.to_name, contents: giftContents(card) })
  await sendEmail({ to: card.buyer_email, subject, html })

  revalidatePath(`/regalo/${card.code}`)
  revalidatePath('/studio/regali')
  return { ok: true }
}
