'use client'

import { useEffect, useState } from 'react'
import { Bell, Share } from 'lucide-react'
import { salvaIscrizione } from './notifiche-actions'

type Stato = 'caricamento' | 'attive' | 'da-attivare' | 'iphone-home' | 'negate' | 'non-supportate'

function chiaveVapid(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// Su iPhone le notifiche arrivano solo se l'app e' stata aggiunta alla
// schermata Home e aperta da li'. Su Android basta dire si'.
function sullaHome(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
const iPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

export default function Notifiche() {
  const [stato, setStato] = useState<Stato>('caricamento')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function controlla() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setStato(iPhone() && !sullaHome() ? 'iphone-home' : 'non-supportate')
        return
      }
      if (Notification.permission === 'denied') return setStato('negate')
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.getSubscription()
      if (sub && Notification.permission === 'granted') {
        // ogni volta che apre l'app si riconferma il telefono (le iscrizioni scadono)
        void salvaIscrizione(sub.toJSON() as Parameters<typeof salvaIscrizione>[0])
        setStato('attive')
      } else setStato('da-attivare')
    }
    controlla().catch(() => setStato('non-supportate'))
  }, [])

  async function attiva() {
    setBusy(true)
    try {
      const permesso = await Notification.requestPermission()
      if (permesso !== 'granted') {
        setStato(permesso === 'denied' ? 'negate' : 'da-attivare')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chiaveVapid(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''),
      })
      const { ok } = await salvaIscrizione(sub.toJSON() as Parameters<typeof salvaIscrizione>[0])
      setStato(ok ? 'attive' : 'da-attivare')
    } finally {
      setBusy(false)
    }
  }

  if (stato === 'caricamento' || stato === 'attive' || stato === 'non-supportate') return null

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-6 py-5 mb-8 flex gap-4">
      <div className="shrink-0 w-9 h-9 rounded-full bg-meetoo-bg-dark/15 flex items-center justify-center">
        <Bell className="w-4 h-4 text-meetoo-bg-dark" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-inter font-medium text-sm text-meetoo-accent-dark">Attiva le notifiche</p>
        {stato === 'iphone-home' ? (
          <p className="font-inter font-light text-[13px] leading-relaxed text-meetoo-accent-dark/60 mt-1">
            Così ti ricordiamo le lezioni e ti avvisiamo se si libera un posto. Su iPhone prima aggiungi l’app alla
            schermata Home: tocca <Share className="inline w-3.5 h-3.5 -mt-0.5" aria-label="Condividi" />, poi
            «Aggiungi alla schermata Home», e aprila da lì.
          </p>
        ) : stato === 'negate' ? (
          <p className="font-inter font-light text-[13px] leading-relaxed text-meetoo-accent-dark/60 mt-1">
            Le notifiche sono bloccate per questa app. Puoi riattivarle dalle impostazioni del telefono. Intanto i
            promemoria ti arrivano per email.
          </p>
        ) : (
          <>
            <p className="font-inter font-light text-[13px] leading-relaxed text-meetoo-accent-dark/60 mt-1">
              Così ti ricordiamo le lezioni e ti avvisiamo se si libera un posto, senza aprire l’app.
            </p>
            <button
              disabled={busy}
              onClick={attiva}
              className="mt-3 font-inter font-normal uppercase tracking-widest text-[11px] px-6 py-2.5 rounded-full bg-meetoo-accent-dark text-meetoo-bg-light hover:bg-meetoo-accent-light disabled:opacity-50 transition-colors"
            >
              {busy ? 'Un attimo…' : 'Attiva'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
