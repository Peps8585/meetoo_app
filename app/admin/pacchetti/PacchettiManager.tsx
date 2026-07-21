'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Package = {
  id: string
  name: string
  description: string | null
  price: number
  credit_amount: number
  credits: number
  validity_days: number
  is_active: boolean
}

type FormState = {
  name: string
  description: string
  price: string
  creditAmount: string
  credits: string
  validity_days: string
  is_active: boolean
}

type Feedback = { message: string; type: 'success' | 'error' }

const emptyForm: FormState = {
  name: '',
  description: '',
  price: '',
  creditAmount: '',
  credits: '',
  validity_days: '',
  is_active: true,
}

const inputClass =
  'w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-sm text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/30 focus:outline-none focus:border-meetoo-accent-light transition-colors'

const labelClass =
  'block font-inter font-light text-xs uppercase tracking-widest text-meetoo-accent-dark/60 mb-1'

function fmtEur(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function PacchettiManager({ studioId }: { studioId: string }) {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef = useRef<HTMLDivElement | null>(null)

  function showFeedback(message: string, type: Feedback['type']) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setFeedback({ message, type })
    timerRef.current = setTimeout(() => setFeedback(null), 3500)
  }

  async function load() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('packages')
      .select('id, name, description, price, credit_amount, credits, validity_days, is_active')
      .eq('studio_id', studioId)
      .order('name', { ascending: true })
    if (error) showFeedback(error.message, 'error')
    else setPackages(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Il form si apre in testa alla lista: quando compare, portalo in vista
  // (da una card in fondo alla pagina "Modifica" sembrerebbe non fare nulla).
  useEffect(() => {
    if (showForm) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showForm])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(pkg: Package) {
    setEditingId(pkg.id)
    setForm({
      name: pkg.name,
      description: pkg.description ?? '',
      price: String(pkg.price),
      creditAmount: String(pkg.credit_amount),
      credits: String(pkg.credits),
      validity_days: String(pkg.validity_days),
      is_active: pkg.is_active,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function field(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  function toggleFormActive() {
    setForm((prev) => ({ ...prev, is_active: !prev.is_active }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (parseFloat(form.creditAmount) < parseFloat(form.price)) {
      showFeedback('Il credito erogato non può essere inferiore al prezzo.', 'error')
      return
    }

    setSaving(true)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      credit_amount: parseFloat(form.creditAmount),
      credits: parseInt(form.credits, 10) || 0,
      validity_days: parseInt(form.validity_days, 10),
      is_active: form.is_active,
    }

    const supabase = createClient()

    if (editingId) {
      const { error } = await supabase.from('packages').update(payload).eq('id', editingId)
      if (error) {
        showFeedback(error.message, 'error')
      } else {
        showFeedback('Pacchetto aggiornato', 'success')
        closeForm()
        await load()
      }
    } else {
      const { error } = await supabase
        .from('packages')
        .insert({ ...payload, studio_id: studioId })
      if (error) {
        showFeedback(error.message, 'error')
      } else {
        showFeedback('Pacchetto creato', 'success')
        closeForm()
        await load()
      }
    }

    setSaving(false)
  }

  async function toggleActive(pkg: Package) {
    const supabase = createClient()
    const { error } = await supabase
      .from('packages')
      .update({ is_active: !pkg.is_active })
      .eq('id', pkg.id)
    if (error) {
      showFeedback(error.message, 'error')
    } else {
      showFeedback(
        pkg.is_active ? 'Pacchetto disattivato' : 'Pacchetto attivato',
        'success'
      )
      await load()
    }
  }

  const bonusPrice = parseFloat(form.price)
  const bonusCredit = parseFloat(form.creditAmount)
  const bonusValid = !Number.isNaN(bonusPrice) && !Number.isNaN(bonusCredit)
  const bonusValue = bonusCredit - bonusPrice
  const bonusPct = bonusPrice > 0 ? Math.round((bonusValue / bonusPrice) * 1000) / 10 : 0

  return (
    <div>
      {/* ── Feedback banner ── */}
      {feedback && (
        <div
          role="status"
          className={[
            'mb-6 rounded-xl px-4 py-3 font-inter font-light text-sm',
            feedback.type === 'success'
              ? 'bg-meetoo-bg-dark/15 text-meetoo-bg-dark border border-meetoo-bg-dark/20'
              : 'bg-red-50 border border-red-200 text-red-700',
          ].join(' ')}
        >
          {feedback.message}
        </div>
      )}

      {/* ── Top bar ── */}
      {!showForm && (
        <div className="flex justify-end mb-6">
          <button
            onClick={openCreate}
            className="border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors"
          >
            + Nuovo Pacchetto
          </button>
        </div>
      )}

      {/* ── Form (create / edit) ── */}
      {showForm && (
        <div
          ref={formRef}
          className="mb-8 bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl px-6 sm:px-8 py-8 shadow-sm scroll-mt-6"
        >
          <h2 className="font-inter font-extrabold uppercase tracking-widest text-sm text-meetoo-accent-dark mb-7">
            {editingId ? 'Modifica Pacchetto' : 'Nuovo Pacchetto'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome */}
            <div className="space-y-1">
              <label className={labelClass}>Nome *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={field('name')}
                placeholder="es. Pacchetto 10 lezioni"
                className={inputClass}
              />
            </div>

            {/* Descrizione */}
            <div className="space-y-1">
              <label className={labelClass}>Descrizione</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={field('description')}
                placeholder="Descrizione opzionale…"
                className={inputClass + ' resize-none'}
              />
            </div>

            {/* Prezzo · Credito erogato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Prezzo (€) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={field('price')}
                  placeholder="45.00"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Credito erogato (€) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.creditAmount}
                  onChange={field('creditAmount')}
                  placeholder="50.00"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Bonus calcolato live (read-only) */}
            <p className="font-inter font-light text-xs uppercase tracking-widest text-meetoo-accent-dark/60">
              {bonusValid ? `Bonus: €${bonusValue.toFixed(2)} (+${bonusPct}%)` : 'Bonus: —'}
            </p>

            {/* N. lezioni (riferimento) · Scadenza tranche */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>N. lezioni (riferimento, non usato dal sistema)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.credits}
                  onChange={field('credits')}
                  placeholder="10"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Scadenza tranche (giorni) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={form.validity_days}
                  onChange={field('validity_days')}
                  placeholder="90"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Attivo toggle */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                role="switch"
                aria-checked={form.is_active}
                onClick={toggleFormActive}
                className={[
                  'relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 focus:outline-none',
                  form.is_active ? 'bg-meetoo-bg-dark' : 'bg-meetoo-accent-dark/20',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                    form.is_active ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
              <span
                onClick={toggleFormActive}
                className="font-inter font-light text-sm text-meetoo-accent-dark cursor-pointer select-none"
              >
                {form.is_active ? 'Pacchetto attivo' : 'Pacchetto inattivo'}
              </span>
            </div>

            {/* Submit row */}
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

      {/* ── Package list ── */}
      {loading ? (
        <div className="py-16 text-center font-inter text-sm text-meetoo-accent-dark/40">
          Caricamento…
        </div>
      ) : packages.length === 0 ? (
        <div className="py-16 text-center bg-white/40 rounded-2xl border border-white/80">
          <p className="font-inter text-sm text-meetoo-accent-dark/40">
            Nessun pacchetto creato
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={[
                'bg-white/60 backdrop-blur-sm border rounded-2xl px-6 py-5 shadow-sm flex flex-col gap-4 transition-opacity',
                pkg.is_active
                  ? 'border-white/80'
                  : 'border-meetoo-accent-dark/10 opacity-55',
              ].join(' ')}
            >
              {/* Name + status badge */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-inter font-semibold text-base text-meetoo-accent-dark leading-snug">
                  {pkg.name}
                </h3>
                <span
                  className={[
                    'shrink-0 font-inter font-normal text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full',
                    pkg.is_active
                      ? 'bg-meetoo-bg-dark/15 text-meetoo-bg-dark'
                      : 'bg-meetoo-accent-dark/10 text-meetoo-accent-dark/40',
                  ].join(' ')}
                >
                  {pkg.is_active ? 'Attivo' : 'Inattivo'}
                </span>
              </div>

              {/* Description */}
              {pkg.description && (
                <p className="font-inter font-light text-xs text-meetoo-accent-dark/50 leading-relaxed -mt-2">
                  {pkg.description}
                </p>
              )}

              {/* Metrics */}
              <div className="flex items-center gap-5">
                <p className="font-inter font-extrabold text-lg text-meetoo-accent-dark leading-none">
                  {fmtEur(pkg.price)}
                </p>
                <div className="w-px h-7 bg-meetoo-accent-dark/10 shrink-0" />
                <div>
                  <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                    Credits
                  </p>
                  <p className="font-inter font-semibold text-sm text-meetoo-accent-dark">
                    {pkg.credits}
                  </p>
                </div>
                <div className="w-px h-7 bg-meetoo-accent-dark/10 shrink-0" />
                <div>
                  <p className="font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/40">
                    Validità
                  </p>
                  <p className="font-inter font-semibold text-sm text-meetoo-accent-dark">
                    {pkg.validity_days} gg
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-meetoo-accent-dark/5">
                <button
                  onClick={() => openEdit(pkg)}
                  className="flex-1 border border-meetoo-accent-dark/30 text-meetoo-accent-dark font-inter font-normal uppercase tracking-widest text-[11px] py-2.5 rounded-full hover:bg-meetoo-accent-dark hover:text-meetoo-bg-light transition-colors"
                >
                  Modifica
                </button>
                <button
                  onClick={() => toggleActive(pkg)}
                  className="flex-1 border border-meetoo-accent-dark/20 text-meetoo-accent-dark/55 font-inter font-normal uppercase tracking-widest text-[11px] py-2.5 rounded-full hover:border-meetoo-accent-dark/40 hover:text-meetoo-accent-dark transition-colors"
                >
                  {pkg.is_active ? 'Disattiva' : 'Attiva'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
