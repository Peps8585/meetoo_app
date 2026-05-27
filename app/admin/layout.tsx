import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AdminNav from './_components/AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-meetoo-bg-light flex">
      {/* Sidebar */}
      <aside className="w-60 bg-meetoo-accent-dark flex flex-col fixed top-0 left-0 h-full z-20">
        {/* Brand */}
        <div className="px-6 py-8 border-b border-white/10">
          <p className="font-inter font-normal uppercase tracking-[0.3em] text-xs text-white/40 mb-1">
            Pannello Admin
          </p>
          <h1 className="font-inter font-extrabold uppercase tracking-widest text-xl leading-none text-white">
            MEE TOO
          </h1>
        </div>

        {/* Navigation */}
        <AdminNav />

        {/* Back to app */}
        <div className="px-4 pb-6">
          <Link
            href="/dashboard"
            className="block font-inter text-xs uppercase tracking-widest text-white/40 hover:text-white/60 transition-colors px-3 py-2"
          >
            ← Torna all&apos;app
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">{children}</main>
    </div>
  )
}
