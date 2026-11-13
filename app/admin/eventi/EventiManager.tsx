'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { aRoma, eventoPassato, fotoEvento, giornoEvento, oreEvento, type Evento } from '@/lib/eventi'
import { eliminaEvento, mandaAvviso, salvaEvento } from './actions'

// Una foto del telefono pesa 3-5 MB: prima di caricarla si porta a 1600 px di
// larghezza, cosi' resta leggera anche per chi apre l'app con poca rete.
async function preparaFoto(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scala = Math.min(1, 1600 / img.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scala)
  canvas.height = Math.round(img.height * scala)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('foto'))), 'image/jpeg', 0.85))
}

const scheda = 'rounded-2xl border border-white/80 bg-white/60 px-5 py-4 shadow-sm'
const etichetta = 'mb-1.5 block font-inter text-[10px] font-normal uppercase tracking-[0.2em] text-meetoo-accent-dark/50'
const campo =
  'w-full rounded-xl border border-meetoo-accent-dark/15 bg-white/80 px-3.5 py-2.5 font-inter text-[15px] text-meetoo-accent-dark outline-none focus:border-meetoo-accent-light'
const scuro =
  'w-full rounded-full bg-meetoo-accent-dark py-3.5 font-inter text-xs font-normal uppercase tracking-widest text-meetoo-bg-light transition-colors hover:bg-meetoo-bg-dark disabled:opacity-40'
const chiaro =
  'rounded-full border border-meetoo-accent-dark/30 px-4 py-2 font-inter text-[11px] font-normal uppercase tracking-widest text-meetoo-accent-dark transition-colors hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light disabled:opacity-40'
const scelta = (attiva: boolean) =>
  `rounded-full px-4 py-2 font-inter text-sm ${attiva ? 'bg-meetoo-accent-dark text-meetoo-bg-light' : 'border border-meetoo-accent-dark/25 text-meetoo-accent-dark'}`

type Bozza = {
  id?: string
  titolo: string
  descrizione: string
  giorno: string
  inizio: string
  fine: string
  foto: string | null
  pubblicato: boolean
  avvisa: boolean
  giaAvvisato: boolean
}

const vuota: Bozza = {
  titolo: '',
  descrizione: '',
  giorno: '',
  inizio: '',
  fine: '',
  foto: null,
  pubblicato: true,
  avvisa: true,
  giaAvvisato: false,
}

function daEvento(e: Evento): Bozza {
  const i = aRoma(e.inizio)
  return {
    id: e.id,
    titolo: e.titolo,
    descrizione: e.descrizione,
    giorno: i.giorno,
    inizio: i.ora,
    fine: e.fine ? aRoma(e.fine).ora : '',
    foto: e.foto,
    pubblicato: e.pubblicato,
    avvisa: false,
    giaAvvisato: !!e.avviso_at,
  }
}

