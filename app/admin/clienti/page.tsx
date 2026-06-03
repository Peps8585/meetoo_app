import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import ClientiList from './ClientiList'
import type { ClientRow } from './ClientiList'

// Raw shapes returned by Supabase nested select
type RawPackage = {
  id: string
  remaining_lessons: number | null
  expires_at: string | null
  packages: { name: string } | null
}

type RawProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  created_at: string
  client_packages: RawPackage[]
}

export default async function ClientiPage() {
  // Secondary guard — primary is app/admin/layout.tsx
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: selfProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (selfProfile?.role !== 'admin') redirect('/dashboard')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurata')
  }

  // Admin client — bypasses RLS and can read auth.users emails
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Fetch clients + packages in parallel with auth emails
  const [profilesRes, usersRes] = await Promise.all([
    adminClient
      .from('profiles')
      .select(
        `id, first_name, last_name, created_at,
         client_packages ( id, remaining_lessons, expires_at,
           packages:package_id ( name )
         )`
      )
      .eq('role', 'client')
      .order('created_at', { ascending: false }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const rawProfiles = (profilesRes.data as unknown as RawProfile[]) ?? []
  const emailMap = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? null])
  )

  const clients: ClientRow[] = rawProfiles.map((p) => {
    const activePkg =
      p.client_packages.find((pkg) => (pkg.remaining_lessons ?? 0) > 0) ?? null
    return {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: emailMap.get(p.id) ?? null,
      created_at: p.created_at,
      active_package: activePkg
        ? {
            id: activePkg.id,
            remaining_lessons: activePkg.remaining_lessons,
            expires_at: activePkg.expires_at,
            package_name: activePkg.packages?.name ?? null,
          }
        : null,
    }
  })

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="font-inter font-normal uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/50 mb-1">
          Admin
        </p>
        <div className="flex items-baseline gap-3">
          <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl text-meetoo-accent-dark">
            Clienti
          </h1>
          <span className="font-inter font-light text-sm text-meetoo-accent-dark/40">
            {clients.length} {clients.length === 1 ? 'cliente' : 'clienti'}
          </span>
        </div>
      </div>

      <ClientiList clients={clients} />
    </div>
  )
}
