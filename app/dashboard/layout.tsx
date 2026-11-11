import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)

  if (!user) redirect('/login')

  return <>{children}</>
}
