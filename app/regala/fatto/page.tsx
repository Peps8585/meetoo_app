import type { Metadata } from 'next'
import Link from 'next/link'
import { GiftCardVisual } from '@/components/regalo/GiftCardVisual'
import { deliverySentence, fulfillCheckoutSession, giftUrl } from '@/lib/gift/fulfill'
import { giftContents } from '@/lib/gift/format'

export const metadata: Metadata = { title: 'Regalo pronto · Mee Too Pilates', robots: { index: false } }

export default async function FattoPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams
  // il webhook potrebbe non essere ancora arrivato: si chiude il pagamento anche da qui
  const card = session_id ? await fulfillCheckoutSession(session_id) : null

  if (!card || card.status === 'pending') {
    return (
      <main className="min-h-svh bg-[#f5f0e8] px-5 py-16 text-[#2c2c2c]">
        <div className="mx-auto max-w-[460px]">
          <h1 className="text-[26px] font-light tracking-[-0.025em]">Il pagamento non risulta completato.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6f6a63]">Se hai chiuso la pagina di pagamento, nessun addebito è stato fatto.</p>
          <Link href="/regala" className="mt-6 inline-block rounded-full bg-[#2c2c2c] px-8 py-3.5 text-[15px] font-medium text-[#f5f0e8]">
            Torna al regalo
          </Link>
        </div>
      </main>
    )
  }

  const link = giftUrl(card.code)
  const testoWhatsApp = `Ciao ${card.to_name}, ti ho fatto un regalo da Mee Too Pilates. Lo apri da qui: ${link}`

  return (
    <main className="min-h-svh bg-[#f5f0e8] px-5 pb-16 text-[#2c2c2c]">
      <div className="mx-auto max-w-[460px]">
        <div className="mb-2 mt-8 grid h-16 w-16 place-items-center rounded-full bg-[#7d8b78] text-3xl text-white">✓</div>
        <h1 className="mb-3 mt-2 text-[28px] font-light leading-[1.15] tracking-[-0.025em]">
          Fatto, <b className="font-semibold">{card.from_name}</b>.
        </h1>
        <p className="text-[15px] leading-relaxed text-[#6f6a63]">
          {deliverySentence(card)} Ti abbiamo mandato la ricevuta e il link del regalo a {card.buyer_email}.
        </p>
        <div className="mt-6">
          <GiftCardVisual coverUrl={card.cover_url} occasion={card.occasion} toName={card.to_name} title={card.product_title} discipline={card.discipline} />
        </div>
        <p className="mt-4 text-sm text-[#6f6a63]">{giftContents(card)}</p>

        {card.delivery === 'self' ? (
          <>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(testoWhatsApp)}`}
              className="mt-6 block w-full rounded-full bg-[#2c2c2c] py-[15px] text-center text-[15px] font-medium text-[#f5f0e8] transition-colors hover:bg-[#7d8b78]"
            >
              Mandalo su WhatsApp
            </a>
            <Link
              href={`/regalo/${card.code}?stampa=1`}
              className="mt-3 block w-full rounded-full border border-[#2c2c2c]/20 py-[15px] text-center text-[15px] font-medium transition-colors hover:bg-[#2c2c2c] hover:text-[#f5f0e8]"
            >
              Aprilo per stamparlo
            </Link>
          </>
        ) : (
          <Link
            href={`/regalo/${card.code}`}
            className="mt-6 block w-full rounded-full border border-[#2c2c2c]/20 py-[15px] text-center text-[15px] font-medium transition-colors hover:bg-[#2c2c2c] hover:text-[#f5f0e8]"
          >
            Guarda cosa vede {card.to_name}
          </Link>
        )}
      </div>
    </main>
  )
}
