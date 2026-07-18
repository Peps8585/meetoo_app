import { createClient } from '@/lib/supabase/server'
import { destinationForUser } from '@/lib/supabase/destination'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  // Destinazione esplicita (es. /reimposta-password per il recovery):
  // solo path relativi interni, per non aprire un open redirect.
  const rawNext = searchParams.get('next')
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : null

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (next) {
        return NextResponse.redirect(new URL(next, request.url))
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const dest = user
        ? await destinationForUser(supabase, user.id)
        : '/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }
  }

  // Exchange fallito su un flusso di recovery (link scaduto, o aperto in un
  // browser diverso da quello della richiesta → manca il code verifier PKCE):
  // si torna alla richiesta reset con il messaggio giusto.
  if (next === '/reimposta-password') {
    return NextResponse.redirect(
      new URL('/password-dimenticata?error=link', request.url)
    )
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url))
}
