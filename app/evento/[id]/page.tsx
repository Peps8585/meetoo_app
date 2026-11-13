import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { CAMPI_EVENTO, eventoPassato, fotoEvento, INDIRIZZO_STUDIO, quandoEvento, whatsappEvento, type Evento } from '@/lib/eventi'
import { Logo } from '../../Logo'

// Pagina pubblica di un evento: e' il link che parte negli avvisi e che una
// cliente puo' girare a un'amica. Si apre senza account. Il server la legge
// con la service role e mostra solo gli eventi pubblicati.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const leggi = cache(async (id: string): Promise<Evento | null> => {
  if (!UUID.test(id)) return null
  const { data } = await createAdminClient().from('eventi').select(CAMPI_EVENTO).eq('id', id).eq('pubblicato', true).maybeSingle()
  return (data as Evento | null) ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const e = await leggi(id)
  if (!e) return { title: 'Evento · Mee Too Pilates' }
  const descrizione = `${quandoEvento(e)}. ${e.descrizione}`.slice(0, 200)
  const foto = fotoEvento(e.foto)
  return {
    title: `${e.titolo} · Mee Too Pilates`,
    description: descrizione,
    openGraph: { title: e.titolo, description: descrizione, images: foto ? [foto] : undefined, type: 'article' },
  }
}

export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const e = await leggi(id)
  if (!e) notFound()
  const foto = fotoEvento(e.foto)
  const passato = eventoPassato(e)

  return (
    <main className="min-h-screen bg-meetoo-bg-light px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-xl">
        <Link href="/" aria-label="Mee Too Pilates" className="mb-8 inline-block">
          <Logo variant="compact" className="text-meetoo-accent-dark [--mt-logo-w:96px]" />
        </Link>

        <article className="overflow-hidden rounded-2xl border border-white/80 bg-white/60 shadow-sm">
          {foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="aspect-[3/2] w-full object-cover" />
          )}
          <div className="px-6 py-6">
            <p className="font-inter text-[11px] font-normal uppercase tracking-[0.2em] text-meetoo-accent-dark/55">
              {quandoEvento(e)}
            </p>
            <h1 className="mt-2 font-inter text-2xl font-extrabold leading-tight text-meetoo-accent-dark">{e.titolo}</h1>
            {e.descrizione && (
              <p className="mt-4 whitespace-pre-line font-inter text-[15px] font-light leading-relaxed text-meetoo-accent-dark/80">
                {e.descrizione}
              </p>
            )}
            <p className="mt-4 font-inter text-sm font-light text-meetoo-accent-dark/60">
              {INDIRIZZO_STUDIO}
            </p>

            {passato ? (
              <p className="mt-6 rounded-xl bg-meetoo-accent-dark/5 px-4 py-3 text-center font-inter text-sm text-meetoo-accent-dark/70">
                Questo evento si è già svolto.
              </p>
            ) : (
              <a
                href={whatsappEvento(e)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 block rounded-full bg-meetoo-accent-dark py-4 text-center font-inter text-xs font-normal uppercase tracking-widest text-meetoo-bg-light transition-colors hover:bg-meetoo-bg-dark"
              >
                Scrivici su WhatsApp
              </a>
            )}
          </div>
        </article>
      </div>
    </main>
  )
}
