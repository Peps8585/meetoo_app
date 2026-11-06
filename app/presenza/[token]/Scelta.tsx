'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { rispondi, type Risposta } from './actions'

const scuro =
  'block w-full rounded-full bg-[#2c2c2c] py-[15px] text-center text-[15px] font-medium text-[#f5f0e8] transition-colors hover:bg-[#7d8b78] disabled:opacity-50'
const chiaro =
  'block w-full rounded-full border border-[#2c2c2c]/40 py-[14px] text-center text-[15px] font-medium text-[#2c2c2c] transition-colors hover:bg-white/70 disabled:opacity-50'

export type Pulsante = { risposta: Risposta; label: string; principale?: boolean }

// I pulsanti della pagina /presenza: un tocco e la risposta e' registrata.
// Dall'email si arriva con ?r=...: la scelta e' solo evidenziata, si conferma
// toccando (i programmi antivirus della posta aprono i link da soli).
export default function Scelta({ token, pulsanti, nota }: { token: string; pulsanti: Pulsante[]; nota?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<Risposta | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  async function tocca(r: Risposta) {
    setBusy(r)
    setErrore(null)
    const esito = await rispondi(token, r)
    setBusy(null)
    if (!esito.ok) return setErrore(esito.messaggio ?? 'Riprova.')
    if (esito.token && esito.token !== token) router.replace(`/presenza/${esito.token}`)
    else router.refresh()
  }

  return (
    <div className="mt-6 space-y-3">
      {pulsanti.map((p) => (
        <button key={p.risposta} disabled={busy !== null} onClick={() => tocca(p.risposta)} className={p.principale ? scuro : chiaro}>
          {busy === p.risposta ? 'Un attimo…' : p.label}
        </button>
      ))}
      {nota && <p className="pt-1 text-center text-[13px] leading-relaxed text-[#7d8b78]">{nota}</p>}
      {errore && (
        <p role="status" className="pt-1 text-center text-[13px] leading-relaxed text-amber-700">
          {errore}
        </p>
      )}
    </div>
  )
}
