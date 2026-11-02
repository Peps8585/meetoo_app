import { redirect } from 'next/navigation'
import { normalizeCode } from '@/lib/gift/data'

// Campo per aprire un regalo scrivendo il codice, se il QR non si legge.

async function apriCodice(formData: FormData) {
  'use server'
  const codice = normalizeCode(String(formData.get('codice') ?? ''))
  if (codice) redirect(`/regalo/${codice}`)
}

export function CodiceAMano() {
  return (
    <form action={apriCodice}>
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
  )
}
