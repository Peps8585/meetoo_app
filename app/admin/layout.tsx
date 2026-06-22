import { redirect } from 'next/navigation'
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
    <div className="min-h-screen bg-meetoo-bg-light md:flex">
      {/* Sidebar + top bar mobile + drawer (gestiti dal client component) */}
      <AdminNav />

      {/* Main content — piena larghezza su mobile, ml-60 solo da md in su */}
      <main className="flex-1 md:ml-60 min-h-screen">{children}</main>
    </div>
  )
}
