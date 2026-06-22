'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type ClassType = {
  id: string
  name: string
  duration_minutes: number
  color: string | null
}

type Instructor = {
  id: string
  first_name: string | null
  last_name: string | null
}

type Schedule = {
  id: string
  class_id: string
  instructor_id: string | null
  starts_at: string
  ends_at: string
  max_spots: number
  location: string | null
  classes: { name: string; color: string | null; duration_minutes: number } | null
  profiles: { first_name: string | null; last_name: string | null } | null
}

type FormState = {
  class_id: string
  instructor_id: string
  date: string
  time: string
  max_spots: string
  location: string
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

const emptyForm: FormState = {
  class_id: '',
  instructor_id: '',
  date: '',
  time: '09:00',
  max_spots: '10',
  location: '',
}

const inputClass =
  'w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-sm text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/30 focus:outline-none focus:border-meetoo-accent-light transition-colors'
const selectClass =
  'w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-sm text-meetoo-accent-dark focus:outline-none focus:border-meetoo-accent-light transition-colors'
const labelClass =
  'block font-inter font-light text-xs uppercase tracking-widest text-meetoo-accent-dark/60 mb-1'

export default function PalinsestoAdminPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [classes, setClasses] = useState<ClassType[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [studioId, setStudioId] = useState<string | null>(null)

  useEffect(() => {
    async function loadMeta() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, classesRes, instructorsRes] = await Promise.all([
        supabase.from('profiles').select('studio_id').eq('id', user.id).single(),
        supabase.from('classes').select('id, name, duration_minutes, color').order('name'),
        supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('role', 'instructor')
          .order('last_name'),
      ])

      if (profileRes.data?.studio_id) setStudioId(profileRes.data.studio_id)
      setClasses(classesRes.data ?? [])
      setInstructors(instructorsRes.data ?? [])
    }
    loadMeta()
  }, [])

  useEffect(() => {
    if (!studioId) return
    void loadSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, studioId])

  async function loadSchedules() {
    if (!studioId) return
    setLoading(true)
    const supabase = createClient()
    const weekEnd = addDays(weekStart, 7)

    const { data, error: fetchError } = await supabase
      .from('schedules')
      .select(
        `id, class_id, instructor_id, starts_at, ends_at, max_spots, location,
         classes:class_id(name, color, duration_minutes),
         profiles:instructor_id(first_name, last_name)`
      )
      .eq('studio_id', studioId)
      .gte('starts_at', weekStart.toISOString())
      .lt('starts_at', weekEnd.toISOString())
      .order('starts_at')

    if (fetchError) setError(fetchError.message)
    else setSchedules((data as unknown as Schedule[]) ?? [])
    setLoading(false)
  }

  const byDay = useMemo(() => {
    const groups: Schedule[][] = Array.from({ length: 7 }, () => [])
    for (const s of schedules) {
      const day = new Date(s.starts_at).getDay()
      const idx = day === 0 ? 6 : day - 1
      groups[idx].push(s)
    }
    return groups
  }, [schedules])

  const endsAtDisplay = useMemo(() => {
    if (!form.class_id || !form.date || !form.time) return ''
    const cls = classes.find((c) => c.id === form.class_id)
    if (!cls) return ''
    const starts = new Date(`${form.date}T${form.time}`)
    return new Date(starts.getTime() + cls.duration_minutes * 60000).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [form.class_id, form.date, form.time, classes])

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function openForm() {
    setForm({ ...emptyForm, date: toLocalDate(new Date()) })
    setError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studioId) { setError('Studio non trovato'); return }
    const cls = classes.find((c) => c.id === form.class_id)
    if (!cls) { setError('Seleziona una tipologia di lezione'); return }
    setSaving(true)
    setError(null)

    const starts = new Date(`${form.date}T${form.time}`)
    const ends = new Date(starts.getTime() + cls.duration_minutes * 60000)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('schedules').insert({
      studio_id: studioId,
      class_id: form.class_id,
      instructor_id: form.instructor_id || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      max_spots: parseInt(form.max_spots, 10),
      location: form.location || null,
    })

    if (insertError) setError(insertError.message)
    else { await loadSchedules(); closeForm() }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa lezione dal palinsesto?')) return
    setError(null)
    const supabase = createClient()
    const { error: deleteError } = await supabase.from('schedules').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadSchedules()
  }

  const weekLabel = `${addDays(weekStart, 0).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-0 mb-8">
        <div>
          <p className="font-inter font-normal uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/50 mb-1">
            Admin
          </p>
          <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl text-meetoo-accent-dark">
            Palinsesto
          </h1>
        </div>
        {!showForm && (
          <button
            onClick={openForm}
            className="w-full md:w-auto border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors"
          >
            + Aggiungi lezione
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-inter text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-8 bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-8 py-8 shadow-sm">
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-sm text-meetoo-accent-dark mb-7">
            Nuova Lezione
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Tipologia *</label>
                <select required value={form.class_id} onChange={set('class_id')} className={selectClass}>
                  <option value="">Seleziona…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.duration_minutes} min)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Istruttore</label>
                <select value={form.instructor_id} onChange={set('instructor_id')} className={selectClass}>
                  <option value="">Nessuno</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.first_name} {i.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Data *</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={set('date')}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Ora inizio *</label>
                <input
                  type="time"
                  required
                  value={form.time}
                  onChange={set('time')}
                  className={inputClass}
                />
              </div>
            </div>

            {endsAtDisplay && (
              <p className="font-inter font-light text-xs text-meetoo-accent-dark/40">
                Fine prevista:{' '}
                <span className="font-normal text-meetoo-accent-dark/60">{endsAtDisplay}</span>
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Posti massimi *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={200}
                  value={form.max_spots}
                  onChange={set('max_spots')}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={set('location')}
                  placeholder="es. Sala 1"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-xs px-8 py-3 rounded-full hover:bg-meetoo-accent-light disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Salvataggio…' : 'Aggiungi'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-8 py-3 rounded-full hover:bg-meetoo-accent-dark/5 transition-colors"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setWeekStart((prev) => addDays(prev, -7))}
          className="font-inter text-xs text-meetoo-accent-dark/60 hover:text-meetoo-accent-dark transition-colors px-3 py-2"
        >
          ← Prec.
        </button>
        <span className="font-inter font-normal uppercase tracking-widest text-xs text-meetoo-accent-dark">
          {weekLabel}
        </span>
        <button
          onClick={() => setWeekStart((prev) => addDays(prev, 7))}
          className="font-inter text-xs text-meetoo-accent-dark/60 hover:text-meetoo-accent-dark transition-colors px-3 py-2"
        >
          Succ. →
        </button>
      </div>

      {/* Weekly grid */}
      {loading ? (
        <div className="py-16 text-center font-inter text-sm text-meetoo-accent-dark/40">
          Caricamento…
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="grid grid-cols-7 gap-2 min-w-[700px]">
            {/* Day headers */}
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(weekStart, i)
              const isToday = day.toDateString() === new Date().toDateString()
              return (
                <div
                  key={i}
                  className={`text-center pb-2 border-b ${
                    isToday ? 'border-meetoo-accent-light' : 'border-meetoo-accent-dark/10'
                  }`}
                >
                  <p
                    className={`font-inter font-light text-xs uppercase tracking-widest ${
                      isToday ? 'text-meetoo-accent-light' : 'text-meetoo-accent-dark/40'
                    }`}
                  >
                    {DAYS_IT[i]}
                  </p>
                  <p
                    className={`font-inter text-sm mt-0.5 ${
                      isToday
                        ? 'font-extrabold text-meetoo-accent-light'
                        : 'font-medium text-meetoo-accent-dark'
                    }`}
                  >
                    {day.getDate()}
                  </p>
                </div>
              )
            })}

            {/* Schedule cards */}
            {byDay.map((daySchedules, i) => (
              <div key={i} className="space-y-1.5 pt-2 min-h-[80px]">
                {daySchedules.map((s) => (
                  <div
                    key={s.id}
                    className="relative group rounded-xl px-2.5 py-2 text-white"
                    style={{ backgroundColor: s.classes?.color ?? '#a8876a' }}
                  >
                    <p className="font-inter font-semibold text-xs truncate leading-tight">
                      {s.classes?.name ?? '—'}
                    </p>
                    <p className="font-inter text-[10px] opacity-90 mt-0.5">
                      {formatTime(s.starts_at)} – {formatTime(s.ends_at)}
                    </p>
                    {s.profiles && (
                      <p className="font-inter text-[10px] opacity-75 truncate">
                        {s.profiles.first_name} {s.profiles.last_name}
                      </p>
                    )}
                    <p className="font-inter text-[10px] opacity-70">{s.max_spots} posti</p>
                    {s.location && (
                      <p className="font-inter text-[10px] opacity-60 truncate">{s.location}</p>
                    )}
                    <button
                      onClick={() => handleDelete(s.id)}
                      aria-label="Elimina lezione"
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/0 hover:bg-black/25 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
