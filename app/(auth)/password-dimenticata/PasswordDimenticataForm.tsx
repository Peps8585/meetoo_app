'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/app/Logo'
import { createClient } from '@/lib/supabase/client'

export default function PasswordDimenticataForm() {
  const searchParams = useSearchParams()
  const linkError = searchParams.get('error') === 'link'

  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(
      formData.get('email') as string,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reimposta-password`,
      }
    )

    if (error) {
      setError(
        error.message.includes('you can only request this')
          ? 'Hai già richiesto un link da poco. Attendi un minuto e riprova.'
          : error.message
      )
      setLoading(false)
    } else {
      // Nessuna distinzione "email non trovata": la risposta è identica
      // per non rivelare quali email hanno un account.
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-meetoo-bg-light flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <h1 className="sr-only">Password dimenticata — Mee Too</h1>

          <div className="text-center mb-10">
            <Logo
              variant="full"
              className="text-meetoo-accent-dark [--mt-logo-w:180px]"
            />
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-8 py-12">
            <div className="w-16 h-16 rounded-full bg-meetoo-bg-dark/20 flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-meetoo-bg-dark"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h2 className="font-inter font-extrabold uppercase tracking-widest text-xl text-meetoo-accent-dark mb-4">
              Controlla la tua email
            </h2>
            <p className="font-inter font-light text-meetoo-accent-dark/70 leading-relaxed">
              Se esiste un account con questa email, riceverai a breve un link
              per reimpostare la password. Il link va aperto sullo stesso
              dispositivo da cui hai fatto la richiesta.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-block bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-sm px-10 py-4 rounded-full transition-colors duration-300 hover:bg-meetoo-accent-light"
            >
              Torna al login
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-meetoo-bg-light flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <h1 className="sr-only">Password dimenticata — Mee Too</h1>

        {/* Logo / Brand — sistema <Logo>, statico (nessuna coreografia qui). */}
        <div className="text-center mb-10">
          <Logo
            variant="full"
            className="text-meetoo-accent-dark [--mt-logo-w:180px]"
          />
        </div>

        {/* Card */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-8 py-10">
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-xl text-meetoo-accent-dark mb-4 text-center">
            Password dimenticata
          </h2>

          <p className="font-inter font-light text-sm text-meetoo-accent-dark/70 leading-relaxed mb-8 text-center">
            Inserisci la tua email: ti invieremo un link per scegliere una
            nuova password.
          </p>

          {linkError && !error && (
            <p
              role="alert"
              className="font-inter font-light text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-5"
            >
              Il link non è valido o è scaduto. Richiedine uno nuovo.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="block font-inter font-light text-sm uppercase tracking-widest text-meetoo-accent-dark"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/40 focus:outline-none focus:border-meetoo-accent-light transition-colors"
                placeholder="la-tua@email.com"
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
              {loading ? 'Invio in corso…' : 'Invia link di reset'}
            </button>
          </form>

          <p className="mt-8 text-center font-inter font-light text-sm text-meetoo-accent-dark/70">
            Ricordi la password?{' '}
            <Link
              href="/login"
              className="text-meetoo-accent-dark underline underline-offset-4 hover:text-meetoo-accent-light transition-colors"
            >
              Accedi
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
