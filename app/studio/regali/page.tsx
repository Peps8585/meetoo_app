import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getGiftStaff } from '@/lib/gift/staff'
import { createAdminClient } from '@/lib/supabase/admin'
import { fmtDay, fmtDayTime, giftContents } from '@/lib/gift/format'
import { normalizeCode } from '@/lib/gift/data'

export const metadata: Metadata = { title: 'Regali · Studio', robots: { index: false, follow: false } }

type Riga = {
  code: string
  status: string
  discipline: string
  lessons: number
  from_name: string
  to_name: string
  holder_name: string | null
  studio_note: string | null
  send_at: string | null
  valid_until: string | null
  redeemed_at: string | null
  receipt_done_at: string | null
}

const GIORNO = 24 * 3600 * 1000

const scaduto = (r: Riga, ora: number) => !!r.valid_until && new Date(r.valid_until).getTime() < ora

function stato(r: Riga, ora: number): { testo: string; tono: string } {
  if (r.status === 'redeemed') return { testo: 'attivato', tono: 'bg-[#dfe8da] text-[#4e5e49]' }
  if (scaduto(r, ora)) return { testo: `scaduto il ${fmtDay(r.valid_until!)}`, tono: 'bg-[#f3e3df] text-[#8a4f40]' }
  if (r.status === 'paid' && r.send_at) return { testo: `arriva il ${fmtDayTime(r.send_at)}`, tono: 'bg-[#efe1ce] text-[#7a5a3d]' }
  if (r.valid_until) {
    const giorni = Math.ceil((new Date(r.valid_until).getTime() - ora) / GIORNO)
    if (giorni <= 30) return { testo: `scade tra ${giorni} gg`, tono: 'bg-[#f3e3df] text-[#8a4f40]' }
  }
  return { testo: 'da attivare', tono: 'bg-[#efe1ce] text-[#7a5a3d]' }
}

function Elenco({ titolo, righe, vuoto, ora }: { titolo: string; righe: Riga[]; vuoto: string; ora: number }) {
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

async function apriCodice(formData: FormData) {
  'use server'
  const codice = normalizeCode(String(formData.get('codice') ?? ''))
  if (codice) redirect(`/regalo/${codice}`)
}

export default async function RegaliStudioPage() {
  const staff = await getGiftStaff()
  if (!staff) redirect('/login?next=/studio/regali')

  const { data } = await createAdminClient()
    .from('gift_cards')
    .select('code, status, discipline, lessons, from_name, to_name, holder_name, studio_note, send_at, valid_until, redeemed_at, receipt_done_at')
    .eq('studio_id', staff.studioId)
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
  const regali = (data ?? []) as Riga[]

  // pagina server, rigenerata a ogni visita: l'ora serve per scadenze e conti alla rovescia
  const ora = new Date().getTime()
  const daAttivare = regali
    .filter((r) => (r.status === 'paid' || r.status === 'delivered') && !scaduto(r, ora))
    .sort((a, b) => (a.valid_until ?? '9').localeCompare(b.valid_until ?? '9'))
  const attivati = regali.filter((r) => r.status === 'redeemed')
  const scaduti = regali.filter((r) => r.status !== 'redeemed' && r.status !== 'void' && scaduto(r, ora))

  return (
    <main className="min-h-svh bg-[#f5f0e8] px-5 pb-16 text-[#2c2c2c]">
      <div className="mx-auto max-w-[520px]">
        <div className="flex h-14 items-center justify-between text-[11px] font-bold tracking-[0.12em]">
          <span>STUDIO · REGALI</span>
          <span className="font-semibold text-[#7d8b78]">{staff.name}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            [regali.filter((r) => r.status !== 'void').length, 'venduti'],
            [attivati.length, 'attivati'],
            [daAttivare.length, 'da attivare'],
          ].map(([n, l]) => (
            <div key={l} className="rounded-xl bg-[#fffdf9] p-3.5">
              <b className="block text-[26px] font-light tracking-[-0.03em]">{n}</b>
              <small className="text-xs text-[#6f6a63]">{l}</small>
            </div>
          ))}
        </div>

        <form action={apriCodice} className="mt-6">
          <label className="mb-1.5 block text-[12.5px] font-semibold" htmlFor="codice">
            Codice a mano
          </label>
          <div className="flex gap-2">
            <input
              id="codice"
              name="codice"
              placeholder="es. 6AYM-HMVC"
              autoCapitalize="characters"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-[10px] border border-[#2c2c2c]/15 bg-[#fffdf9] px-3.5 py-3 text-[15px] uppercase tracking-[0.08em] outline-none focus:border-[#a8876a]"
            />
            <button type="submit" className="rounded-full bg-[#2c2c2c] px-5 text-sm font-medium text-[#f5f0e8]">
              Apri
            </button>
          </div>
        </form>

        <Elenco titolo="Da attivare" righe={daAttivare} vuoto="Nessun regalo in attesa." ora={ora} />
        <Elenco titolo="Attivati" righe={attivati} vuoto="Ancora nessuno." ora={ora} />
        {scaduti.length > 0 && <Elenco titolo="Scaduti senza essere usati" righe={scaduti} vuoto="" ora={ora} />}
      </div>
    </main>
  )
}
