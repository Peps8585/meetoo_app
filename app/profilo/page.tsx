import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { utenteDaSessione } from '@/lib/supabase/utente'
import { iniziali, linkFoto } from '@/lib/foto'
import FotoProfilo from './FotoProfilo'
import ConsensoWhatsApp from './ConsensoWhatsApp'
import DatiPersonali from './DatiPersonali'

type Profile = {
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  whatsapp_eventi: boolean | null
}

type ClientPackage = {
  id: string
  amount_remaining: number
  amount_initial: number
  expires_at: string | null
  is_active: boolean
  packages: { name: string } | null
}

type WalletTransaction = {
  id: string
  amount: number
  type: 'credit' | 'debit' | 'refund'
  description: string | null
  created_at: string
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

export default async function ProfiloPage() {
  const supabase = await createClient()
  const user = await utenteDaSessione(supabase)

  if (!user) redirect('/login')

  // ── Dati personali ──────────────────────────────────────────────────
  const { data: profileData } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone, avatar_url, whatsapp_eventi')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null
  const foto = profile?.avatar_url ? (await linkFoto(supabase, [profile.avatar_url])).get(profile.avatar_url) ?? null : null

  // ── Pacchetti attivi ────────────────────────────────────────────────
  const now = new Date().toISOString()
  const { data: packagesData } = await supabase
    .from('client_packages')
    .select('id, amount_remaining, amount_initial, expires_at, is_active, packages:package_id(name)')
    .eq('client_id', user.id)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .gt('amount_remaining', 0)
    .order('expires_at', { ascending: true })

  const activePackages = (packagesData as unknown as ClientPackage[]) ?? []
  const totalBalance = activePackages.reduce(
    (sum, pkg) => sum + (pkg.amount_remaining ?? 0),
    0
  )

  // ── Movimenti wallet (ultimi 10) ────────────────────────────────────
  const { data: transactionsData } = await supabase
    .from('wallet_transactions')
    .select('id, amount, type, description, created_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const transactions = (transactionsData as WalletTransaction[]) ?? []

  // Crediti spenti o app in prova, e nessun pacchetto caricato:
  // il riquadro del credito non serve e direbbe solo "non hai credito".
  const { data: crediti } = await supabase.rpc('crediti_attivi')
  const { data: aperta } = await supabase.rpc('prenotazioni_app')
  const mostraPacchetti = (crediti !== false && aperta !== false) || activePackages.length > 0

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">

        {/* ── Back link + Title ── */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 font-inter font-light text-[11px] uppercase tracking-widest text-meetoo-accent-dark/45 hover:text-meetoo-accent-dark transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
          <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl sm:text-4xl text-meetoo-accent-dark leading-none">
            Il mio profilo
          </h1>
        </div>

        {/* ── I miei pacchetti ── */}
        {mostraPacchetti && (
        <section className="mb-8">
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-4">
            I miei pacchetti
          </h2>

          {/* Saldo totale in euro */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-6 sm:px-8 py-6 mb-2">
            <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 mb-1">
              Il tuo credito
            </p>
            <p className="font-inter font-extrabold text-4xl text-meetoo-accent-dark leading-none">
              {fmtEuro(totalBalance)}
            </p>
            {activePackages.length === 0 && (
              <div className="flex items-center gap-2 mt-3">
                <Package className="w-4 h-4 text-meetoo-accent-dark/20 shrink-0" />
                <p className="font-inter font-light text-sm text-meetoo-accent-dark/40">
                  Non hai credito attivo al momento.
                </p>
              </div>
            )}
          </div>

          {activePackages.length > 0 && (
            <div className="space-y-2">
              {activePackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="font-inter font-medium text-sm text-meetoo-accent-dark truncate">
                      {pkg.packages?.name ?? '—'}
                    </p>
                    <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-0.5">
                      {pkg.expires_at
                        ? `Scade il ${fmtDateLong(pkg.expires_at)}`
                        : 'Nessuna scadenza'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-inter font-semibold text-xl text-meetoo-accent-dark leading-none">
                      {fmtEuro(pkg.amount_remaining)}
                    </p>
                    <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40 mt-0.5">
                      residuo
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {/* ── Movimenti ── */}
        {(mostraPacchetti || transactions.length > 0) && (
        <details className="group mb-8">
          <summary className="block cursor-pointer list-none rounded-full border border-meetoo-accent-dark/25 py-3 text-center font-inter text-[11px] uppercase tracking-widest text-meetoo-accent-dark [&::-webkit-details-marker]:hidden mb-3">
            <span className="group-open:hidden">Vedi i movimenti del credito</span>
            <span className="hidden group-open:inline">Chiudi i movimenti</span>
          </summary>

          {transactions.length === 0 ? (
            <div className="bg-white/40 rounded-2xl border border-white/70 px-6 py-10 text-center">
              <Wallet className="w-5 h-5 text-meetoo-accent-dark/20 mx-auto mb-3" />
              <p className="font-inter font-light text-sm text-meetoo-accent-dark/40">
                Nessun movimento registrato.
              </p>
            </div>
          ) : (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-5 sm:px-6 divide-y divide-meetoo-accent-dark/5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-inter font-medium text-sm text-meetoo-accent-dark truncate">
                      {tx.description ?? '—'}
                    </p>
                    <p className="font-inter font-light text-xs text-meetoo-accent-dark/40 mt-0.5">
                      {fmtDateLong(tx.created_at)}
                    </p>
                  </div>

                  <p
                    className={[
                      'shrink-0 font-inter text-sm text-meetoo-accent-dark tabular-nums',
                      tx.amount >= 0 ? 'font-semibold' : 'font-light',
                    ].join(' ')}
                  >
                    {tx.amount >= 0 ? '+' : '−'}
                    {fmtEuro(Math.abs(tx.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </details>
        )}

        {/* Le lezioni passate stanno nella pagina Prenotazioni: qui non si ripetono */}
        <Link
          href="/prenotazioni"
          className="mb-10 block rounded-full border border-meetoo-accent-dark/25 py-3 text-center font-inter text-[11px] uppercase tracking-widest text-meetoo-accent-dark"
        >
          Le mie prenotazioni →
        </Link>

        {/* ── Dati personali ── */}
        <section className="mb-8">
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-4">
            Dati personali
          </h2>

          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-6 sm:px-8 py-6">
            <div className="mb-6 pb-6 border-b border-meetoo-accent-dark/5">
              <FotoProfilo
                userId={user.id}
                percorso={profile?.avatar_url ?? null}
                link={foto}
                iniziali={iniziali(profile?.first_name, profile?.last_name)}
              />
            </div>
            <DatiPersonali
              userId={user.id}
              nome={profile?.first_name ?? null}
              cognome={profile?.last_name ?? null}
              email={user.email ?? null}
              telefono={profile?.phone ?? null}
            />
          </div>
        </section>

        {/* ── Avvisi su WhatsApp ── */}
        <section className="mb-8">
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-4">
            Avvisi dello studio
          </h2>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-6 sm:px-8 py-6">
            <ConsensoWhatsApp
              userId={user.id}
              attivo={!!profile?.whatsapp_eventi}
              telefono={profile?.phone ?? null}
            />
          </div>
        </section>

      </div>
    </main>
  )
}
