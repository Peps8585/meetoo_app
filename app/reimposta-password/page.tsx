'use client'

// NOTA ARCHITETTURA: questa pagina vive FUORI dal gruppo (auth) di proposito.
// Chi arriva dal link di recovery HA una sessione (di recovery): il layout
// (auth) lo redirigerebbe alla dashboard prima che possa scegliere la password.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/app/Logo'
import { createClient } from '@/lib/supabase/client'
import { destinationForUser } from '@/lib/supabase/destination'

export default function ReimpostaPasswordPage() {
  const router = useRouter()
  const [session, setSession] = useState<'checking' | 'ok' | 'missing'>(
    'checking'
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSession(user ? 'ok' : 'missing')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const conferma = formData.get('conferma') as string

    if (password !== conferma) {
      setError('Le due password non coincidono.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.updateUser({ password })

    if (error) {
      if (error.message.includes('should be different')) {
        setError('La nuova password deve essere diversa da quella attuale.')
      } else if (error.message.includes('at least')) {
        setError('La password deve avere almeno 6 caratteri.')
      } else if (error.message.includes('session missing')) {
        setSession('missing')
      } else {
        setError(error.message)
      }
      setLoading(false)
    } else {
      const dest = data.user
        ? await destinationForUser(supabase, data.user.id)
        : '/dashboard'
      router.push(dest)
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen bg-meetoo-bg-light flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <h1 className="sr-only">Reimposta la password — Mee Too</h1>

        {/* Logo / Brand — sistema <Logo>, statico (nessuna coreografia qui). */}
        <div className="text-center mb-10">
          <Logo
            variant="full"
            className="text-meetoo-accent-dark [--mt-logo-w:180px]"
          />
        </div>

        {/* Card */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-8 py-10">
          {session === 'checking' && (
            <p className="font-inter font-light text-sm text-meetoo-accent-dark/70 text-center py-4">
              Verifica del link in corso…
            </p>
          )}

          {session === 'missing' && (
            <div className="text-center">
              <h2 className="font-inter font-extrabold uppercase tracking-widest text-xl text-meetoo-accent-dark mb-4">
                Link non valido
              </h2>
              <p className="font-inter font-light text-sm text-meetoo-accent-dark/70 leading-relaxed mb-8">
                Il link non è valido o è scaduto. Richiedi un nuovo link di
                reset per continuare.
              </p>
              <Link
                href="/password-dimenticata"
                className="inline-block bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-sm px-10 py-4 rounded-full transition-colors duration-300 hover:bg-meetoo-accent-light"
              >
                Richiedi nuovo link
              </Link>
            </div>
          )}

          {session === 'ok' && (
            <>
              <h2 className="font-inter font-extrabold uppercase tracking-widest text-xl text-meetoo-accent-dark mb-4 text-center">
                Nuova password
              </h2>

              <p className="font-inter font-light text-sm text-meetoo-accent-dark/70 leading-relaxed mb-8 text-center">
                Scegli la nuova password per il tuo account.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-1">
                  <label
                    htmlFor="password"
                    className="block font-inter font-light text-sm uppercase tracking-widest text-meetoo-accent-dark"
                  >
                    Nuova password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/40 focus:outline-none focus:border-meetoo-accent-light transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="conferma"
                    className="block font-inter font-light text-sm uppercase tracking-widest text-meetoo-accent-dark"
                  >
                    Ripeti password
                  </label>
                  <input
                    id="conferma"
                    name="conferma"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/40 focus:outline-none focus:border-meetoo-accent-light transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="font-inter font-light text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-sm py-4 rounded-full transition-colors duration-300 hover:bg-meetoo-accent-light disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Salvataggio…' : 'Salva nuova password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
