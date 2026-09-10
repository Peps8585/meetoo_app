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

/**
 * Attiva o disattiva un'istruttrice.
 *
 * Non si cancella: chi ha tenuto lezioni fa parte dello storico, e le lezioni
 * passate devono continuare a riportare chi le ha condotte. Disattivare la
 * toglie dagli elenchi e dalle assegnazioni lasciando intatta la storia.
 *
 * Passa dal server perche' la policy di UPDATE su `profiles` consente di
 * modificare solo il proprio profilo: dal browser un admin non puo' toccare
 * quello di un'altra persona, e il tentativo fallirebbe in silenzio.
 */
export async function setInstructorActive(
  id: string,
  active: boolean
): Promise<{ error?: string; lezioniFuture?: number }> {
  try {
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

    // Si tocca solo chi e' davvero un'istruttrice dello stesso studio:
    // un id sbagliato non deve poter disattivare un'admin o una cliente.
    const { data: target, error: targetErr } = await adminClient
      .from('profiles')
      .select('id, role, studio_id')
      .eq('id', id)
      .single()

    if (targetErr || !target) return { error: 'Istruttore non trovato' }
    if (target.role !== 'instructor') return { error: 'Questo profilo non e’ un istruttore' }
    if (target.studio_id !== adminProfile.studio_id) return { error: 'Non autorizzato' }

    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateErr) return { error: updateErr.message }

    // Le lezioni gia' a calendario restano assegnate: si segnala quante sono
    // ancora da fare, cosi' l'admin sa che vanno riassegnate.
    if (!active) {
      const { count } = await adminClient
        .from('schedules')
        .select('id', { count: 'exact', head: true })
        .eq('instructor_id', id)
        .gte('starts_at', new Date().toISOString())
        .eq('is_cancelled', false)
      return { lezioniFuture: count ?? 0 }
    }

    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore sconosciuto' }
  }
}
