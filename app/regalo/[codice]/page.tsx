import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GiftCardVisual } from '@/components/regalo/GiftCardVisual'
import { getGiftCardByCode } from '@/lib/gift/data'
import { fmtDay, fmtDayTime, giftContents } from '@/lib/gift/format'
import { StampaRegalo } from './StampaRegalo'

// il link del regalo e' personale: niente motori di ricerca
export const metadata: Metadata = { title: 'Un regalo per te · Mee Too Pilates', robots: { index: false, follow: false } }

// numero WhatsApp dello studio (dal 07/09/2026)
const WHATSAPP_STUDIO = '393892952958'

export default async function RegaloPage({
  params,
  searchParams,
}: {
  params: Promise<{ codice: string }>
  searchParams: Promise<{ stampa?: string }>
}) {
  const { codice } = await params
  const { stampa } = await searchParams
  const card = await getGiftCardByCode(codice)
  if (!card || card.status === 'pending') notFound()

  const validita = card.valid_until
    ? `Vale fino al ${fmtDay(card.valid_until)}`
    : `Vale ${card.valid_months} mesi da quando arriva${card.send_at ? `, il ${fmtDayTime(card.send_at)}` : ''}`
  // finche' non c'e' l'attivazione nell'app (passo 2) si prenota scrivendo allo studio
  const testoStudio = `Ciao, ho ricevuto una gift card da ${card.from_name}: ${giftContents(card)}, codice ${card.code}. Vorrei prenotare la prima lezione.`

  return (
    <main className="min-h-svh bg-[#f5f0e8] px-5 pb-16 text-[#2c2c2c] print:bg-white">
      <div className="mx-auto max-w-[460px]">
        <div className="flex h-14 items-center justify-center text-[11px] font-bold tracking-[0.22em]">MEE TOO PILATES</div>

        <div className="animate-in fade-in slide-in-from-bottom-6 zoom-in-95 duration-1000 fill-mode-both">
          <GiftCardVisual coverUrl={card.cover_url} occasion={card.occasion} toName={card.to_name} title={card.product_title} discipline={card.discipline} />
        </div>

        {card.message && (
          <div className="mt-7 animate-in fade-in slide-in-from-bottom-3 delay-700 duration-700 fill-mode-both">
            <p className="whitespace-pre-line text-[21px] font-light leading-[1.45] tracking-[-0.01em]">{card.message}</p>
            <p className="mt-3.5 text-sm text-[#6f6a63]">{card.from_name}</p>
          </div>
        )}

        <div className="mt-7 rounded-xl bg-[#e6dccd] p-[18px] animate-in fade-in slide-in-from-bottom-3 delay-1000 duration-700 fill-mode-both">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8876a]">
            {card.message ? 'Il tuo regalo' : `Un regalo da ${card.from_name}`}
          </span>
          <b className="mb-0.5 mt-1.5 block text-[17px] font-semibold">{giftContents(card)}</b>
          <span className="text-[13px] text-[#6f6a63]">
            {validita}. Codice {card.code}
          </span>
        </div>

        <div className="animate-in fade-in delay-[1300ms] duration-700 fill-mode-both">
          {card.status === 'void' ? (
            <p className="mt-6 text-[15px] text-[#6f6a63]">Questo regalo è stato annullato.</p>
          ) : stampa ? (
            <StampaRegalo />
          ) : (
            <a
              href={`https://wa.me/${WHATSAPP_STUDIO}?text=${encodeURIComponent(testoStudio)}`}
              className="mt-6 block w-full rounded-full bg-[#2c2c2c] py-[15px] text-center text-[15px] font-medium text-[#f5f0e8] transition-colors hover:bg-[#7d8b78] print:hidden"
            >
              Prenota la prima lezione
            </a>
          )}
          <p className="mt-6 text-center text-[13px] leading-relaxed text-[#6f6a63]">
            Mee Too Pilates, Pieve di Curtarolo (PD)
          </p>
        </div>
      </div>
    </main>
  )
}
