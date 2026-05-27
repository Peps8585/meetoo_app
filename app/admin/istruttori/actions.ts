'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminSupabase } from '@supabase/supabase-js'

function getAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurata')
  }
  return createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function createInstructor(data: {
  email: string
  first_name: string
  last_name: string
  phone: string
}): Promise<{ error?: string }> {
  try {
    // Verifica che il chiamante sia admin e recupera il suo studio_id
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Non autorizzato' }

    const { data: adminProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, studio_id')
      .eq('id', user.id)
      .single()

    if (profileErr || adminProfile?.role !== 'admin') {
      return { error: 'Non autorizzato' }
    }

    const adminClient = getAdminClient()

    // Password temporanea — l'istruttore la cambierà via reset password
    const tempPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!'

    // Crea l'utente in auth.users
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError) return { error: authError.message }

    // Upsert del profilo (il trigger potrebbe aver già creato la riga)
    const { error: upsertError } = await adminClient.from('profiles').upsert({
      id: newUser.user.id,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || null,
      role: 'instructor',
      studio_id: adminProfile.studio_id,
    })

    if (upsertError) {
      // Rollback: elimina l'utente auth appena creato
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      return { error: upsertError.message }
    }

    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore sconosciuto' }
  }
}
