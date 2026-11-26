'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { statoCertificato, dataLunga } from '@/lib/certificato'

// Riquadro "Certificato medico" nel profilo della cliente (Mattia e Giorgia, 26/11/2026).
// Foto o PDF, con la data di scadenza e il consenso: e' un dato sulla salute.

async function prepara(file: File): Promise<{ blob: Blob; ext: string; tipo: string }> {
  if (file.type === 'application/pdf') return { blob: file, ext: 'pdf', tipo: 'application/pdf' }
  // le foto del telefono pesano molto: lato lungo a 1800 px, leggibile e leggero
  const img = await createImageBitmap(file)
  const k = Math.min(1, 1800 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * k)
  canvas.height = Math.round(img.height * k)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('foto'))), 'image/jpeg', 0.85)
  )
  return { blob, ext: 'jpg', tipo: 'image/jpeg' }
}

const pulsante =
  'font-inter font-normal uppercase tracking-widest text-[11px] px-5 py-2.5 rounded-full border border-meetoo-accent-dark/30 text-meetoo-accent-dark hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors disabled:opacity-40'

export default function CertificatoMedico({
  userId,
  percorso,
  scadenza,
  link,
}: {
  userId: string
  percorso: string | null
  scadenza: string | null
  link: string | null
}) {
  const router = useRouter()
  const [apri, setApri] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState('')
  const [consenso, setConsenso] = useState(false)
  const [busy, setBusy] = useState(false)
  const [nota, setNota] = useState<{ ok: boolean; testo: string } | null>(null)
  const stato = statoCertificato(percorso, scadenza)

  async function carica() {
    if (!file) return setNota({ ok: false, testo: 'Scegli la foto o il PDF del certificato.' })
    if (!data) return setNota({ ok: false, testo: 'Scrivi la data di scadenza che trovi sul certificato.' })
    if (!consenso) return setNota({ ok: false, testo: 'Per caricarlo serve il tuo consenso qui sopra.' })
    setBusy(true)
    setNota(null)
    try {
      const supabase = createClient()
      const { blob, ext, tipo } = await prepara(file)
      const nuovo = `${userId}/certificato-${Date.now()}.${ext}`
      const { error: e1 } = await supabase.storage.from('certificati').upload(nuovo, blob, { contentType: tipo })
      if (e1) throw e1
      const ora = new Date().toISOString()
      const { error: e2 } = await supabase
        .from('profiles')
        .update({
          certificato_path: nuovo,
          certificato_scadenza: data,
          certificato_caricato_at: ora,
          certificato_consenso_at: ora,
        })
        .eq('id', userId)
      if (e2) throw e2
      if (percorso) await supabase.storage.from('certificati').remove([percorso])
      setApri(false)
      setFile(null)
      setData('')
      setConsenso(false)
      setNota({ ok: true, testo: 'Certificato caricato, grazie!' })
      router.refresh()
    } catch {
      setNota({ ok: false, testo: 'Non siamo riusciti a caricarlo, riprova tra poco.' })
    }
    setBusy(false)
  }

  const etichetta: Record<typeof stato, { testo: string; classe: string }> = {
    mancante: { testo: 'Non ancora caricato', classe: 'text-meetoo-accent-dark/50' },
    valido: { testo: scadenza ? `Valido fino al ${dataLunga(scadenza)}` : 'Caricato', classe: 'text-meetoo-bg-dark' },
    in_scadenza: { testo: `Scade il ${scadenza ? dataLunga(scadenza) : ''}: ricordati di rinnovarlo`, classe: 'text-amber-700' },
    scaduto: { testo: `Scaduto il ${scadenza ? dataLunga(scadenza) : ''}`, classe: 'text-red-600' },
  }

  return (
    <section className="mb-8">
      <h2 className="font-inter font-extrabold uppercase tracking-widest text-[11px] text-meetoo-accent-dark mb-4">
        Certificato medico
      </h2>
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80 px-6 py-5">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-meetoo-accent-dark/50 shrink-0" />
          <p className={`font-inter text-sm ${etichetta[stato].classe}`}>{etichetta[stato].testo}</p>
        </div>

        {!apri && (
          <div className="flex flex-wrap gap-2 mt-4">
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className={pulsante}>
                Apri
              </a>
            )}
            <button type="button" className={pulsante} onClick={() => setApri(true)}>
              {percorso ? 'Sostituisci' : 'Carica il certificato'}
            </button>
          </div>
        )}

        {apri && (
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/50">
                Foto o PDF del certificato
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full font-inter text-sm text-meetoo-accent-dark file:mr-3 file:rounded-full file:border-0 file:bg-meetoo-accent-dark file:px-4 file:py-2 file:text-[11px] file:uppercase file:tracking-widest file:text-white"
              />
            </label>
            <label className="block">
              <span className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/50">
                Data di scadenza
              </span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 block w-full bg-transparent border-0 border-b border-meetoo-accent-dark/30 py-2 font-inter text-sm text-meetoo-accent-dark focus:outline-none"
              />
            </label>
            <label className="flex gap-3 items-start">
              <input type="checkbox" checked={consenso} onChange={(e) => setConsenso(e.target.checked)} className="mt-1" />
              <span className="font-inter font-light text-xs leading-relaxed text-meetoo-accent-dark/70">
                Acconsento a conservare il mio certificato medico nell&apos;app. Lo vedete solo io e lo studio, serve a
                verificare che io possa fare attività fisica e viene cancellato dopo la scadenza.
              </span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={carica}
                className="font-inter font-normal uppercase tracking-widest text-[11px] px-5 py-2.5 rounded-full bg-meetoo-accent-dark text-white disabled:opacity-40"
              >
                {busy ? 'Caricamento…' : 'Carica'}
              </button>
              <button type="button" className={pulsante} disabled={busy} onClick={() => setApri(false)}>
                Annulla
              </button>
            </div>
          </div>
        )}
        {nota && (
          <p className={`font-inter text-xs mt-3 ${nota.ok ? 'text-meetoo-bg-dark' : 'text-red-600'}`}>{nota.testo}</p>
        )}
      </div>
    </section>
  )
}
