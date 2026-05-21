import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  async function logout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-6 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <p className="font-inter font-extrabold uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/60 mb-1">
              Studio Pilates &amp; Yoga
            </p>
            <h1 className="font-inter font-extrabold uppercase tracking-widest text-4xl text-meetoo-accent-dark leading-none">
              MEE TOO
            </h1>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full transition-colors duration-300 hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light"
            >
              Esci
            </button>
          </form>
        </div>

        {/* Welcome card */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-8 py-10">
          <p className="font-inter font-extrabold uppercase tracking-widest text-xs text-meetoo-accent-dark/50 mb-3">
            Area riservata
          </p>
          <h2 className="font-inter font-light text-2xl text-meetoo-accent-dark">
            Benvenuta,{' '}
            <span className="font-normal">{user.email}</span>
          </h2>
          <p className="mt-4 font-inter font-light text-meetoo-accent-dark/60 leading-relaxed">
            Qui troverai le tue lezioni, i tuoi progressi e tutte le informazioni
            sul tuo percorso Pilates.
          </p>
        </div>

        {/* Placeholder sections */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {['Le mie lezioni', 'Il mio profilo'].map((label) => (
            <div
              key={label}
              className="bg-white/40 rounded-2xl border border-white/80 px-6 py-8 flex items-center justify-between"
            >
              <span className="font-inter font-normal uppercase tracking-widest text-sm text-meetoo-accent-dark">
                {label}
              </span>
              <span className="text-meetoo-accent-dark/30 text-lg">→</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
