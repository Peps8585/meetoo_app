'use client'

import { useMemo, useState, useTransition } from 'react'
import { GiftCardVisual } from '@/components/regalo/GiftCardVisual'
import { OCCASIONI, fmtEuro } from '@/lib/gift/format'
import type { GiftCover, GiftProduct } from '@/lib/gift/data'
import { startGiftCheckout } from './actions'

type Passo = 'scegli' | 'personalizza' | 'consegna' | 'riepilogo'
const PASSI: Passo[] = ['scegli', 'personalizza', 'consegna', 'riepilogo']

const etichetta = 'block text-[12.5px] font-semibold mt-4 mb-1.5'
const campo =
  'w-full rounded-[10px] border border-[#2c2c2c]/15 bg-[#fffdf9] px-3.5 py-3 text-[15px] outline-none focus:border-[#a8876a]'
const pulsante =
  'mt-5 block w-full rounded-full bg-[#2c2c2c] py-[15px] text-center text-[15px] font-medium text-[#f5f0e8] transition-colors duration-300 hover:bg-[#7d8b78] disabled:pointer-events-none disabled:opacity-35'

function Scelta({ si, onClick, titolo, sotto }: { si: boolean; onClick: () => void; titolo: string; sotto?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-2 flex w-full items-center gap-3 rounded-xl border-[1.5px] bg-[#fffdf9] px-4 py-3.5 text-left ${si ? 'border-[#2c2c2c]' : 'border-[#2c2c2c]/10'}`}
    >
      <span className={`h-[18px] w-[18px] flex-none rounded-full ${si ? 'border-[5px] border-[#2c2c2c]' : 'border-[1.5px] border-[#6f6a63]'}`} />
      <span>
        <b className="block text-[14.5px] font-semibold">{titolo}</b>
        {sotto && <small className="text-[12.5px] text-[#6f6a63]">{sotto}</small>}
      </span>
    </button>
  )
}

function oggiARoma() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
}

