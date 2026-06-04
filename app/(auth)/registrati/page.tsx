'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegistratiPage() {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const nome    = formData.get('nome')    as string
    const cognome = formData.get('cognome') as string

    const { data: authData, error } = await supabase.auth.signUp({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { nome, cognome },
      },
    })

    if (error) {
      setError(
        error.message === 'User already registered'
          ? 'Esiste già un account con questa email.'
          : error.message
      )
      setLoading(false)
    } else {
      // Salva first_name e last_name nel profilo (il trigger Supabase crea la riga,
      // upsert aggiunge i dati anagrafici anche se il trigger è già passato)
      if (authData.user) {
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          first_name: nome,
          last_name: cognome,
        })
      }
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-meetoo-bg-light flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
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
              Registrazione completata
            </h2>
            <p className="font-inter font-light text-meetoo-accent-dark/70 leading-relaxed">
              Controlla la tua email per confermare l&apos;account. Dopo la
              conferma potrai accedere.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-block bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-sm px-10 py-4 rounded-full transition-colors duration-300 hover:bg-meetoo-accent-light"
            >
              Vai al login
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-meetoo-bg-light flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <p className="font-inter font-extrabold uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark mb-2">
            Studio Pilates &amp; Yoga
          </p>
          <h1 className="font-inter font-extrabold uppercase tracking-widest text-5xl text-meetoo-accent-dark leading-none">
            MEE TOO
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-8 py-10">
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-xl text-meetoo-accent-dark mb-8 text-center">
            Crea account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="nome"
                  className="block font-inter font-light text-sm uppercase tracking-widest text-meetoo-accent-dark"
                >
                  Nome
                </label>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  autoComplete="given-name"
                  required
                  className="w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/40 focus:outline-none focus:border-meetoo-accent-light transition-colors"
                  placeholder="Laura"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="cognome"
                  className="block font-inter font-light text-sm uppercase tracking-widest text-meetoo-accent-dark"
                >
                  Cognome
                </label>
                <input
                  id="cognome"
                  name="cognome"
                  type="text"
                  autoComplete="family-name"
                  required
                  className="w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/40 focus:outline-none focus:border-meetoo-accent-light transition-colors"
                  placeholder="Rossi"
                />
              </div>
            </div>

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

            <div className="space-y-1">
              <label
                htmlFor="password"
                className="block font-inter font-light text-sm uppercase tracking-widest text-meetoo-accent-dark"
              >
                Password
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
              {loading ? 'Creazione account…' : 'Crea account'}
            </button>
          </form>

          <p className="mt-8 text-center font-inter font-light text-sm text-meetoo-accent-dark/70">
            Hai già un account?{' '}
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
