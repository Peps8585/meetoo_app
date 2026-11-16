'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Aggiungere una lezione dal palinsesto dello studio (solo admin: lo garantiscono
// le regole del database). Parte dal giorno che si sta guardando; i posti
// proposti sono quelli dell'ultima lezione dello stesso tipo, cosi' di solito
// basta scegliere tipo e ora.

type Tipo = { id: string; name: string; duration_minutes: number }
type Insegnante = { id: string; first_name: string | null; last_name: string | null }

const etichetta = 'mb-1.5 block font-inter text-[10px] font-normal uppercase tracking-[0.2em] text-meetoo-accent-dark/70'
const campo =
  'w-full rounded-xl border border-meetoo-accent-dark/15 bg-white/80 px-3.5 py-2.5 font-inter text-[15px] text-meetoo-accent-dark outline-none focus:border-meetoo-accent-light'

export default function NuovaLezione({
  studioId,
  giorno,
  onChiudi,
  onFatta,
}: {
  studioId: string
  giorno: string // yyyy-mm-dd
  onChiudi: () => void
  onFatta: (giorno: string) => void
}) {
  const [tipi, setTipi] = useState<Tipo[]>([])
  const [insegnanti, setInsegnanti] = useState<Insegnante[]>([])
  const [tipo, setTipo] = useState('')
  const [insegnante, setInsegnante] = useState('')
  const [data, setData] = useState(giorno)
  const [ora, setOra] = useState('09:00')
  const [posti, setPosti] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    async function carica() {
      const supabase = createClient()
      const [t, i] = await Promise.all([
        supabase.from('classes').select('id, name, duration_minutes').eq('studio_id', studioId).order('name'),
        supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('studio_id', studioId)
          .eq('role', 'instructor')
          .neq('is_active', false)
          .order('first_name'),
      ])
      setTipi((t.data ?? []) as Tipo[])
      setInsegnanti((i.data ?? []) as Insegnante[])
    }
    void carica()
  }, [studioId])

  // scelto il tipo, si propongono i posti dell'ultima lezione di quel tipo
  async function scegliTipo(id: string) {
    setTipo(id)
    if (!id) return
    const { data: ultima } = await createClient()
      .from('schedules')
      .select('max_spots')
      .eq('class_id', id)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ultima?.max_spots) setPosti(String(ultima.max_spots))
  }

  const fine = useMemo(() => {
    const t = tipi.find((x) => x.id === tipo)
    if (!t || !data || !ora) return null
    const f = new Date(new Date(`${data}T${ora}`).getTime() + t.duration_minutes * 60000)
    return f.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }, [tipi, tipo, data, ora])

  async function salva() {
    const t = tipi.find((x) => x.id === tipo)
    const n = parseInt(posti, 10)
    if (!t) return setErrore('Scegli il tipo di lezione.')
    if (!data || !ora) return setErrore('Indica il giorno e l’ora di inizio.')
    if (!n || n < 1) return setErrore('Indica quanti posti ha la lezione.')
    setSalvo(true)
    setErrore(null)
    const inizio = new Date(`${data}T${ora}`)
    const { error } = await createClient()
      .from('schedules')
      .insert({
        studio_id: studioId,
        class_id: t.id,
        instructor_id: insegnante || null,
        starts_at: inizio.toISOString(),
        ends_at: new Date(inizio.getTime() + t.duration_minutes * 60000).toISOString(),
        max_spots: n,
      })
    setSalvo(false)
    if (error) return setErrore('Non è stato possibile aggiungere la lezione. Riprova.')
    onFatta(data)
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/80 bg-white/60 px-5 py-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-inter text-sm font-extrabold uppercase tracking-widest text-meetoo-accent-dark">Nuova lezione</h2>
        <button type="button" onClick={onChiudi} className="font-inter text-[11px] uppercase tracking-widest text-meetoo-accent-dark/70">
          Annulla
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className={etichetta} htmlFor="nl-tipo">Tipo di lezione</label>
          <select id="nl-tipo" className={campo} value={tipo} onChange={(e) => void scegliTipo(e.target.value)}>
            <option value="">Scegli</option>
            {tipi.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.duration_minutes} min)
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={etichetta} htmlFor="nl-data">Giorno</label>
            <input id="nl-data" type="date" className={campo} value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className={etichetta} htmlFor="nl-ora">Inizio</label>
            <input id="nl-ora" type="time" className={campo} value={ora} onChange={(e) => setOra(e.target.value)} />
          </div>
        </div>
        {fine && <p className="font-inter text-xs font-light text-meetoo-accent-dark/70">Finisce alle {fine}.</p>}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={etichetta} htmlFor="nl-insegnante">Insegnante</label>
            <select id="nl-insegnante" className={campo} value={insegnante} onChange={(e) => setInsegnante(e.target.value)}>
              <option value="">Da assegnare</option>
              {insegnanti.map((i) => (
                <option key={i.id} value={i.id}>
                  {[i.first_name, i.last_name].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={etichetta} htmlFor="nl-posti">Posti</label>
            <input id="nl-posti" type="number" inputMode="numeric" min={1} max={200} className={campo} value={posti} onChange={(e) => setPosti(e.target.value)} />
          </div>
        </div>
        {errore && <p className="rounded-xl bg-amber-100 px-4 py-2.5 font-inter text-sm text-amber-900">{errore}</p>}
        <button
          type="button"
          disabled={salvo}
          onClick={() => void salva()}
          className="w-full rounded-full bg-meetoo-accent-dark py-3.5 font-inter text-xs uppercase tracking-widest text-meetoo-bg-light transition-colors hover:bg-meetoo-bg-dark disabled:opacity-40"
        >
          {salvo ? 'Un attimo…' : 'Aggiungi al palinsesto'}
        </button>
      </div>
    </div>
  )
}
