'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { inviaMessaggio } from './actions'

export type LezioneScelta = { id: string; etichetta: string; iscritte: number }

const scheda = 'rounded-2xl border border-white/80 bg-white/60 px-5 py-4 shadow-sm'
const etichetta = 'mb-1.5 block font-inter text-[10px] font-normal uppercase tracking-[0.2em] text-meetoo-accent-dark/50'
const campo =
  'w-full rounded-xl border border-meetoo-accent-dark/15 bg-white/80 px-3.5 py-2.5 font-inter text-[15px] text-meetoo-accent-dark outline-none focus:border-meetoo-accent-light'
const scelta = (attiva: boolean) =>
  `rounded-full px-4 py-2 font-inter text-sm ${attiva ? 'bg-meetoo-accent-dark text-meetoo-bg-light' : 'border border-meetoo-accent-dark/25 text-meetoo-accent-dark'}`

type AChi = 'tutte' | 'lezione' | 'cliente'

export default function NuovoMessaggio({
  lezioni,
  clienti,
  lezioneIniziale,
  clienteIniziale,
  whatsapp,
}: {
  lezioni: LezioneScelta[]
  clienti: { id: string; nome: string }[]
  lezioneIniziale: string | null
  clienteIniziale: string | null
  whatsapp: boolean
}) {
  const router = useRouter()
  const [aChi, setAChi] = useState<AChi>(lezioneIniziale ? 'lezione' : clienteIniziale ? 'cliente' : 'tutte')
  const [lezione, setLezione] = useState(lezioneIniziale ?? '')
  const [cliente, setCliente] = useState(clienteIniziale ?? '')
  const [testo, setTesto] = useState('')
  const [ancheWhatsApp, setAncheWhatsApp] = useState(false)
  const [nota, setNota] = useState<{ ok: boolean; testo: string } | null>(null)
  const [inCorso, parti] = useTransition()

  const pronto =
    testo.trim().length > 0 && (aChi === 'tutte' || (aChi === 'lezione' && lezione) || (aChi === 'cliente' && cliente))

  function manda() {
    if (!pronto) return
    if (aChi === 'tutte' && !window.confirm(`Mando il messaggio a tutte le clienti (${clienti.length})?`)) return
    setNota(null)
    parti(async () => {
      const r = await inviaMessaggio({
        testo,
        destinatari: aChi,
        scheduleId: lezione || null,
        clientId: cliente || null,
        whatsapp: whatsapp && ancheWhatsApp,
      })
      setNota({ ok: r.ok, testo: r.messaggio ?? '' })
      if (r.ok) {
        setTesto('')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className={scheda}>
        <span className={etichetta}>A chi</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={scelta(aChi === 'tutte')} onClick={() => setAChi('tutte')}>
            Tutte
          </button>
          <button type="button" className={scelta(aChi === 'lezione')} onClick={() => setAChi('lezione')}>
            Iscritte a una lezione
          </button>
          <button type="button" className={scelta(aChi === 'cliente')} onClick={() => setAChi('cliente')}>
            Una cliente
          </button>
        </div>
      </div>

      {aChi === 'lezione' && (
        <div className={scheda}>
          <label className={etichetta} htmlFor="msg-lezione">Lezione</label>
          <select id="msg-lezione" className={campo} value={lezione} onChange={(e) => setLezione(e.target.value)}>
            <option value="">Scegli la lezione</option>
            {lezioni.map((l) => (
              <option key={l.id} value={l.id} disabled={l.iscritte === 0}>
                {l.etichetta}
              </option>
            ))}
          </select>
          {whatsapp && (
            <label className="mt-3 flex items-start gap-2.5 font-inter text-sm font-light text-meetoo-accent-dark">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={ancheWhatsApp} onChange={(e) => setAncheWhatsApp(e.target.checked)} />
              <span>Manda anche su WhatsApp, a chi ha detto sì agli avvisi dello studio.</span>
            </label>
          )}
        </div>
      )}

      {aChi === 'cliente' && (
        <div className={scheda}>
          <label className={etichetta} htmlFor="msg-cliente">Cliente</label>
          <select id="msg-cliente" className={campo} value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="">Scegli la cliente</option>
            {clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={scheda}>
        <label className={etichetta} htmlFor="msg-testo">Testo</label>
        <textarea id="msg-testo" rows={4} maxLength={2000} className={campo} value={testo} onChange={(e) => setTesto(e.target.value)} />
      </div>

      {nota && nota.testo && (
        <p role="status" className={`rounded-xl px-4 py-3 font-inter text-sm ${nota.ok ? 'bg-meetoo-bg-dark/15 text-meetoo-accent-dark' : 'bg-amber-100 text-amber-900'}`}>
          {nota.testo}
        </p>
      )}

      <button
        type="button"
        disabled={inCorso || !pronto}
        onClick={manda}
        className="w-full rounded-full bg-meetoo-accent-dark py-3.5 font-inter text-xs font-normal uppercase tracking-widest text-meetoo-bg-light transition-colors hover:bg-meetoo-bg-dark disabled:opacity-40"
      >
        {inCorso ? 'Un attimo…' : 'Invia'}
      </button>
    </div>
  )
}
