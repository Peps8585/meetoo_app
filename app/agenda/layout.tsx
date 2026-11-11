import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'

export default async function AgendaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'instructor') {
    redirect('/dashboard')
  }

  return <div className="min-h-screen bg-meetoo-bg-light">{children}</div>
}
