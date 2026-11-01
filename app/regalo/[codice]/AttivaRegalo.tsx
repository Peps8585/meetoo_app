'use client'

import { useState, useTransition } from 'react'
import { activateGift } from './actions'

const campo =
  'w-full rounded-[10px] border border-[#2c2c2c]/15 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-[#a8876a]'
const etichetta = 'mb-1.5 mt-3.5 block text-[12.5px] font-semibold'

/** Il modulo dello studio: chi usa il regalo, telefono, gruppo scelto insieme. */
export function AttivaRegalo({ code, toName }: { code: string; toName: string }) {
  const [holderName, setHolderName] = useState(toName)
  const [holderPhone, setHolderPhone] = useState('')
  const [note, setNote] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, startTransition] = useTransition()

  const attiva = () => {
    setErrore(null)
    startTransition(async () => {
      const esito = await activateGift({ code, holderName, holderPhone, note })
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
