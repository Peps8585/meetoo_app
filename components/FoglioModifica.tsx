'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

// Scheda di modifica che si apre davanti, da qualsiasi punto della pagina
// (Mattia 24/11/2026: prima il modulo compariva in cima e bisognava risalire).
// Sul telefono sale dal basso, sul computer sta al centro; dietro la pagina resta ferma.
export default function FoglioModifica({
  aperto,
  onChiudi,
  children,
}: {
  aperto: boolean
  onChiudi: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!aperto) return
    const prima = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi()
    window.addEventListener('keydown', esc)
    return () => {
      document.body.style.overflow = prima
      window.removeEventListener('keydown', esc)
    }
  }, [aperto, onChiudi])

  if (!aperto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onChiudi} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-meetoo-bg-light px-6 pt-6 pb-8 shadow-xl"
      >
        <button
          type="button"
          onClick={onChiudi}
          aria-label="Chiudi"
          className="absolute right-4 top-4 rounded-full p-2 text-meetoo-accent-dark/60 hover:bg-meetoo-accent-dark/5"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
