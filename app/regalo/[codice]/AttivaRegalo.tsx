'use client'

import { useState, useTransition } from 'react'
import { activateGift, markReceiptDone } from './actions'

const campo =
  'w-full rounded-[10px] border border-[#2c2c2c]/15 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-[#a8876a]'
const etichetta = 'mb-1.5 mt-3.5 block text-[12.5px] font-semibold'

/** Il modulo dello studio: chi usa il regalo, telefono, gruppo scelto insieme. */
export function AttivaRegalo({ code, toName, receiptDone }: { code: string; toName: string; receiptDone: boolean }) {
  const [holderName, setHolderName] = useState(toName)
  const [holderPhone, setHolderPhone] = useState('')
  const [note, setNote] = useState('')
  const [ricevuta, setRicevuta] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, startTransition] = useTransition()

  const attiva = () => {
    setErrore(null)
    startTransition(async () => {
      const esito = await activateGift({ code, holderName, holderPhone, note, receiptDone: ricevuta })
      if ('error' in esito) setErrore(esito.error)
    })
  }

  return (
    <div className="mt-2">
      <label>
        <span className={etichetta}>Chi lo usa</span>
        <input className={campo} value={holderName} maxLength={80} onChange={(e) => setHolderName(e.target.value)} placeholder="Nome e cognome" />
      </label>
      <label>
        <span className={etichetta}>Telefono</span>
        <input className={campo} type="tel" inputMode="tel" value={holderPhone} maxLength={30} onChange={(e) => setHolderPhone(e.target.value)} />
      </label>
      <label>
        <span className={etichetta}>Gruppo o note</span>
        <input className={campo} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="es. Reformer base, martedì 18:00" />
      </label>
      {!receiptDone && (
        <label className="mt-4 flex items-start gap-2.5 text-[13.5px] leading-snug">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#2c2c2c]" checked={ricevuta} onChange={(e) => setRicevuta(e.target.checked)} />
          <span>Ricevuta fatta adesso, con i dati presi in studio</span>
        </label>
      )}
      {errore && <p className="mt-3.5 rounded-lg bg-[#a8876a]/15 px-3.5 py-3 text-sm">{errore}</p>}
      <button
        type="button"
        onClick={attiva}
        disabled={inCorso || !holderName.trim()}
        className="mt-5 block w-full rounded-full bg-[#2c2c2c] py-[15px] text-center text-[15px] font-medium text-[#f5f0e8] transition-colors hover:bg-[#7d8b78] disabled:opacity-35"
      >
        {inCorso ? 'Attivo…' : 'Attiva il regalo'}
      </button>
    </div>
  )
}

/** "Ricevuta fatta": per quando chi compra e' gia' cliente e la si fa subito dopo il pagamento. */
export function SegnaRicevuta({ code }: { code: string }) {
  const [inCorso, startTransition] = useTransition()
  const [errore, setErrore] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        disabled={inCorso}
        onClick={() =>
          startTransition(async () => {
            const esito = await markReceiptDone(code)
            if ('error' in esito) setErrore(esito.error)
          })
        }
        className="mt-3 block w-full rounded-full border border-[#2c2c2c]/20 py-3 text-center text-sm font-medium transition-colors hover:bg-[#2c2c2c] hover:text-[#f5f0e8] disabled:opacity-35"
      >
        {inCorso ? 'Segno…' : 'Segna la ricevuta come fatta'}
      </button>
      {errore && <p className="mt-2 text-sm">{errore}</p>}
    </>
  )
}
