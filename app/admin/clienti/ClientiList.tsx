'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

export type ActivePackage = {
  id: string
  remaining_lessons: number | null
  expires_at: string | null
  package_name: string | null
}

export type ClientRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  created_at: string
  active_package: ActivePackage | null
}

type PackageFilter = 'all' | 'active' | 'none'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function initials(c: ClientRow): string {
  return (
    (c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')
  ).toUpperCase()
}

export default function ClientiList({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState('')
  const [pkgFilter, setPkgFilter] = useState<PackageFilter>('all')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return clients.filter((c) => {
      if (q) {
        const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase()
        const email = (c.email ?? '').toLowerCase()
        if (!name.includes(q) && !email.includes(q)) return false
      }
      if (pkgFilter === 'active' && !c.active_package) return false
      if (pkgFilter === 'none' && c.active_package) return false
      return true
    })
  }, [clients, query, pkgFilter])

  function filterBtn(value: PackageFilter, label: string) {
    const active = pkgFilter === value
    return (
      <button
        key={value}
        onClick={() => setPkgFilter(value)}
        className={[
          'font-inter font-normal text-[11px] uppercase tracking-widest px-4 py-2 rounded-full transition-colors whitespace-nowrap',
          active
            ? 'bg-meetoo-accent-dark text-meetoo-bg-light'
            : 'border border-meetoo-accent-dark/30 text-meetoo-accent-dark/60 hover:border-meetoo-accent-dark/60 hover:text-meetoo-accent-dark',
        ].join(' ')}
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-meetoo-accent-dark/30 pointer-events-none" />
          <input
            type="search"
            placeholder="Cerca nome o email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl pl-9 pr-4 py-2.5 font-inter font-light text-sm text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/30 focus:outline-none focus:border-meetoo-accent-dark/40 transition-colors shadow-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {filterBtn('all', 'Tutti')}
          {filterBtn('active', 'Con pacchetto')}
          {filterBtn('none', 'Senza pacchetto')}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="py-16 text-center bg-white/40 rounded-2xl border border-white/80">
          <p className="font-inter text-sm text-meetoo-accent-dark/40">
            Nessun cliente trovato
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* ── Desktop table ── */}
          <div className="hidden sm:block bg-white/60 backdrop-blur-sm rounded-2xl border border-white/80 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-meetoo-accent-dark/5">
                  {['Cliente', 'Pacchetto', 'Lezioni', 'Iscritto il', ''].map((h) => (
                    <th
                      key={h}
                      className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 text-left px-5 py-4 first:pl-6 last:pr-6"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    className={
                      i < filtered.length - 1
                        ? 'border-b border-meetoo-accent-dark/5'
                        : ''
                    }
                  >
                    {/* Cliente */}
                    <td className="pl-6 pr-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-meetoo-accent-light/20 flex items-center justify-center shrink-0">
                          <span className="font-inter font-extrabold text-meetoo-accent-dark/50 text-[11px]">
                            {initials(c)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-inter font-medium text-sm text-meetoo-accent-dark">
                            {c.first_name} {c.last_name}
                          </p>
                          <p className="font-inter font-light text-xs text-meetoo-accent-dark/45 truncate max-w-[180px]">
                            {c.email ?? '—'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Pacchetto */}
                    <td className="px-5 py-4">
                      <p className="font-inter font-normal text-sm text-meetoo-accent-dark">
                        {c.active_package?.package_name ?? (
                          <span className="text-meetoo-accent-dark/30">—</span>
                        )}
                      </p>
                    </td>

                    {/* Lezioni rimanenti */}
                    <td className="px-5 py-4">
                      {c.active_package ? (
                        <span className="font-inter font-semibold text-sm text-meetoo-accent-dark">
                          {c.active_package.remaining_lessons ?? '—'}
                        </span>
                      ) : (
                        <span className="font-inter text-sm text-meetoo-accent-dark/30">—</span>
                      )}
                    </td>

                    {/* Iscritto il */}
                    <td className="px-5 py-4">
                      <p className="font-inter font-light text-sm text-meetoo-accent-dark/60">
                        {fmtDate(c.created_at)}
                      </p>
                    </td>

                    {/* Link */}
                    <td className="pr-6 pl-5 py-4 text-right">
                      <Link
                        href="#"
                        className="font-inter font-light text-xs text-meetoo-accent-dark/40 hover:text-meetoo-accent-dark transition-colors whitespace-nowrap"
                      >
                        Vedi profilo →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="sm:hidden space-y-2">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-4 shadow-sm"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-meetoo-accent-light/20 flex items-center justify-center shrink-0">
                      <span className="font-inter font-extrabold text-meetoo-accent-dark/50 text-[11px]">
                        {initials(c)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-inter font-medium text-sm text-meetoo-accent-dark">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="font-inter font-light text-xs text-meetoo-accent-dark/45 truncate">
                        {c.email ?? '—'}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="#"
                    className="shrink-0 font-inter font-light text-xs text-meetoo-accent-dark/40 hover:text-meetoo-accent-dark transition-colors mt-0.5"
                  >
                    →
                  </Link>
                </div>

                {/* Bottom row — package + date */}
                <div className="flex items-center gap-4 pt-3 border-t border-meetoo-accent-dark/5">
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                      Pacchetto
                    </p>
                    <p className="font-inter font-normal text-sm text-meetoo-accent-dark truncate">
                      {c.active_package?.package_name ?? (
                        <span className="text-meetoo-accent-dark/30">—</span>
                      )}
                    </p>
                  </div>

                  {c.active_package && (
                    <>
                      <div className="w-px h-8 bg-meetoo-accent-dark/10 shrink-0" />
                      <div className="shrink-0">
                        <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                          Lezioni
                        </p>
                        <p className="font-inter font-semibold text-sm text-meetoo-accent-dark">
                          {c.active_package.remaining_lessons ?? '—'}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="w-px h-8 bg-meetoo-accent-dark/10 shrink-0" />
                  <div className="shrink-0 text-right">
                    <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                      Iscritto
                    </p>
                    <p className="font-inter font-light text-xs text-meetoo-accent-dark/60">
                      {fmtDate(c.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
