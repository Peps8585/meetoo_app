import { createClient } from '@/lib/supabase/server'
import { destinationForUser } from '@/lib/supabase/destination'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const dest = user
        ? await destinationForUser(supabase, user.id)
        : '/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url))
}
