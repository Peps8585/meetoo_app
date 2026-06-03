import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PacchettiManager from './PacchettiManager'

export default async function PacchettiPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, studio_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')
  if (!profile?.studio_id) redirect('/dashboard')

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-8">
        <p className="font-inter font-normal uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/50 mb-1">
          Admin
        </p>
        <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl text-meetoo-accent-dark">
          Pacchetti
        </h1>
      </div>

      <PacchettiManager studioId={profile.studio_id} />
    </div>
  )
}