export function RegalaFlow({
  products,
  covers,
  validMonths,
  scheduling,
}: {
  products: GiftProduct[]
  covers: GiftCover[]
  validMonths: number
  scheduling: boolean
}) {
  const discipline = useMemo(() => [...new Set(products.map((p) => p.discipline))], [products])
  const [passo, setPasso] = useState<Passo>('scegli')
  const [disciplina, setDisciplina] = useState(discipline[0])
  const [productId, setProductId] = useState<string | null>(null)
  const [coverId, setCoverId] = useState(covers[0]?.id)
  const [occasion, setOccasion] = useState<string>('Nessuna')
  const [fromName, setFromName] = useState('')
  const [toName, setToName] = useState('')
  const [message, setMessage] = useState('')
  const [delivery, setDelivery] = useState<'email' | 'self'>('email')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [programma, setProgramma] = useState(false)
  const [sendDate, setSendDate] = useState('')
  const [sendTime, setSendTime] = useState('08:00')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, startTransition] = useTransition()

  const product = products.find((p) => p.id === productId)
  const cover = covers.find((c) => c.id === coverId) ?? covers[0]
  const indice = PASSI.indexOf(passo)
  const vai = (p: Passo) => {
    setErrore(null)
    setPasso(p)
    window.scrollTo({ top: 0 })
  }

  const card = product && cover && (
    <GiftCardVisual
      coverUrl={cover.image_url}
      occasion={occasion}
      toName={toName.trim()}
      title={product.title}
      discipline={product.discipline}
    />
  )

  const paga = () => {
    if (!product || !cover) return
    setErrore(null)
    startTransition(async () => {
      const esito = await startGiftCheckout({
        productId: product.id,
        coverId: cover.id,
        occasion,
        fromName,
        toName,
        message,
        delivery,
        recipientEmail,
        sendDate: scheduling && delivery === 'email' && programma ? sendDate : '',
        sendTime,
        buyerEmail,
      })
      if ('url' in esito) window.location.href = esito.url
      else setErrore(esito.error)
    })
  }

  return (
    <div className="mx-auto w-full max-w-[460px] px-5 pb-16">
      <div className="flex h-14 items-center justify-between">
        <button
          type="button"
          aria-label="Indietro"
          onClick={() => vai(PASSI[indice - 1])}
          className={`h-8 w-8 rounded-full text-xl leading-8 hover:bg-[#e6dccd] ${indice ? '' : 'invisible'}`}
        >
          ‹
        </button>
        <span className="text-[11px] font-bold tracking-[0.22em]">MEE TOO PILATES</span>
        <span className="w-8 text-right text-[11px] text-[#6f6a63]">{indice + 1}/4</span>
      </div>

      {passo === 'scegli' && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8876a]">Gift card</p>
          <h1 className="mb-5 mt-2 text-[28px] font-light leading-[1.15] tracking-[-0.025em]">
            Un momento per sé,
            <br />
            <b className="font-semibold">da regalare.</b>
          </h1>
          <div className="mb-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {discipline.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDisciplina(d)}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] ${d === disciplina ? 'bg-[#2c2c2c] text-[#f5f0e8]' : 'bg-[#ece4d8]'}`}
              >
                {d.replace(' & Chair', '')}
              </button>
            ))}
          </div>
          {products
            .filter((p) => p.discipline === disciplina)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProductId(p.id)
                  // la copertina parte dalla foto della stessa disciplina; chi regala puo' cambiarla
                  const foto = covers.find((c) => c.discipline_slug === p.discipline_slug)
                  if (foto) setCoverId(foto.id)
                }}
                className={`relative mb-2.5 block w-full overflow-hidden rounded-[10px] border-2 bg-[#e6dccd] px-[18px] py-4 text-left shadow-[0_1px_2px_rgb(44_44_44/0.06),0_8px_24px_rgb(44_44_44/0.08)] transition-transform duration-200 hover:-translate-y-px ${p.id === productId ? 'border-[#2c2c2c]' : 'border-transparent'}`}
              >
                {p.detail_image && (
                  // il dettaglio sta solo a destra e sfuma verso il testo: titolo e
                  // descrizione restano sul fondo pieno, il prezzo su una foto molto schiarita
                  <span className="absolute inset-y-0 right-0 w-[56%] [mask-image:linear-gradient(to_right,transparent_0%,rgb(0_0_0/0.55)_45%,#000_100%)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.detail_image} alt="" className="h-full w-full object-cover opacity-[0.42] saturate-[0.75]" />
                  </span>
                )}
                <span className="relative flex items-baseline justify-between">
                  <span className="text-base font-semibold">{p.title}</span>
                  <span className="text-2xl font-light tracking-[-0.03em]">{fmtEuro(p.price)}</span>
                </span>
                <span className="relative mt-1 block max-w-[64%] text-[13px] leading-[1.45] text-[#6f6a63]">
                  {p.description}
                  {p.includes_stamp_duty && (
                    <>
                      <br />
                      compresi 2 € di bollo
                    </>
                  )}
                  {p.savings_note && (
                    <>
                      <br />
                      {p.savings_note}
                    </>
                  )}
                </span>
              </button>
            ))}
          <button type="button" className={pulsante} disabled={!product} onClick={() => vai('personalizza')}>
            Personalizza il regalo
          </button>
        </>
      )}

      {passo === 'personalizza' && product && (
        <>
          <div className="sticky top-0 z-10 bg-[#f5f0e8] pb-3.5 pt-1.5">{card}</div>
          <span className={etichetta}>Copertina</span>
          <div className="grid grid-cols-3 gap-2">
            {covers.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label ?? undefined}
                onClick={() => setCoverId(c.id)}
                className={`aspect-[1.58] overflow-hidden rounded-lg border-2 p-0 ${c.id === cover?.id ? 'border-[#2c2c2c]' : 'border-transparent'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image_url} alt={c.label ?? ''} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <span className={etichetta}>
            Occasione <small className="font-normal text-[#6f6a63]">(facoltativa)</small>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {OCCASIONI.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOccasion(o)}
                className={`rounded-full px-3 py-[7px] text-[13px] ${o === occasion ? 'bg-[#2c2c2c] text-[#f5f0e8]' : 'bg-[#ece4d8]'}`}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label>
              <span className={etichetta}>Da</span>
              <input className={campo} value={fromName} maxLength={40} onChange={(e) => setFromName(e.target.value)} placeholder="Il tuo nome" />
            </label>
            <label>
              <span className={etichetta}>Per</span>
              <input className={campo} value={toName} maxLength={40} onChange={(e) => setToName(e.target.value)} placeholder="Il suo nome" />
            </label>
          </div>
          <label>
            <span className={etichetta}>
              Il tuo messaggio <small className="font-normal text-[#6f6a63]">(lo legge quando apre il regalo)</small>
            </span>
            <textarea
              className={`${campo} h-[118px] resize-none leading-normal`}
              maxLength={300}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <div className="mt-1 text-right text-[11.5px] text-[#6f6a63]">{message.length} / 300</div>
          <button type="button" className={pulsante} disabled={!fromName.trim() || !toName.trim()} onClick={() => vai('consegna')}>
            Avanti
          </button>
        </>
      )}

      {passo === 'consegna' && product && (
        <>
          <h1 className="mb-5 mt-2 text-[26px] font-light leading-[1.15] tracking-[-0.025em]">
            Come lo <b className="font-semibold">riceve</b>?
          </h1>
          <Scelta si={delivery === 'email'} onClick={() => setDelivery('email')} titolo="Glielo mandiamo noi per email" sotto={scheduling ? 'Con la copertina e il tuo messaggio' : 'Subito dopo il pagamento, con la copertina e il tuo messaggio'} />
          <Scelta si={delivery === 'self'} onClick={() => setDelivery('self')} titolo="Glielo do io" sotto="Ricevi il link da mandare su WhatsApp o da stampare" />
          {delivery === 'email' && (
            <>
              <label>
                <span className={etichetta}>La sua email</span>
                <input className={campo} type="email" inputMode="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
              </label>
              {scheduling && (
                <>
                  <span className={etichetta}>Quando</span>
                  <Scelta si={!programma} onClick={() => setProgramma(false)} titolo="Subito dopo il pagamento" />
                  <Scelta si={programma} onClick={() => setProgramma(true)} titolo="Scelgo io il giorno" sotto="Per esempio la mattina di Natale" />
                </>
              )}
              {scheduling && programma && (
                <div className="grid grid-cols-[1fr_120px] gap-2.5">
                  <input className={campo} type="date" min={oggiARoma()} value={sendDate} onChange={(e) => setSendDate(e.target.value)} />
                  <input className={campo} type="time" step={900} value={sendTime} onChange={(e) => setSendTime(e.target.value)} />
                </div>
              )}
            </>
          )}
          <p className="mt-4 text-[14.5px] leading-[1.55] text-[#6f6a63]">
            Vale {validMonths} mesi dal giorno in cui {toName.trim() || 'chi lo riceve'} lo riceve.
          </p>
          <button
            type="button"
            className={pulsante}
            disabled={delivery === 'email' && (!recipientEmail.trim() || (scheduling && programma && !sendDate))}
            onClick={() => vai('riepilogo')}
          >
            Avanti
          </button>
        </>
      )}

      {passo === 'riepilogo' && product && cover && (
        <>
          <h1 className="mb-3 mt-2 text-[26px] font-light tracking-[-0.025em]">Riepilogo</h1>
          <div className="flex items-center gap-3.5 border-b border-[#2c2c2c]/10 py-3.5">
            <div className="w-[92px] flex-none">
              <GiftCardVisual mini coverUrl={cover.image_url} title={product.title} discipline={product.discipline} />
            </div>
            <div>
              <b className="text-[15px]">{product.title}</b>
              <div className="text-[13px] leading-snug text-[#6f6a63]">
                {product.discipline}
                <br />
                per {toName.trim()},{' '}
                {delivery === 'self'
                  ? 'lo consegni tu'
                  : scheduling && programma
                    ? `per email il ${new Date(sendDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} alle ${sendTime}`
                    : 'per email subito'}
              </div>
            </div>
          </div>
          <div className="py-2.5 text-sm">
            <div className="flex justify-between py-1.5">
              <span>Gift card</span>
              <span>{fmtEuro(product.price)}</span>
            </div>
            {product.includes_stamp_duty && (
              <div className="flex justify-between py-1 text-[13px] text-[#6f6a63]">
                <span>di cui marca da bollo</span>
                <span>2 €</span>
              </div>
            )}
            <div className="flex justify-between pt-3 text-[17px] font-semibold">
              <span>Totale</span>
              <span>{fmtEuro(product.price)}</span>
            </div>
          </div>
          <label>
            <span className={etichetta}>
              La tua email <small className="font-normal text-[#6f6a63]">(per la ricevuta e il link del regalo)</small>
            </span>
            <input className={campo} type="email" inputMode="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
          </label>
          {errore && <p className="mt-4 rounded-lg bg-[#a8876a]/15 px-3.5 py-3 text-sm">{errore}</p>}
          <button type="button" className={pulsante} disabled={!buyerEmail.trim() || inCorso} onClick={paga}>
            {inCorso ? 'Apro il pagamento…' : `Paga ${fmtEuro(product.price)}`}
          </button>
          <p className="mt-3 text-center text-xs text-[#6f6a63]">Paghi sulla pagina sicura di Stripe, a Mee Too Pilates.</p>
        </>
      )}
    </div>
  )
}