export default function EventiManager({
  eventi,
  studioId,
  whatsapp,
  adesso,
}: {
  eventi: Evento[]
  studioId: string
  whatsapp: boolean
  adesso: string
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const [caricaFoto, setCaricaFoto] = useState(false)
  const [nota, setNota] = useState<{ ok: boolean; testo: string } | null>(null)
  const [inCorso, parti] = useTransition()

  const ora = new Date(adesso).getTime()
  const inArrivo = eventi.filter((e) => !eventoPassato(e, ora)).reverse()
  const passati = eventi.filter((e) => eventoPassato(e, ora))
  const canali = whatsapp ? 'notifica, email e WhatsApp' : 'notifica o email'

  const cambia = (v: Partial<Bozza>) => setBozza((b) => (b ? { ...b, ...v } : b))

  async function scegliFoto(file: File) {
    setCaricaFoto(true)
    setNota(null)
    try {
      const percorso = `${studioId}/${Date.now()}.jpg`
      const { error } = await createClient()
        .storage.from('eventi')
        .upload(percorso, await preparaFoto(file), { contentType: 'image/jpeg' })
      if (error) throw error
      cambia({ foto: percorso })
    } catch {
      setNota({ ok: false, testo: 'Non è stato possibile caricare la foto. Riprova con un’altra immagine.' })
    } finally {
      setCaricaFoto(false)
    }
  }

  function salva() {
    if (!bozza) return
    setNota(null)
    parti(async () => {
      const r = await salvaEvento({
        id: bozza.id,
        titolo: bozza.titolo,
        descrizione: bozza.descrizione,
        giorno: bozza.giorno,
        inizio: bozza.inizio,
        fine: bozza.fine,
        foto: bozza.foto,
        pubblicato: bozza.pubblicato,
        avvisa: bozza.avvisa && !bozza.giaAvvisato,
      })
      setNota({ ok: r.ok, testo: r.messaggio ?? (r.ok ? 'Salvato.' : 'Non è andata a buon fine. Riprova.') })
      if (r.ok) {
        setBozza(null)
        router.refresh()
      }
    })
  }

  function avvisa(e: Evento) {
    if (!window.confirm(`Mando l’avviso di «${e.titolo}» a tutte le clienti (${canali})? Parte una volta sola.`)) return
    setNota(null)
    parti(async () => {
      const r = await mandaAvviso(e.id)
      setNota({ ok: r.ok, testo: r.messaggio ?? '' })
      router.refresh()
    })
  }

  function elimina(e: Evento) {
    if (!window.confirm(`Tolgo «${e.titolo}» dalla bacheca? Non si può annullare.`)) return
    setNota(null)
    parti(async () => {
      const r = await eliminaEvento(e.id)
      setNota(r.ok ? { ok: true, testo: 'Evento tolto dalla bacheca.' } : { ok: false, testo: r.messaggio ?? '' })
      router.refresh()
    })
  }

  const avviso = nota && (
    <p
      role="status"
      className={`mb-4 rounded-xl px-4 py-3 font-inter text-sm ${nota.ok ? 'bg-meetoo-bg-dark/15 text-meetoo-accent-dark' : 'bg-amber-100 text-amber-900'}`}
    >
      {nota.testo}
    </p>
  )

  // ── Modulo: nuovo post o modifica ──────────────────────────────────────────
  if (bozza) {
    const foto = fotoEvento(bozza.foto)
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-inter text-xl font-extrabold uppercase tracking-wide text-meetoo-accent-dark">
            {bozza.id ? 'Modifica post' : 'Nuovo post'}
          </h2>
          <button type="button" onClick={() => setBozza(null)} className="font-inter text-[11px] uppercase tracking-widest text-meetoo-accent-dark/50">
            Annulla
          </button>
        </div>
        {avviso}
        <div className="space-y-3">
          <div className={scheda}>
            <span className={etichetta}>Foto</span>
            {foto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="mb-3 aspect-[2/1] w-full rounded-xl object-cover" />
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={caricaFoto} onClick={() => input.current?.click()} className={chiaro}>
                {caricaFoto ? 'Un attimo…' : foto ? 'Cambia foto' : 'Scegli una foto'}
              </button>
              {foto && (
                <button type="button" onClick={() => cambia({ foto: null })} className={chiaro}>
                  Togli
                </button>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void scegliFoto(f)
              }}
            />
          </div>

          <div className={scheda}>
            <label className={etichetta} htmlFor="ev-titolo">Titolo</label>
            <input id="ev-titolo" className={campo} maxLength={120} value={bozza.titolo} onChange={(e) => cambia({ titolo: e.target.value })} />
          </div>

          <div className={scheda}>
            <span className={etichetta}>Quando</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input aria-label="Giorno" type="date" className={campo} value={bozza.giorno} onChange={(e) => cambia({ giorno: e.target.value })} />
              </div>
              <div>
                <label className={etichetta} htmlFor="ev-inizio">Inizio</label>
                <input id="ev-inizio" type="time" className={campo} value={bozza.inizio} onChange={(e) => cambia({ inizio: e.target.value })} />
              </div>
              <div>
                <label className={etichetta} htmlFor="ev-fine">Fine (se c’è)</label>
                <input id="ev-fine" type="time" className={campo} value={bozza.fine} onChange={(e) => cambia({ fine: e.target.value })} />
              </div>
            </div>
          </div>

          <div className={scheda}>
            <label className={etichetta} htmlFor="ev-descrizione">Descrizione</label>
            <textarea
              id="ev-descrizione"
              rows={5}
              maxLength={2000}
              className={campo}
              value={bozza.descrizione}
              onChange={(e) => cambia({ descrizione: e.target.value })}
            />
          </div>

          <div className={scheda}>
            <span className={etichetta}>Dove compare</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={scelta(bozza.pubblicato)} onClick={() => cambia({ pubblicato: true })}>
                In bacheca
              </button>
              <button type="button" className={scelta(!bozza.pubblicato)} onClick={() => cambia({ pubblicato: false })}>
                Bozza, non visibile
              </button>
            </div>
          </div>

          {bozza.pubblicato && !bozza.giaAvvisato && (
            <div className={scheda}>
              <span className={etichetta}>Avvisare anche le clienti?</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={scelta(bozza.avvisa)} onClick={() => cambia({ avvisa: true })}>
                  Sì, a tutte
                </button>
                <button type="button" className={scelta(!bozza.avvisa)} onClick={() => cambia({ avvisa: false })}>
                  No, solo in bacheca
                </button>
              </div>
              <p className="mt-2 font-inter text-xs font-light leading-relaxed text-meetoo-accent-dark/55">
                {bozza.avvisa
                  ? `Quando tocchi Pubblica parte l’avviso con il link dell’evento: ${canali}. Parte una volta sola.`
                  : 'Lo puoi mandare anche dopo, dall’elenco degli eventi.'}
              </p>
            </div>
          )}

          <button type="button" disabled={inCorso || caricaFoto} onClick={salva} className={scuro}>
            {inCorso ? 'Un attimo…' : bozza.pubblicato ? (bozza.id ? 'Salva' : 'Pubblica') : 'Salva la bozza'}
          </button>
        </div>
      </div>
    )
  }

  // ── Elenco ────────────────────────────────────────────────────────────────
  const riga = (e: Evento, passato: boolean) => {
    const foto = fotoEvento(e.foto)
    return (
      <li key={e.id} className={`${scheda} ${passato ? 'opacity-60' : ''}`}>
        <div className="flex gap-4">
          {foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-inter text-[10px] uppercase tracking-[0.2em] text-meetoo-accent-dark/50">
              {giornoEvento(e.inizio)} · {oreEvento(e)}
            </p>
            <p className="font-inter text-base font-bold text-meetoo-accent-dark">{e.titolo}</p>
            <p className="mt-0.5 font-inter text-xs font-light text-meetoo-accent-dark/55">
              {!e.pubblicato
                ? 'Bozza, le clienti non la vedono'
                : e.avviso_at
                  ? `Avviso partito${e.avviso_esito ? `: notifica a ${e.avviso_esito.notifica}, email a ${e.avviso_esito.email}${e.avviso_esito.whatsapp ? `, WhatsApp a ${e.avviso_esito.whatsapp}` : ''}${e.avviso_esito.nessuno ? `, non raggiunte ${e.avviso_esito.nessuno}` : ''}` : ''}`
                  : 'In bacheca, avviso non mandato'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={inCorso} onClick={() => { setNota(null); setBozza(daEvento(e)) }} className={chiaro}>
            Modifica
          </button>
          {!passato && e.pubblicato && !e.avviso_at && (
            <button type="button" disabled={inCorso} onClick={() => avvisa(e)} className={chiaro}>
              Avvisa tutte
            </button>
          )}
          {e.pubblicato && (
            <a href={`/evento/${e.id}`} target="_blank" rel="noopener noreferrer" className={chiaro}>
              Apri la pagina
            </a>
          )}
          <button type="button" disabled={inCorso} onClick={() => elimina(e)} className={chiaro}>
            Elimina
          </button>
        </div>
      </li>
    )
  }

  return (
    <div>
      {avviso}
      <button type="button" onClick={() => { setNota(null); setBozza(vuota) }} className={`${scuro} mb-6`}>
        Nuovo post
      </button>

      <h2 className="mb-3 font-inter text-[11px] font-extrabold uppercase tracking-widest text-meetoo-accent-dark">In arrivo</h2>
      {inArrivo.length === 0 ? (
        <p className={`${scheda} font-inter text-sm font-light text-meetoo-accent-dark/60`}>Nessun evento in programma.</p>
      ) : (
        <ul className="space-y-3">{inArrivo.map((e) => riga(e, false))}</ul>
      )}

      {passati.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer font-inter text-[11px] font-extrabold uppercase tracking-widest text-meetoo-accent-dark/60">
            Passati ({passati.length})
          </summary>
          <ul className="mt-3 space-y-3">{passati.map((e) => riga(e, true))}</ul>
        </details>
      )}
    </div>
  )
}
