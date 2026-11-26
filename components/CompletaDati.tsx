'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Finestra che si apre alla prima entrata dopo la conferma dello studio (Mattia e Giorgia,
// 26/11/2026): telefono e data di nascita, obbligatori, vanno nel profilo. L'email e' gia'
// quella dell'iscrizione: si mostra solo da controllare (per cambiarla si scrive allo studio).
export default function CompletaDati({
  userId,
  email,
  telefono,
  nascita,
}: {
  userId: string
  email: string | null
  telefono: string | null
  nascita: string | null
}) {
  const router = useRouter()
  const [aperta, setAperta] = useState(true)
  const [t, setT] = useState(telefono ?? '')
  const [d, setD] = useState(nascita ?? '')
  const [busy, setBusy] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function salva() {
    if (t.replace(/\D/g, '').length < 8) return setErrore('Scrivi il tuo numero di telefono.')
    if (!d) return setErrore('Scrivi la tua data di nascita.')
    setBusy(true)
    setErrore(null)
    const { error } = await createClient().from('profiles').update({ phone: t.trim(), date_of_birth: d }).eq('id', userId)
    setBusy(false)
    if (error) return setErrore('Non siamo riusciti a salvare, riprova tra poco.')
    setAperta(false)
    router.refresh()
  }

  if (!aperta) return null
  const etichetta = 'font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/50'
  const campo =
    'mt-1 w-full rounded-xl border border-meetoo-accent-dark/15 bg-white px-4 py-3 font-inter text-sm text-meetoo-accent-dark focus:outline-none focus:border-meetoo-accent-dark/40'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-meetoo-bg-light px-6 pt-7 pb-8 shadow-xl">
        <h2 className="font-inter text-xl font-extrabold text-meetoo-accent-dark">Benvenuta in Mee Too!</h2>
        <p className="mt-2 font-inter text-sm font-light leading-relaxed text-meetoo-accent-dark/75">
          Prima di iniziare ci servono due dati, così possiamo contattarti se cambia qualcosa nelle tue lezioni.
        </p>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className={etichetta}>Telefono</span>
            <input className={campo} value={t} onChange={(e) => setT(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="333 123 4567" />
          </label>
          <label className="block">
            <span className={etichetta}>Data di nascita</span>
            <input className={campo} value={d} onChange={(e) => setD(e.target.value)} type="date" autoComplete="bday" />
          </label>
          <div>
            <span className={etichetta}>La tua email</span>
            <p className="mt-1 font-inter text-sm text-meetoo-accent-dark">{email ?? '—'}</p>
            <p className="font-inter text-xs font-light text-meetoo-accent-dark/50 mt-1">
              Se non è giusta, scrivici dalla sezione Messaggi e la correggiamo noi.
            </p>
          </div>
        </div>
        {errore && <p className="mt-3 font-inter text-xs text-red-600">{errore}</p>}
        <button
          type="button"
          onClick={salva}
          disabled={busy}
          className="mt-6 w-full rounded-full bg-meetoo-accent-dark py-3.5 font-inter text-[11px] uppercase tracking-widest text-white disabled:opacity-50"
        >
          {busy ? 'Salvo…' : 'Salva e continua'}
        </button>
      </div>
    </div>
  )
}
