'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Consenso agli avvisi dello studio su WhatsApp (S35). I WhatsApp che partono
// dall'app vanno solo a chi ha spuntato questa casella; per mandarli serve un
// numero di cellulare, che si puo' scrivere qui se nel profilo manca.
export default function ConsensoWhatsApp({
  userId,
  attivo,
  telefono,
}: {
  userId: string
  attivo: boolean
  telefono: string | null
}) {
  const router = useRouter()
  const [si, setSi] = useState(attivo)
  const [numero, setNumero] = useState(telefono ?? '')
  const [busy, setBusy] = useState(false)
  const [nota, setNota] = useState<{ ok: boolean; testo: string } | null>(null)

  const numeroValido = numero.replace(/\D/g, '').length >= 9
  const cambiato = si !== attivo || (si && numero.trim() !== (telefono ?? ''))

  async function salva() {
    if (si && !numeroValido) {
      setNota({ ok: false, testo: 'Scrivi il tuo numero di cellulare, così sappiamo dove mandarli.' })
      return
    }
    setBusy(true)
    setNota(null)
    const { error } = await createClient()
      .from('profiles')
      .update({
        whatsapp_eventi: si,
        whatsapp_eventi_at: new Date().toISOString(),
        ...(si ? { phone: numero.trim() } : {}),
      })
      .eq('id', userId)
    setBusy(false)
    if (error) {
      setNota({ ok: false, testo: 'Non è stato possibile salvare. Riprova.' })
      return
    }
    setNota({ ok: true, testo: si ? 'Salvato: gli avvisi ti arriveranno anche su WhatsApp.' : 'Salvato: non riceverai avvisi su WhatsApp.' })
    router.refresh()
  }

  return (
    <div>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={si} onChange={(e) => { setSi(e.target.checked); setNota(null) }} />
        <span>
          <span className="block font-inter text-sm font-normal text-meetoo-accent-dark">
            Voglio ricevere gli avvisi dello studio anche su WhatsApp
          </span>
          <span className="mt-1 block font-inter text-xs font-light leading-relaxed text-meetoo-accent-dark/55">
            Sono gli eventi in programma e le comunicazioni sulle lezioni a cui sei iscritta. Puoi togliere la spunta quando vuoi.
          </span>
        </span>
      </label>

      {si && (
        <div className="mt-4">
          <label htmlFor="wa-numero" className="mb-1.5 block font-inter text-[10px] font-light uppercase tracking-widest text-meetoo-accent-dark/40">
            Numero di cellulare
          </label>
          <input
            id="wa-numero"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="w-full rounded-xl border border-meetoo-accent-dark/15 bg-white/80 px-3.5 py-2.5 font-inter text-[15px] text-meetoo-accent-dark outline-none focus:border-meetoo-accent-light"
          />
        </div>
      )}

      {cambiato && (
        <button
          type="button"
          disabled={busy}
          onClick={salva}
          className="mt-4 rounded-full bg-meetoo-accent-dark px-6 py-3 font-inter text-[11px] font-normal uppercase tracking-widest text-meetoo-bg-light transition-colors hover:bg-meetoo-bg-dark disabled:opacity-40"
        >
          {busy ? 'Un attimo…' : 'Salva'}
        </button>
      )}
      {nota && <p className={`mt-3 font-inter text-xs ${nota.ok ? 'text-meetoo-bg-dark' : 'text-amber-800'}`}>{nota.testo}</p>}
    </div>
  )
}
