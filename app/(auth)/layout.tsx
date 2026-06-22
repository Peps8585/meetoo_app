import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { destinationForUser } from '@/lib/supabase/destination'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const dest = await destinationForUser(supabase, user.id)
    redirect(dest)
  }

  return <>{children}</>
}
