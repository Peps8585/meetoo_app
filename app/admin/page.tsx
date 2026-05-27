import Link from 'next/link'

const sections = [
  {
    href: '/admin/istruttori',
    title: 'Istruttori',
    desc: 'Gestisci i profili degli istruttori dello studio',
  },
  {
    href: '/admin/lezioni',
    title: 'Tipologie Lezioni',
    desc: 'Gestisci i tipi di lezione disponibili',
  },
  {
    href: '/admin/palinsesto',
    title: 'Palinsesto',
    desc: 'Visualizza e gestisci il calendario settimanale delle lezioni',
  },
]

export default function AdminPage() {
  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-10">
        <p className="font-inter font-normal uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/50 mb-1">
          Pannello
        </p>
        <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl text-meetoo-accent-dark">
          Admin
        </h1>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map(({ href, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="group bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-6 py-8 shadow-sm hover:bg-white/80 transition-colors"
          >
            <h2 className="font-inter font-extrabold uppercase tracking-widest text-sm text-meetoo-accent-dark mb-2 group-hover:text-meetoo-accent-light transition-colors">
              {title}
            </h2>
            <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 leading-relaxed">
              {desc}
            </p>
            <span className="block mt-5 text-meetoo-accent-dark/30 group-hover:text-meetoo-accent-light transition-colors text-lg">
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
