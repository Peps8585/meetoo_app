'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email o password non corretti.'
          : error.message
      )
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
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
            Accedi
          </h2>

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
                autoComplete="current-password"
                required
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
              {loading ? 'Accesso in corso…' : 'Accedi'}
            </button>
          </form>

          <p className="mt-8 text-center font-inter font-light text-sm text-meetoo-accent-dark/70">
            Non hai un account?{' '}
            <Link
              href="/registrati"
              className="text-meetoo-accent-dark underline underline-offset-4 hover:text-meetoo-accent-light transition-colors"
            >
              Registrati
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
