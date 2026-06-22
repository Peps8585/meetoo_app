'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { createInstructor } from './actions'

type Instructor = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
}

type FormState = {
  email: string
  first_name: string
  last_name: string
  phone: string
}

const emptyForm: FormState = {
  email: '',
  first_name: '',
  last_name: '',
  phone: '',
}

const inputClass =
  'w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-sm text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/30 focus:outline-none focus:border-meetoo-accent-light transition-colors'

const labelClass =
  'block font-inter font-light text-xs uppercase tracking-widest text-meetoo-accent-dark/60 mb-1'

export default function IstruttoriPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadInstructors() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone')
      .eq('role', 'instructor')
      .order('last_name', { ascending: true })

    if (error) setError(error.message)
    else setInstructors(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadInstructors()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function openEdit(inst: Instructor) {
    setEditingId(inst.id)
    setForm({
      email: '',
      first_name: inst.first_name ?? '',
      last_name: inst.last_name ?? '',
      phone: inst.phone ?? '',
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
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (editingId) {
      // Aggiornamento: usa il browser client (nessuna operazione auth)
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone || null,
        })
        .eq('id', editingId)

      if (error) setError(error.message)
      else { await loadInstructors(); closeForm() }
    } else {
      // Creazione: Server Action con service role key (crea auth.users + profile)
      const result = await createInstructor({
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
      })

      if (result.error) setError(result.error)
      else { await loadInstructors(); closeForm() }
    }

    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo istruttore?')) return
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) setError(error.message)
    else await loadInstructors()
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-0 mb-8">
        <div>
          <p className="font-inter font-normal uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark/50 mb-1">
            Admin
          </p>
          <h1 className="font-inter font-extrabold uppercase tracking-widest text-3xl text-meetoo-accent-dark">
            Istruttori
          </h1>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="w-full md:w-auto border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors"
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
            {editingId ? 'Modifica Istruttore' : 'Nuovo Istruttore'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email — solo in creazione */}
            {!editingId && (
              <div className="space-y-1">
                <label className={labelClass}>Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={set('email')}
                  placeholder="istruttore@example.com"
                  className={inputClass}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Nome *</label>
                <input
                  type="text"
                  required
                  value={form.first_name}
                  onChange={set('first_name')}
                  placeholder="es. Sofia"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Cognome *</label>
                <input
                  type="text"
                  required
                  value={form.last_name}
                  onChange={set('last_name')}
                  placeholder="es. Bianchi"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Telefono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="+39 333 000 0000"
                className={inputClass}
              />
            </div>

            {!editingId && (
              <p className="font-inter font-light text-xs text-meetoo-accent-dark/40">
                Verrà creato un account con password temporanea. L&apos;istruttore
                potrà impostarla tramite il link &quot;Password dimenticata&quot;.
              </p>
            )}

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
      ) : instructors.length === 0 ? (
        <div className="py-16 text-center bg-white/40 rounded-2xl border border-white/80">
          <p className="font-inter text-sm text-meetoo-accent-dark/40">
            Nessun istruttore trovato
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {instructors.map((inst) => (
            <div
              key={inst.id}
              className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-6 py-5 flex flex-col md:flex-row md:items-center gap-4 shadow-sm"
            >
              {/* Avatar + info: affiancati su mobile, su md il wrapper sparisce (md:contents) */}
              <div className="flex items-center gap-4 min-w-0 md:contents">
                {/* Avatar iniziali */}
                <div className="w-12 h-12 rounded-full bg-meetoo-accent-light/20 flex items-center justify-center shrink-0">
                  <span className="font-inter font-extrabold text-meetoo-accent-dark/50 text-sm uppercase">
                    {(inst.first_name?.[0] ?? '') + (inst.last_name?.[0] ?? '')}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-inter font-medium text-meetoo-accent-dark md:truncate">
                    {inst.first_name} {inst.last_name}
                  </p>
                  {inst.phone && (
                    <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 md:truncate">
                      {inst.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => openEdit(inst)}>
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(inst.id)}
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
