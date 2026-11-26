import type { Metadata } from 'next'
import Link from 'next/link'
import { chiudiOrdinePacchetto } from '@/lib/pacchetti/negozio'

export const metadata: Metadata = { title: 'Pacchetto acquistato · Mee Too Pilates', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function PacchettoFattoPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams
  // l'avviso di Stripe potrebbe non essere ancora arrivato: si chiude il pagamento anche da qui
  const esito = session_id ? await chiudiOrdinePacchetto(session_id) : { stato: 'sconosciuto' as const }
  const ok = esito.stato === 'pagato'

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 sm:px-6 py-16">
      <div className="max-w-md mx-auto">
        {ok && <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-meetoo-accent-dark text-2xl text-meetoo-bg-light">✓</div>}
        <h1 className="font-inter font-extrabold uppercase tracking-widest text-2xl text-meetoo-accent-dark leading-tight">
          {ok ? 'Grazie!' : esito.stato === 'in_attesa' ? 'Pagamento in corso' : 'Pagamento non completato'}
        </h1>
        <p className="mt-4 font-inter font-light text-[15px] leading-relaxed text-meetoo-accent-dark/70">
          {ok
            ? `Il pacchetto ${esito.nome} è già nel tuo profilo e puoi usarlo da subito per prenotare.`
            : esito.stato === 'in_attesa'
              ? 'Stiamo aspettando la conferma del pagamento. Appena arriva, il pacchetto compare nel tuo profilo da solo.'
              : 'Se hai chiuso la pagina di pagamento, non ti è stato addebitato niente.'}
        </p>
        <Link
          href={ok ? '/profilo' : '/pacchetti'}
          className="mt-8 inline-block font-inter font-normal uppercase tracking-widest text-[11px] px-6 py-3 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light"
        >
          {ok ? 'Vai al profilo' : 'Torna ai pacchetti'}
        </Link>
      </div>
    </main>
  )
}
