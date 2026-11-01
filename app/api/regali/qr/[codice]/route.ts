import { getGiftCardByCode } from '@/lib/gift/data'
import { giftUrl } from '@/lib/gift/fulfill'
import { qrPng } from '@/lib/gift/qr'

/** Il QR del regalo in PNG, per le email. Solo per regali pagati. */
export async function GET(_request: Request, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params
  const card = await getGiftCardByCode(codice)
  if (!card || card.status === 'pending') return new Response('non trovato', { status: 404 })
  const png = await qrPng(giftUrl(card.code))
  return new Response(new Uint8Array(png), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' },
  })
}
