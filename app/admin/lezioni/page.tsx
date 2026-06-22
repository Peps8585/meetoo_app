'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type ClassType = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  color: string | null
}

type FormState = {
  name: string
  description: string
  duration_minutes: string
  color: string
}

const emptyForm: FormState = {
  name: '',
  description: '',
  duration_minutes: '60',
  color: '#a8876a',
}

const inputClass =
  'w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-sm text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/30 focus:outline-none focus:border-meetoo-accent-light transition-colors'

const labelClass =
  'block font-inter font-light text-xs uppercase tracking-widest text-meetoo-accent-dark/60 mb-1'

export default function LezioniPage() {
  const [classes, setClasses] = useState<ClassType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [studioId, setStudioId] = useState<string | null>(null)

  async function loadClasses() {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user && !studioId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('studio_id')
        .eq('id', user.id)
        .single()
      setStudioId(profile?.studio_id ?? null)
    }

    const { data, error } = await supabase
      .from('classes')
      .select('id, name, description, duration_minutes, color')
      .order('name', { ascending: true })

    if (error) setError(error.message)
    else setClasses(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadClasses()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function openEdit(cls: ClassType) {
    setEditingId(cls.id)
    setForm({
      name: cls.name,
      description: cls.description ?? '',
      duration_minutes: String(cls.duration_minutes),
      color: cls.color ?? '#a8876a',
    })
    setError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const duration = parseInt(form.duration_minutes, 10)
    if (isNaN(duration) || duration < 1) {
      setError('La durata deve essere un numero positivo.')
      setSaving(false)
      return
    }

    const supabase = createClient()
    const payload = {
      name: form.name,
      description: form.description,
      duration_minutes: duration,
      color: form.color,
    }

    if (editingId) {
      const { error } = await supabase
        .from('classes')
        .update(payload)
        .eq('id', editingId)

      if (error) setError(error.message)
      else {
        await loadClasses()
        closeForm()
      }
    } else {
      const { error } = await supabase.from('classes').insert({ ...payload, studio_id: studioId })

      if (error) setError(error.message)
      else {
        await loadClasses()
        closeForm()
      }
    }

    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa tipologia di lezione?')) return
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) setError(error.message)
    else await loadClasses()
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="font-inter font-normal uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/50 mb-1">
            Admin
          </p>
          <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl text-meetoo-accent-dark">
            Tipologie Lezioni
          </h1>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors"
          >
            + Aggiungi
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-inter text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-8 bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-8 py-8 shadow-sm">
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-sm text-meetoo-accent-dark mb-7">
            {editingId ? 'Modifica Tipologia' : 'Nuova Tipologia'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className={labelClass}>Nome *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={set('name')}
                placeholder="es. Pilates Reformer"
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Descrizione</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={set('description')}
                placeholder="Breve descrizione della tipologia…"
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Durata (minuti) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={300}
                  value={form.duration_minutes}
                  onChange={set('duration_minutes')}
                  placeholder="60"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Colore</label>
                <div className="flex items-center gap-3 py-2 border-b border-meetoo-accent-dark/30">
                  <input
                    type="color"
                    value={form.color}
                    onChange={set('color')}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-inter font-light text-sm text-meetoo-accent-dark/60">
                    {form.color}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-xs px-8 py-3 rounded-full hover:bg-meetoo-accent-light disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Salvataggio…' : editingId ? 'Aggiorna' : 'Crea'}
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

      {/* List */}
      {loading ? (
        <div className="py-16 text-center font-inter text-sm text-meetoo-accent-dark/40">
          Caricamento…
        </div>
      ) : classes.length === 0 ? (
        <div className="py-16 text-center bg-white/40 rounded-2xl border border-white/80">
          <p className="font-inter text-sm text-meetoo-accent-dark/40">
            Nessuna tipologia trovata
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-6 py-5 flex flex-col md:flex-row md:items-center gap-4 shadow-sm"
            >
              {/* Color swatch — accento orizzontale su mobile, barra verticale da md */}
              <div
                className="rounded-full shrink-0 h-1.5 w-10 md:h-10 md:w-4"
                style={{ backgroundColor: cls.color ?? '#a8876a' }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-inter font-medium text-meetoo-accent-dark md:truncate">
                  {cls.name}
                </p>
                <p className="font-inter font-light text-xs text-meetoo-accent-dark/50">
                  {cls.duration_minutes} min
                  {cls.description && (
                    <span className="ml-2 md:truncate">· {cls.description}</span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => openEdit(cls)}>
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(cls.id)}
                >
                  Elimina
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
