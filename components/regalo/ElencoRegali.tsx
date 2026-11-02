import Link from 'next/link'
import { fmtDay, fmtDayTime, giftContents } from '@/lib/gift/format'
import type { RigaRegalo } from '@/lib/gift/report'

// Elenco dei regali per lo studio: lo usano /studio/regali e /admin/gift-card.

const GIORNO = 24 * 3600 * 1000

function stato(r: RigaRegalo, ora: number): { testo: string; tono: string } {
  if (r.status === 'redeemed') return { testo: 'attivato', tono: 'bg-[#dfe8da] text-[#4e5e49]' }
  if (r.status === 'void') return { testo: 'annullato', tono: 'bg-[#ece4d8] text-[#6f6a63]' }
  if (r.valid_until && new Date(r.valid_until).getTime() < ora) {
    return { testo: `scaduto il ${fmtDay(r.valid_until)}`, tono: 'bg-[#f3e3df] text-[#8a4f40]' }
  }
  if (r.status === 'paid' && r.send_at) return { testo: `arriva il ${fmtDayTime(r.send_at)}`, tono: 'bg-[#efe1ce] text-[#7a5a3d]' }
  if (r.valid_until) {
    const giorni = Math.ceil((new Date(r.valid_until).getTime() - ora) / GIORNO)
    if (giorni <= 30) return { testo: `scade tra ${giorni} gg`, tono: 'bg-[#f3e3df] text-[#8a4f40]' }
  }
  return { testo: 'da attivare', tono: 'bg-[#efe1ce] text-[#7a5a3d]' }
}

export function ElencoRegali({ titolo, righe, vuoto, ora }: { titolo: string; righe: RigaRegalo[]; vuoto: string; ora: number }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a63]">{titolo}</h2>
      {righe.length === 0 && <p className="text-sm text-[#6f6a63]">{vuoto}</p>}
      {righe.map((r) => {
        const e = stato(r, ora)
        return (
          <Link
            key={r.code}
            href={`/regalo/${r.code}`}
            className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-[#fffdf9] px-4 py-3 transition-colors hover:bg-white"
          >
            <span className="min-w-0">
              <b className="block truncate text-[14.5px] font-semibold">{r.holder_name ?? r.to_name}</b>
              <small className="block truncate text-[12.5px] text-[#6f6a63]">
                {giftContents(r)} · da {r.from_name}
                {r.studio_note ? ` · ${r.studio_note}` : ''}
              </small>
              {!r.receipt_done_at && r.status !== 'void' && (
                <small className="mt-0.5 block text-[11.5px] font-semibold text-[#a8876a]">ricevuta da fare</small>
              )}
            </span>
            <em className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold not-italic ${e.tono}`}>{e.testo}</em>
          </Link>
        )
      })}
    </section>
  )
}
