import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'
import { destinationForUser } from '@/lib/supabase/destination'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)

  if (user) {
    const dest = await destinationForUser(supabase, user.id)
    redirect(dest)
  }

  return <>{children}</>
}
