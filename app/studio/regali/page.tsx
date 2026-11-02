import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getGiftStaff } from '@/lib/gift/staff'
import { loadGiftReport } from '@/lib/gift/report'
import { ElencoRegali } from '@/components/regalo/ElencoRegali'
import { CodiceAMano } from '@/components/regalo/CodiceAMano'

export const metadata: Metadata = { title: 'Regali · Studio', robots: { index: false, follow: false } }

/** La pagina dei regali da telefono, per chi e' in studio (admin e istruttrici). */
export default async function RegaliStudioPage() {
  const staff = await getGiftStaff()
  if (!staff) redirect('/login?next=/studio/regali')

  // pagina server, rigenerata a ogni visita: l'ora serve per scadenze e conti alla rovescia
  const ora = new Date().getTime()
  const r = await loadGiftReport(staff.studioId, ora)

  return (
    <main className="min-h-svh bg-[#f5f0e8] px-5 pb-16 text-[#2c2c2c]">
      <div className="mx-auto max-w-[520px]">
        <div className="flex h-14 items-center justify-between text-[11px] font-bold tracking-[0.12em]">
          <span>STUDIO · REGALI</span>
          <span className="font-semibold text-[#7d8b78]">{staff.name}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            [r.validi.length, 'venduti'],
            [r.attivati.length, 'attivati'],
            [r.daAttivare.length, 'da attivare'],
          ].map(([n, l]) => (
            <div key={l} className="rounded-xl bg-[#fffdf9] p-3.5">
              <b className="block text-[26px] font-light tracking-[-0.03em]">{n}</b>
              <small className="text-xs text-[#6f6a63]">{l}</small>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <CodiceAMano />
        </div>

        <ElencoRegali titolo="Da attivare" righe={r.daAttivare} vuoto="Nessun regalo in attesa." ora={ora} />
        <ElencoRegali titolo="Attivati" righe={r.attivati} vuoto="Ancora nessuno." ora={ora} />
        {r.scaduti.length > 0 && <ElencoRegali titolo="Scaduti senza essere usati" righe={r.scaduti} vuoto="" ora={ora} />}
        {r.annullati.length > 0 && <ElencoRegali titolo="Annullati (rimborsati)" righe={r.annullati} vuoto="" ora={ora} />}
      </div>
    </main>
  )
}
