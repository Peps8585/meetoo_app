'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

  return (
    <nav className="flex-1 py-6 px-3 space-y-1">
      {links.map(({ href, label }) => {
        const isActive =
          href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
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
  )
}
