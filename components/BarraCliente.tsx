'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, Sparkles, Ticket } from 'lucide-react'

// Barra del menu fissa in basso nelle pagine della cliente (richiesta di Mattia
// del 12/11/2026): Home, Palinsesto, Le mie prenotazioni, Eventi. I video restano
// un'opzione nella home, il profilo si apre dalla home.
const VOCI = [
  { href: '/dashboard', label: 'Home', Icona: Home },
  { href: '/palinsesto', label: 'Palinsesto', Icona: CalendarDays },
  { href: '/prenotazioni', label: 'Prenotazioni', Icona: Ticket },
  { href: '/eventi', label: 'Eventi', Icona: Sparkles },
]

// pagine dove la barra compare (il resto: studio, agenda, accesso, regali)
const PAGINE = ['/dashboard', '/palinsesto', '/prenotazioni', '/eventi', '/profilo']

export default function BarraCliente() {
  const path = usePathname() ?? ''
  if (!PAGINE.some((p) => path === p || path.startsWith(p + '/'))) return null

  return (
    <>
      {/* spazio in fondo alla pagina, cosi' la barra non copre l'ultima riga */}
      <div aria-hidden className="h-[calc(76px+env(safe-area-inset-bottom))] shrink-0 bg-meetoo-bg-light" />
      <nav
        aria-label="Menu"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-meetoo-accent-dark/10 bg-meetoo-bg-light/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-2xl">
          {VOCI.map(({ href, label, Icona }) => {
            const attiva = path === href || path.startsWith(href + '/')
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  prefetch={true}
                  aria-current={attiva ? 'page' : undefined}
                  className={`flex h-[64px] flex-col items-center justify-center gap-1 font-inter text-[10px] uppercase tracking-widest transition-colors ${
                    attiva ? 'text-meetoo-accent-dark' : 'text-meetoo-accent-dark/40'
                  }`}
                >
                  <Icona className="h-[22px] w-[22px]" strokeWidth={attiva ? 2 : 1.5} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
