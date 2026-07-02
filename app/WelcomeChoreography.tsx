'use client'

import {
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'

// useLayoutEffect on the client (runs before paint → nessun flash dello stato
// finale prima che parta l'animazione); useEffect come no-op lato server per
// evitare il warning di React durante l'SSR.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Wrapper di sola PRESENTAZIONE per la landing.
 *
 * Progressive enhancement:
 * - Stato di default (SSR / no-JS / reduced-motion) = contenuto già VISIBILE e
 *   in posizione finale. Il markup dei figli non parte mai da opacity:0.
 * - Al mount, una sola volta per sessione (sessionStorage 'mt_welcome_seen'),
 *   applica l'attributo data-mt-animate="play" che ATTIVA le keyframes CSS.
 * - sessionStorage governa SOLO play-vs-skip dell'animazione, mai la presenza
 *   o la visibilità del contenuto.
 */
export default function WelcomeChoreography({
  children,
}: {
  children: ReactNode
}) {
  // 'idle' finché il layout effect non decide: nessun attributo → contenuto
  // visibile senza animazione (identico all'HTML SSR → nessun mismatch di
  // idratazione).
  const [play, setPlay] = useState(false)

  useIsomorphicLayoutEffect(() => {
    try {
      if (window.sessionStorage.getItem('mt_welcome_seen')) {
        return // già vista in questa sessione → render diretto stato finale
      }
      window.sessionStorage.setItem('mt_welcome_seen', '1')
      setPlay(true)
    } catch {
      // sessionStorage non disponibile (es. storage bloccato): la gioca una
      // volta comunque, senza persistere il flag.
      setPlay(true)
    }
  }, [])

  return <div data-mt-animate={play ? 'play' : undefined}>{children}</div>
}
