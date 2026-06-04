import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/palinsesto', '/profilo']
const AUTH_PATHS = ['/login', '/registrati']

/**
 * Copy session cookies from supabaseResponse into a redirect response so that
 * the token refresh survives the redirect on Vercel's edge network.
 */
function withSessionCookies(redirect: NextResponse, session: NextResponse): NextResponse {
  session.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session and keeps the auth cookie alive.
  // Do not add logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const isAuthPage  = AUTH_PATHS.some((p) => pathname === p)

  // Unauthenticated user trying to reach a protected route → /login
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return withSessionCookies(NextResponse.redirect(url), supabaseResponse)
  }

  // Authenticated user on login / registrati → /dashboard
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return withSessionCookies(NextResponse.redirect(url), supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and images.
     * _next/data routes are intentionally included so that
     * RSC navigations also pass through the proxy.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
