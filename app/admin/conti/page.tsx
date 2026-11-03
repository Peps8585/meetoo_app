'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// "I conti di ogni lezione" dentro l'admin. È lo stesso file che Giorgia usa dal telefono
// (public/conti/index.html, fonte in MEE TOO PILATES/MARGINI LEZIONI/conti-lezioni.html):
// qui gira dentro un iframe e riceve la sessione dell'admin via postMessage, così non chiede
// il codice. Le letture e i salvataggi passano dalle funzioni *_admin del database, che
// verificano il ruolo di chi chiama. L'accesso da admin lo controlla già il layout di /admin.
export default function ContiPage() {
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const supabase = createClient()
    const manda = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) frame.current?.contentWindow?.postMessage({ tipo: 'sessione', token }, window.location.origin)
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.tipo === 'pronto') manda()
    }
    window.addEventListener('message', onMessage)
    const { data: sub } = supabase.auth.onAuthStateChange(() => { manda() })
    return () => {
      window.removeEventListener('message', onMessage)
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="h-[calc(100dvh-3.5rem)] md:h-dvh">
      <iframe
        ref={frame}
        src="/conti/index.html?app=1"
        title="I conti di ogni lezione"
        className="block w-full h-full border-0"
      />
    </div>
  )
}
