'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

const links = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/istruttori', label: 'Istruttori' },
  { href: '/admin/lezioni', label: 'Tipologie Lezioni' },
  { href: '/admin/palinsesto', label: 'Palinsesto' },
  { href: '/admin/clienti', label: 'Clienti' },
  { href: '/admin/pacchetti', label: 'Pacchetti' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // Chiudi con Escape (solo quando il drawer è aperto su mobile)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Blocca lo scroll del body mentre il drawer è aperto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Gestione focus base: al primo apri → focus sul bottone chiudi;
  // al chiudi (dopo un'apertura reale) → ritorno focus all'hamburger.
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      closeRef.current?.focus()
    } else if (wasOpen.current) {
      wasOpen.current = false
      hamburgerRef.current?.focus()
    }
  }, [open])

  const activeLabel =
    links.find(({ href }) => pathname.startsWith(href))?.label ?? 'Admin'

  return (
    <>
      {/* ── Top bar mobile (solo < md) ── */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-meetoo-accent-dark">
        <button
          ref={hamburgerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri menu di navigazione"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          className="-ml-1 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-inter font-extrabold uppercase tracking-widest text-sm text-white">
          MEE TOO
        </span>
        <span className="ml-auto font-inter font-light text-xs uppercase tracking-widest text-white/40 truncate">
          {activeLabel}
        </span>
      </header>

      {/* ── Backdrop (mobile, solo a drawer aperto) ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="md:hidden fixed inset-0 z-30 bg-meetoo-accent-dark/50 backdrop-blur-sm"
        />
      )}

      {/* ── Sidebar / drawer ── */}
      <aside
        id="admin-sidebar"
        aria-label="Navigazione pannello admin"
        className={[
          'fixed top-0 left-0 h-full w-60 z-40 bg-meetoo-accent-dark flex flex-col',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: comportamento identico a prima — sempre visibile, z-20
          'md:translate-x-0 md:z-20',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="px-6 py-8 border-b border-white/10 flex items-start justify-between gap-3">
          <div>
            <p className="font-inter font-normal uppercase tracking-[0.3em] text-xs text-white/40 mb-1">
              Pannello Admin
            </p>
            <h1 className="font-inter font-extrabold uppercase tracking-widest text-xl leading-none text-white">
              MEE TOO
            </h1>
          </div>
          {/* Chiudi — solo mobile */}
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Chiudi menu di navigazione"
            className="md:hidden -mr-1 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {links.map(({ href, label }) => {
            const isActive =
              href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`block font-inter text-xs uppercase tracking-widest px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Back to app */}
        <div className="px-4 pb-6">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="block font-inter text-xs uppercase tracking-widest text-white/40 hover:text-white/60 transition-colors px-3 py-2"
          >
            ← Torna all&apos;app
          </Link>
        </div>
      </aside>
    </>
  )
}
