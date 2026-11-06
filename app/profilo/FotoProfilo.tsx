'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Ritaglia al centro a quadrato e rimpicciolisce a 400 px prima di caricare:
// una foto del telefono pesa 3-5 MB, cosi' resta sotto i 100 KB.
async function preparaFoto(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const lato = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 400
  canvas.getContext('2d')!.drawImage(img, (img.width - lato) / 2, (img.height - lato) / 2, lato, lato, 0, 0, 400, 400)
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('foto'))), 'image/jpeg', 0.85))
}

const pulsante =
  'font-inter font-normal uppercase tracking-widest text-[11px] px-5 py-2.5 rounded-full border border-meetoo-accent-dark/30 text-meetoo-accent-dark hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors disabled:opacity-40'

export default function FotoProfilo({
  userId,
  percorso,
  link,
  iniziali,
}: {
  userId: string
  percorso: string | null
  link: string | null
  iniziali: string
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function carica(file: File) {
    setBusy(true)
    setErrore(null)
    try {
      const supabase = createClient()
      const nuovo = `${userId}/foto-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(nuovo, await preparaFoto(file), { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: nuovo }).eq('id', userId)
      if (dbErr) throw dbErr
      if (percorso && !/^https?:/.test(percorso)) await supabase.storage.from('avatars').remove([percorso])
      router.refresh()
    } catch {
      setErrore('Non è stato possibile caricare la foto. Riprova con un’altra immagine.')
    } finally {
      setBusy(false)
    }
  }

  async function togli() {
    setBusy(true)
    setErrore(null)
    const supabase = createClient()
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
    if (percorso && !/^https?:/.test(percorso)) await supabase.storage.from('avatars').remove([percorso])
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-5">
      {link ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={link} alt="La tua foto" className="w-20 h-20 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-20 h-20 rounded-full bg-meetoo-accent-light/20 flex items-center justify-center shrink-0">
          <span className="font-inter font-extrabold text-xl text-meetoo-accent-dark/50">{iniziali}</span>
        </div>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={pulsante}>
            {busy ? 'Un attimo…' : link ? 'Cambia foto' : 'Aggiungi foto'}
          </button>
          {link && (
            <button type="button" disabled={busy} onClick={togli} className={pulsante}>
              Togli
            </button>
          )}
        </div>
        <p className="font-inter font-light text-xs leading-relaxed text-meetoo-accent-dark/50 mt-2">
          Facoltativa. La vedono solo lo studio e le insegnanti, per riconoscerti a lezione.
        </p>
        {errore && <p className="font-inter font-light text-xs text-amber-700 mt-1">{errore}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void carica(f)
        }}
      />
    </div>
  )
}
