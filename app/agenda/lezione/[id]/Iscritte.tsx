'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { iniziali } from '@/lib/foto'

export type Iscritta = {
  id: string
  nome: string
  first: string | null
  last: string | null
  foto: string | null
  stato: 'confermata' | 'non_ha_risposto' | 'fissa_in_attesa' | 'non_viene' | 'lista'
  fissa: boolean
  prenotataIl: string
}

const CHIP: Partial<Record<Iscritta['stato'], { testo: string; cls: string }>> = {
  confermata: { testo: 'Confermata', cls: 'bg-meetoo-bg-dark/15 text-meetoo-bg-dark' },
  non_ha_risposto: { testo: 'Non ha risposto', cls: 'bg-amber-100 text-amber-700' },
}

function quando(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' }) +
    ' alle ' +
    d.toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Rome' }).replace(':', '.')
  )
}

function Persona({ r }: { r: Iscritta }) {
  const chip = CHIP[r.stato]
  return (
    <li className="flex items-start gap-3 py-3.5">
      {r.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.foto} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
      ) : (
        <span className="w-11 h-11 rounded-full bg-meetoo-accent-light/20 flex items-center justify-center shrink-0 font-inter font-semibold text-xs text-meetoo-accent-dark/50">
          {iniziali(r.first, r.last)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`font-inter text-[15px] leading-snug ${r.stato === 'non_viene' ? 'text-meetoo-accent-dark/45 line-through decoration-meetoo-accent-dark/25' : 'text-meetoo-accent-dark'}`}>
          {r.nome}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/45">
            {r.fissa ? 'Fissa' : 'Jolly'}
          </span>
          {chip && (
            <span className={`font-inter font-normal text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${chip.cls}`}>
              {chip.testo}
            </span>
          )}
        </p>
        <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-1">
          {r.fissa ? 'Posto fisso' : r.stato === 'lista' ? `In lista dal ${quando(r.prenotataIl)}` : `Prenotata il ${quando(r.prenotataIl)} dall’app`}
        </p>
      </div>
    </li>
  )
}

function Gruppo({ titolo, righe }: { titolo: string; righe: Iscritta[] }) {
  if (righe.length === 0) return null
  return (
    <section className="mb-5">
      <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-2">
        {titolo} · {righe.length}
      </h2>
      <ul className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-5 divide-y divide-meetoo-accent-dark/5">
        {righe.map((r) => (
          <Persona key={r.id} r={r} />
        ))}
      </ul>
    </section>
  )
}

export default function Iscritte({ righe }: { righe: Iscritta[] }) {
  const [cerca, setCerca] = useState('')
  const q = cerca.trim().toLowerCase()
  const visibili = q ? righe.filter((r) => r.nome.toLowerCase().includes(q)) : righe

  const dentro = visibili.filter((r) => r.stato !== 'lista' && r.stato !== 'non_viene')
  const nonVengono = visibili.filter((r) => r.stato === 'non_viene')
  const lista = visibili.filter((r) => r.stato === 'lista')

  return (
    <>
      <label className="flex items-center gap-2 bg-white/60 border border-white/80 rounded-full px-4 py-2.5 mb-5 shadow-sm">
        <Search className="w-4 h-4 text-meetoo-accent-dark/40 shrink-0" />
        <input
          type="search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca per nome"
          className="min-w-0 flex-1 bg-transparent font-inter font-light text-sm text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/35 focus:outline-none"
        />
      </label>

      {dentro.length === 0 && nonVengono.length === 0 && lista.length === 0 ? (
        <p className="font-inter font-light text-sm text-meetoo-accent-dark/40 text-center py-10">
          {q ? 'Nessuna con questo nome' : 'Nessuna prenotazione'}
        </p>
      ) : (
        <>
          <Gruppo titolo="Iscritte" righe={dentro} />
          <Gruppo titolo="Questa volta non vengono" righe={nonVengono} />
          <Gruppo titolo="Lista d'attesa" righe={lista} />
        </>
      )}
    </>
  )
}
