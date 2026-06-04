'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NoteForm({
  clientId,
  studioId,
  authorId,
}: {
  clientId: string
  studioId: string
  authorId: string
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('client_notes').insert({
      client_id: clientId,
      author_id: authorId,
      note_text: trimmed,
      studio_id: studioId,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setText('')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="block font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/60">
          Nuova nota
        </label>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Aggiungi una nota sul cliente…"
          className="w-full bg-meetoo-bg-light border-0 border-b border-meetoo-accent-dark/30 px-0 py-2 font-inter font-light text-sm text-meetoo-accent-dark placeholder:text-meetoo-accent-dark/30 focus:outline-none focus:border-meetoo-accent-light transition-colors resize-none"
        />
      </div>

      {error && (
        <p className="font-inter font-light text-xs text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving || !text.trim()}
        className="bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-meetoo-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Salvataggio…' : 'Aggiungi Nota'}
      </button>
    </form>
  )
}
