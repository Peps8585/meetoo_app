import { redirect } from 'next/navigation'
import { getGiftStaff } from '@/lib/gift/staff'
import { loadGiftReport, type Mese } from '@/lib/gift/report'
import { fmtEuro } from '@/lib/gift/format'
import { ElencoRegali } from '@/components/regalo/ElencoRegali'
import { CodiceAMano } from '@/components/regalo/CodiceAMano'

// Gift card nel pannello: soldi, andamento, cosa si regala e gli elenchi.
// L'accesso da admin lo controlla gia' il layout di /admin.

const scheda = 'bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-5 py-5 shadow-sm'
const etichetta = 'font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40'

function Numero({ label, value, sotto }: { label: string; value: string | number; sotto?: string }) {
  return (
    <div className={scheda}>
      <p className={etichetta}>{label}</p>
      <p className="mt-2 font-inter text-3xl font-light tracking-tight text-meetoo-accent-dark">{value}</p>
      {sotto && <p className="mt-1 font-inter text-xs font-light text-meetoo-accent-dark/45">{sotto}</p>}
    </div>
  )
}

/**
 * Incasso mese per mese, ultimi 12 mesi. Una serie sola, un colore solo (terra),
 * barre sottili ancorate alla base con l'estremita' arrotondata; il numero sopra
 * solo sul mese migliore, il resto passando sopra la barra. Sotto, la tabella.
 */
function Andamento({ mesi }: { mesi: Mese[] }) {
  const max = Math.max(...mesi.map((m) => m.euro))
  if (max === 0) return <p className="py-6 text-center font-inter text-sm font-light text-meetoo-accent-dark/40">Nessuna vendita negli ultimi 12 mesi.</p>
  const migliore = mesi.findIndex((m) => m.euro === max)
  return (
    <>
      <div className="flex h-44 items-end gap-[2px] border-b border-meetoo-accent-dark/15 pt-6" role="img" aria-label="Incasso delle gift card mese per mese, ultimi 12 mesi">
        {mesi.map((m, i) => (
          <div key={m.chiave} className="group relative flex h-full flex-1 items-end justify-center">
            {/* area sensibile piu' larga della barra */}
            <div
              className="w-full max-w-[26px] rounded-t-[4px] bg-[#a8876a] transition-opacity group-hover:opacity-80"
              style={{ height: m.euro > 0 ? `max(${(m.euro / max) * 100}%, 3px)` : '0px' }}
            />
            {i === migliore && (
              <span className="absolute whitespace-nowrap font-inter text-[11px] text-meetoo-accent-dark/60" style={{ bottom: `calc(${(m.euro / max) * 100}% + 4px)`, top: 'auto' }}>
                {fmtEuro(m.euro)}
              </span>
            )}
            <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-meetoo-accent-dark px-2.5 py-1.5 font-inter text-xs text-meetoo-bg-light shadow group-hover:block">
              {m.etichetta}: {fmtEuro(m.euro)} · {m.vendute} card
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {mesi.map((m) => (
          <span key={m.chiave} className="flex-1 text-center font-inter text-[10px] font-light text-meetoo-accent-dark/40">
            {m.etichetta.split(' ')[0]}
          </span>
        ))}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer font-inter text-xs text-meetoo-accent-dark/50">Vedi i numeri</summary>
        <table className="mt-2 w-full font-inter text-sm">
          <thead>
            <tr className="text-left text-xs text-meetoo-accent-dark/45">
              <th className="py-1 font-normal">Mese</th>
              <th className="py-1 text-right font-normal">Card</th>
              <th className="py-1 text-right font-normal">Incasso</th>
            </tr>
          </thead>
          <tbody>
            {mesi.map((m) => (
              <tr key={m.chiave} className="border-t border-meetoo-accent-dark/5">
                <td className="py-1">{m.etichetta}</td>
                <td className="py-1 text-right">{m.vendute}</td>
                <td className="py-1 text-right">{fmtEuro(m.euro)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  )
}

export default async function AdminGiftCardPage() {
  const staff = await getGiftStaff()
  if (!staff) redirect('/login?next=/admin/gift-card')

  // pagina server, rigenerata a ogni visita
  const ora = new Date().getTime()
  const r = await loadGiftReport(staff.studioId, ora)
  const maxRegalato = Math.max(1, ...r.piuRegalati.map((p) => p.vendute))
  const daRicevuta = r.validi.filter((g) => !g.receipt_done_at)

  return (
    <div className="max-w-4xl p-6 sm:p-8">
      <div className="mb-10">
        <p className="mb-1 font-inter text-xs font-normal uppercase tracking-[0.3em] text-meetoo-accent-dark/50">Admin</p>
        <h1 className="font-inter text-3xl font-extrabold uppercase tracking-widest text-meetoo-accent-dark">Gift card</h1>
        <p className="mt-2 font-inter text-sm font-light text-meetoo-accent-dark/55">
          Si vendono su{' '}
          <a href="/regala" className="underline underline-offset-4">
            regali.meetoopilates.com/regala
          </a>
          . Qui i conti, l&apos;andamento e i regali da seguire.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Numero label="Incassato questo mese" value={fmtEuro(r.incassoMese)} sotto={`${r.venduteMese} card`} />
        <Numero label="Incassato in totale" value={fmtEuro(r.incassoTotale)} sotto={`${r.validi.length} card vendute`} />
        <Numero label="Attivate in studio" value={r.attivati.length} sotto={`${r.daAttivare.length} da attivare`} />
        <Numero label="Ricevute da fare" value={r.ricevuteDaFare} sotto={r.ricevuteDaFare ? 'su Aruba Fatturazione' : 'tutto in ordine'} />
      </div>

      <section className={`${scheda} mt-6`}>
        <p className={etichetta}>Incasso mese per mese</p>
        <Andamento mesi={r.mesi} />
      </section>

      <section className={`${scheda} mt-6`}>
        <p className={`${etichetta} mb-3`}>Cosa si regala</p>
        {r.piuRegalati.length === 0 && <p className="font-inter text-sm font-light text-meetoo-accent-dark/40">Ancora nessuna vendita.</p>}
        <div className="space-y-2.5">
          {r.piuRegalati.map((p) => (
            <div key={p.nome}>
              <div className="flex justify-between gap-3 font-inter text-sm">
                <span className="truncate text-meetoo-accent-dark">{p.nome}</span>
                <span className="shrink-0 text-meetoo-accent-dark/55">
                  {p.vendute} · {fmtEuro(p.euro)}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-meetoo-accent-dark/5">
                <div className="h-full rounded-full bg-[#a8876a]" style={{ width: `${(p.vendute / maxRegalato) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 max-w-[520px]">
        <CodiceAMano />
        {daRicevuta.length > 0 && <ElencoRegali titolo="Ricevute da fare" righe={daRicevuta} vuoto="" ora={ora} />}
        <ElencoRegali titolo="Da attivare" righe={r.daAttivare} vuoto="Nessun regalo in attesa." ora={ora} />
        <ElencoRegali titolo="Attivati" righe={r.attivati} vuoto="Ancora nessuno." ora={ora} />
        {r.scaduti.length > 0 && <ElencoRegali titolo="Scaduti senza essere usati" righe={r.scaduti} vuoto="" ora={ora} />}
        {r.annullati.length > 0 && <ElencoRegali titolo="Annullati (rimborsati)" righe={r.annullati} vuoto="" ora={ora} />}
      </div>
    </div>
  )
}
