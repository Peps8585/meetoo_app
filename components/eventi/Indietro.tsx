'use client'

import { useRouter } from 'next/navigation'

// Tasto per uscire dalla pagina di un evento: torna da dove si e' arrivate
// (home, bacheca, pagina dello studio). Se la pagina e' stata aperta da un link,
// senza una pagina prima, porta alla bacheca degli eventi.
export default function Indietro() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push('/eventi')
      }}
      className="-ml-2 inline-flex min-h-[44px] items-center px-2 font-inter text-xs uppercase tracking-widest text-meetoo-accent-dark/70 transition-colors hover:text-meetoo-accent-dark"
    >
      ← Indietro
    </button>
  )
}
