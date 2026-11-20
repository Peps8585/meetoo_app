'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Dati personali della cliente, modificabili da lei (richiesta di Mattia del
// 20/11/2026: il tasto "Modifica dati" non faceva niente). L'email no: e'
// quella con cui entra, si cambia solo passando dallo studio.
export default function DatiPersonali({
  userId,
  nome,
  cognome,
  email,
  telefono,
}: {
  userId: string
  nome: string | null
  cognome: string | null
  email: string | null
  telefono: string | null
}) {
  const router = useRouter()
  const [modifica, setModifica] = useState(false)
  const [n, setN] = useState(nome ?? '')
  const [c, setC] = useState(cognome ?? '')
  const [t, setT] = useState(telefono ?? '')
  const [busy, setBusy] = useState(false)
  const [nota, setNota] = useState<{ ok: boolean; testo: string } | null>(null)

  async function salva() {
    if (!n.trim() || !c.trim()) {
      setNota({ ok: false, testo: 'Scrivi nome e cognome, così lo studio sa chi sei.' })
      return
    }
    setBusy(true)
    setNota(null)
    const { error } = await createClient()
      .from('profiles')
      .update({ first_name: n.trim(), last_name: c.trim(), phone: t.trim() || null })
      .eq('id', userId)
    setBusy(false)
    if (error) {
      setNota({ ok: false, testo: 'Non siamo riusciti a salvare, riprova tra poco.' })
      return
    }
    setModifica(false)
    setNota({ ok: true, testo: 'Dati salvati.' })
    router.refresh()
  }

  function annulla() {
    setN(nome ?? '')
    setC(cognome ?? '')
    setT(telefono ?? '')
    setNota(null)
    setModifica(false)
  }

  const etichetta = 'font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40'
  const campo =
    'mt-1 w-full rounded-xl border border-meetoo-accent-dark/15 bg-white px-4 py-3 font-inter text-sm text-meetoo-accent-dark focus:outline-none focus:border-meetoo-accent-dark/40'

  if (modifica) {
    return (
      <div className="space-y-4">
        <label className="block">
          <span className={etichetta}>Nome</span>
          <input className={campo} value={n} onChange={(e) => setN(e.target.value)} autoComplete="given-name" />
        </label>
        <label className="block">
          <span className={etichetta}>Cognome</span>
          <input className={campo} value={c} onChange={(e) => setC(e.target.value)} autoComplete="family-name" />
        </label>
        <label className="block">
          <span className={etichetta}>Telefono</span>
          <input className={campo} value={t} onChange={(e) => setT(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" />
        </label>
        <div>
          <span className={etichetta}>Email</span>
          <p className="mt-1 font-inter text-sm text-meetoo-accent-dark/60">{email ?? '—'}</p>
          <p className="font-inter font-light text-xs text-meetoo-accent-dark/45 mt-1">
            È l’email con cui entri nell’app: per cambiarla scrivi allo studio.
          </p>
        </div>
        {nota && <p className={`font-inter text-xs ${nota.ok ? 'text-green-700' : 'text-red-600'}`}>{nota.testo}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={annulla}
            disabled={busy}
            className="flex-1 font-inter uppercase tracking-widest text-[11px] px-4 py-3 rounded-full border border-meetoo-accent-dark/20 text-meetoo-accent-dark/70"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={salva}
            disabled={busy}
            className="flex-1 font-inter uppercase tracking-widest text-[11px] px-4 py-3 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light disabled:opacity-50"
          >
            {busy ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </div>
    )
  }

  const righe = [
    // i valori salvati, senza aspettare che la pagina si ricarichi
    { label: 'Nome', value: n },
    { label: 'Cognome', value: c },
    { label: 'Email', value: email },
    { label: 'Telefono', value: t },
  ]

  return (
    <>
      <dl className="space-y-0">
        {righe.map((field, i) => (
          <div key={field.label}>
            {i > 0 && <div className="h-px bg-meetoo-accent-dark/5 my-4" />}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <dt className={etichetta}>{field.label}</dt>
              <dd className="font-inter font-normal text-sm text-meetoo-accent-dark">{field.value || '—'}</dd>
            </div>
          </div>
        ))}
      </dl>
      {nota && <p className={`mt-4 font-inter text-xs ${nota.ok ? 'text-green-700' : 'text-red-600'}`}>{nota.testo}</p>}
      <div className="mt-6 pt-5 border-t border-meetoo-accent-dark/5">
        <button
          type="button"
          onClick={() => {
            setNota(null)
            setModifica(true)
          }}
          className="font-inter font-normal uppercase tracking-widest text-[11px] px-6 py-3 rounded-full border border-meetoo-accent-dark/30 text-meetoo-accent-dark hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors duration-300"
        >
          Modifica dati
        </button>
      </div>
    </>
  )
}
