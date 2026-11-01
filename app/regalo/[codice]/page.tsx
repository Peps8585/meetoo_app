import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GiftCardVisual } from '@/components/regalo/GiftCardVisual'
import { getGiftCardByCode } from '@/lib/gift/data'
import { fmtDay, fmtDayTime, fmtEuro, giftContents } from '@/lib/gift/format'
import { giftUrl } from '@/lib/gift/fulfill'
import { qrSvg } from '@/lib/gift/qr'
import { getGiftStaff } from '@/lib/gift/staff'
import { createAdminClient } from '@/lib/supabase/admin'
import { AttivaRegalo } from './AttivaRegalo'
import { StampaRegalo } from './StampaRegalo'

// il link del regalo e' personale: niente motori di ricerca
export const metadata: Metadata = { title: 'Un regalo per te · Mee Too Pilates', robots: { index: false, follow: false } }

// numero WhatsApp dello studio (dal 07/09/2026)
const WHATSAPP_STUDIO = '393892952958'

const pulsanteScuro =
  'mt-6 block w-full rounded-full bg-[#2c2c2c] py-[15px] text-center text-[15px] font-medium text-[#f5f0e8] transition-colors hover:bg-[#7d8b78] print:hidden'

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

  const staff = await getGiftStaff()
  const perLoStudio = staff?.studioId === card.studio_id
  const scaduto = !!card.valid_until && new Date(card.valid_until) < new Date() && card.status !== 'redeemed'
  const attivabile = (card.status === 'paid' || card.status === 'delivered') && !scaduto

  const validita = card.valid_until
    ? `Vale fino al ${fmtDay(card.valid_until)}`
    : `Vale ${card.valid_months} mesi da quando arriva${card.send_at ? `, il ${fmtDayTime(card.send_at)}` : ''}`
  const testoStudio = `Ciao, ho ricevuto una gift card da ${card.from_name}: ${giftContents(card)}, codice ${card.code}. Vorrei venire in studio.`
  const qr = attivabile ? await qrSvg(giftUrl(card.code)) : null

  let attivatoDa: string | null = null
  if (perLoStudio && card.activated_by) {
    const { data } = await createAdminClient().from('profiles').select('first_name, last_name').eq('id', card.activated_by).maybeSingle()
    attivatoDa = [data?.first_name, data?.last_name].filter(Boolean).join(' ') || null
  }

  const righeStudio: [string, string][] = [
    ['Pagato', `${fmtEuro(card.price)}${card.paid_at ? ` il ${fmtDay(card.paid_at)}` : ''}`],
    [scaduto ? 'Scaduto il' : 'Vale fino al', card.valid_until ? fmtDay(card.valid_until) : 'parte dalla consegna'],
    ['Codice', card.code],
  ]
  if (card.status === 'redeemed') {
    righeStudio.push(['Attivato', `${card.redeemed_at ? fmtDay(card.redeemed_at) : ''}${attivatoDa ? `, da ${attivatoDa}` : ''}`])
    righeStudio.push(['Chi lo usa', [card.holder_name, card.holder_phone].filter(Boolean).join(', ')])
    if (card.studio_note) righeStudio.push(['Gruppo o note', card.studio_note])
  }

  return (
    <main className="min-h-svh bg-[#f5f0e8] px-5 pb-16 text-[#2c2c2c] print:bg-white">
      <div className="mx-auto max-w-[460px]">
        <div className="flex h-14 items-center justify-center text-[11px] font-bold tracking-[0.22em]">MEE TOO PILATES</div>

        {perLoStudio && (
          <section className="mb-8 rounded-2xl bg-[#fffdf9] p-5 shadow-[0_1px_2px_rgb(44_44_44/0.06),0_8px_24px_rgb(44_44_44/0.08)] print:hidden">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a63]">Studio · regalo</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  card.status === 'redeemed'
                    ? 'bg-[#dfe8da] text-[#4e5e49]'
                    : scaduto || card.status === 'void'
                      ? 'bg-[#f3e3df] text-[#8a4f40]'
                      : 'bg-[#efe1ce] text-[#7a5a3d]'
                }`}
              >
                {card.status === 'redeemed' ? 'Attivato' : card.status === 'void' ? 'Annullato' : scaduto ? 'Scaduto' : 'Da attivare'}
              </span>
            </div>
            <p className="text-[17px] font-semibold">{giftContents(card)}</p>
            <p className="text-sm text-[#6f6a63]">
              da {card.from_name} per {card.to_name}
            </p>
            <dl className="mt-3 text-[13px]">
              {righeStudio.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-[#2c2c2c]/[0.08] py-1.5">
                  <dt className="text-[#6f6a63]">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            {attivabile && <AttivaRegalo code={card.code} toName={card.to_name} />}
            <Link href="/studio/regali" className="mt-4 block text-center text-[13px] underline underline-offset-4">
              Tutti i regali
            </Link>
          </section>
        )}

        <div className="animate-in fade-in slide-in-from-bottom-6 zoom-in-95 duration-1000 fill-mode-both">
          <GiftCardVisual coverUrl={card.cover_url} occasion={card.occasion} toName={card.to_name} title={card.product_title} discipline={card.discipline} />
        </div>

        {card.message && (
          <div className="mt-7 animate-in fade-in slide-in-from-bottom-3 delay-700 duration-700 fill-mode-both">
            <p className="whitespace-pre-line text-[21px] font-light leading-[1.45] tracking-[-0.01em]">{card.message}</p>
            <p className="mt-3.5 text-sm text-[#6f6a63]">{card.from_name}</p>
          </div>
        )}

        <div className="mt-7 rounded-xl bg-[#e6dccd] p-[18px] animate-in fade-in slide-in-from-bottom-3 delay-1000 duration-700 fill-mode-both print:border print:border-[#e6dccd]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8876a]">
            {card.message ? 'Il tuo regalo' : `Un regalo da ${card.from_name}`}
          </span>
          <b className="mb-0.5 mt-1.5 block text-[17px] font-semibold">{giftContents(card)}</b>
          {card.status === 'redeemed' ? (
            <span className="text-[13px] text-[#6f6a63]">
              Attivato in studio{card.redeemed_at ? ` il ${fmtDay(card.redeemed_at)}` : ''}. Buone lezioni!
            </span>
          ) : card.status === 'void' ? (
            <span className="text-[13px] text-[#6f6a63]">Questo regalo è stato annullato.</span>
          ) : scaduto ? (
            <span className="text-[13px] text-[#6f6a63]">Questo regalo è scaduto il {fmtDay(card.valid_until!)}.</span>
          ) : (
            <>
              <span className="text-[13px] text-[#6f6a63]">{validita}</span>
              {qr && (
                <div className="mt-3.5 flex items-center gap-4">
                  <div
                    className="w-[120px] flex-none overflow-hidden rounded-lg [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: qr }}
                  />
                  <p className="text-[13px] leading-[1.45] text-[#4a4744]">
                    <span className="mb-1 block text-[18px] font-semibold tracking-[0.12em] text-[#2c2c2c]">{card.code}</span>
                    Mostra questo QR in studio la prima volta che vieni: lo attiviamo insieme e scegliamo il gruppo giusto per te.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="animate-in fade-in delay-[1300ms] duration-700 fill-mode-both">
          {stampa ? (
            <StampaRegalo />
          ) : (
            card.status !== 'void' && (
              <a href={`https://wa.me/${WHATSAPP_STUDIO}?text=${encodeURIComponent(testoStudio)}`} className={pulsanteScuro}>
                Scrivi allo studio per venire
              </a>
            )
          )}
          <p className="mt-6 text-center text-[13px] leading-relaxed text-[#6f6a63]">Mee Too Pilates, Pieve di Curtarolo (PD)</p>
          {!staff && attivabile && (
            <Link
              href={`/login?next=${encodeURIComponent(`/regalo/${card.code}`)}`}
              className="mt-8 block text-center text-xs text-[#6f6a63] underline underline-offset-4 print:hidden"
            >
              Sei dello studio? Entra per attivarlo
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
