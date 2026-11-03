import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminStaff } from '@/lib/gift/staff'
import { elencoContatti } from '@/lib/contatti-elenco'
import { ETICHETTE } from '@/lib/contatti'
import { fmtDay } from '@/lib/gift/format'

// Contatti dello studio con le etichette. Oggi li riempiono le gift card:
// chi regala (alla vendita) e chi riceve (all'attivazione in studio).

const scheda = 'bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl shadow-sm'

export default async function ContattiPage({
  searchParams,
}: {
  searchParams: Promise<{ etichetta?: string; consenso?: string; q?: string }>
}) {
  const staff = await getAdminStaff()
  if (!staff) redirect('/login?next=/admin/contatti')
  const sp = await searchParams
  const filtro = { etichetta: sp.etichetta || undefined, consenso: sp.consenso === '1', q: sp.q || undefined }
  const contatti = await elencoContatti(staff.studioId, filtro)

  const filtri: { label: string; href: string; attivo: boolean }[] = [
    { label: 'Tutti', href: '/admin/contatti', attivo: !filtro.etichetta && !filtro.consenso },
    ...Object.values(ETICHETTE).map((e) => ({
      label: e,
      href: `/admin/contatti?etichetta=${encodeURIComponent(e)}`,
      attivo: filtro.etichetta === e,
    })),
    { label: 'Vogliono le novità', href: '/admin/contatti?consenso=1', attivo: filtro.consenso },
  ]
  const esporta = `/admin/contatti/esporta?${new URLSearchParams(
    Object.entries({ etichetta: sp.etichetta ?? '', consenso: sp.consenso ?? '', q: sp.q ?? '' }).filter(([, v]) => v),
  )}`

  return (
    <div className="max-w-4xl p-6 sm:p-8">
      <div className="mb-8">
        <p className="mb-1 font-inter text-xs font-normal uppercase tracking-[0.3em] text-meetoo-accent-dark/50">Admin</p>
        <h1 className="font-inter text-3xl font-extrabold uppercase tracking-widest text-meetoo-accent-dark">Contatti</h1>
        <p className="mt-2 max-w-[60ch] font-inter text-sm font-light text-meetoo-accent-dark/55">
          Le persone passate dalle gift card. Scrivete promozioni solo a chi ha detto sì alle novità: per gli altri i
          dati servono a gestire il regalo e la ricevuta.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filtri.map((f) => (
          <Link
            key={f.label}
            href={f.href}
            className={`rounded-full px-3.5 py-1.5 font-inter text-[13px] ${f.attivo ? 'bg-meetoo-accent-dark text-meetoo-bg-light' : 'bg-white/70 text-meetoo-accent-dark'}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form className="flex min-w-[240px] flex-1 gap-2" action="/admin/contatti">
          {sp.etichetta && <input type="hidden" name="etichetta" value={sp.etichetta} />}
          {sp.consenso && <input type="hidden" name="consenso" value={sp.consenso} />}
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Cerca per nome, email o telefono"
            className="min-w-0 flex-1 rounded-xl border border-meetoo-accent-dark/15 bg-white/80 px-3.5 py-2.5 font-inter text-sm outline-none focus:border-meetoo-accent-light"
          />
          <button className="rounded-full bg-meetoo-accent-dark px-5 font-inter text-sm text-meetoo-bg-light">Cerca</button>
        </form>
        <a href={esporta} className="rounded-full border border-meetoo-accent-dark/20 px-5 py-2.5 font-inter text-sm text-meetoo-accent-dark hover:bg-white/70">
          Scarica in Excel
        </a>
      </div>

      <p className="mb-3 mt-6 font-inter text-xs text-meetoo-accent-dark/45">
        {contatti.length} {contatti.length === 1 ? 'contatto' : 'contatti'}
      </p>
      {contatti.length === 0 && <p className="font-inter text-sm font-light text-meetoo-accent-dark/45">Nessun contatto con questi filtri.</p>}

      <div className="space-y-2.5">
        {contatti.map((c) => (
          <details key={c.id} className={`${scheda} group px-5 py-4`}>
            <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
              <span className="min-w-0">
                <b className="block font-inter text-[15px] font-semibold text-meetoo-accent-dark">{c.nome ?? 'Senza nome'}</b>
                <span className="block font-inter text-[13px] font-light text-meetoo-accent-dark/60">
                  {[c.email, c.telefono].filter(Boolean).join(' · ')}
                </span>
                {c.contatti_eventi[0] && (
                  <span className="mt-1 block font-inter text-xs font-light text-meetoo-accent-dark/45">
                    {fmtDay(c.contatti_eventi[0].created_at)}: {c.contatti_eventi[0].descrizione}
                  </span>
                )}
              </span>
              <span className="flex flex-wrap justify-end gap-1.5">
                {c.etichette.map((e) => (
                  <span key={e} className="rounded-full bg-meetoo-accent-light/15 px-2.5 py-1 font-inter text-[11px] text-[#7a5a3d]">{e}</span>
                ))}
                {c.consenso_novita && <span className="rounded-full bg-[#dfe8da] px-2.5 py-1 font-inter text-[11px] text-[#4e5e49]">vuole le novità</span>}
              </span>
            </summary>
            <div className="mt-3 border-t border-meetoo-accent-dark/10 pt-3 font-inter text-[13px] text-meetoo-accent-dark/70">
              {c.contatti_eventi.map((e, i) => (
                <p key={i} className="py-0.5">
                  <span className="text-meetoo-accent-dark/40">{fmtDay(e.created_at)}</span> · {e.descrizione}
                </p>
              ))}
              <p className="mt-2 text-xs text-meetoo-accent-dark/40">
                Contatto dal {fmtDay(c.created_at)}
                {c.consenso_at ? ` · consenso alle novità dal ${fmtDay(c.consenso_at)}` : ' · nessun consenso alle novità'}
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
