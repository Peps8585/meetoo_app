'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Copy, Ban, Trash2, LockOpen, X } from 'lucide-react'
import { annullaLezione, bloccaIscrizioni, duplicaLezione, eliminaLezione, modificaLezione } from './actions'

// Il menu "..." della pagina lezione (solo admin), sul modello di App Palestre.
// Le scelte che non si possono annullare chiedono conferma dentro la pagina,
// mai con una finestra del browser.

type Pannello = null | 'menu' | 'modifica' | 'duplica' | 'annulla' | 'elimina'

const input =
  'w-full bg-meetoo-bg-light border border-meetoo-accent-dark/20 rounded-xl px-3 py-2.5 font-inter font-light text-sm text-meetoo-accent-dark'
const etichetta = 'block font-inter font-light text-[10px] uppercase tracking-widest text-meetoo-accent-dark/50 mb-1'
const scuro =
  'w-full rounded-full bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-xs py-3 disabled:opacity-40'
const rosso = 'w-full rounded-full bg-red-500 text-white font-inter font-normal uppercase tracking-widest text-xs py-3 disabled:opacity-40'

// data e ora in ora italiana <-> valori dei campi del modulo
function partiRoma(iso: string) {
  const f = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso))
  const [data, ora] = f.split(' ')
  return { data, ora }
}
// "2026-11-12" + "08:30" (ora italiana) -> ISO; l'offset di Roma si ricava per quel giorno
function isoRoma(data: string, ora: string): string {
  const prova = new Date(`${data}T${ora}:00Z`)
  const romaComeUtc = new Date(prova.toLocaleString('en-US', { timeZone: 'Europe/Rome' }) + ' UTC')
  return new Date(prova.getTime() - (romaComeUtc.getTime() - prova.getTime())).toISOString()
}

export default function AzioniLezione({
  scheduleId,
  inizio,
  fine,
  insegnanteId,
  posti,
  note,
  bloccate,
  annullata,
  conIscritte,
  insegnanti,
}: {
  scheduleId: string
  inizio: string
  fine: string
  insegnanteId: string | null
  posti: number
  note: string | null
  bloccate: boolean
  annullata: boolean
  conIscritte: boolean
  insegnanti: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [pannello, setPannello] = useState<Pannello>(null)
  const [busy, setBusy] = useState(false)
  const [esito, setEsito] = useState<{ testo: string; ok: boolean } | null>(null)

  const a = partiRoma(inizio)
  const b = partiRoma(fine)
  const [mData, setMData] = useState(a.data)
  const [mInizio, setMInizio] = useState(a.ora)
  const [mFine, setMFine] = useState(b.ora)
  const [mIns, setMIns] = useState(insegnanteId ?? '')
  const [mPosti, setMPosti] = useState(posti)
  const [mNote, setMNote] = useState(note ?? '')
  const settimanaDopo = partiRoma(new Date(new Date(inizio).getTime() + 7 * 864e5).toISOString())
  const [dData, setDData] = useState(settimanaDopo.data)
  const [dOra, setDOra] = useState(a.ora)

  async function esegui(fn: () => Promise<{ ok: boolean; messaggio?: string; id?: string }>, okTesto: string, vai?: (id?: string) => string) {
    setBusy(true)
    setEsito(null)
    const r = await fn()
    setBusy(false)
    if (!r.ok) return setEsito({ testo: r.messaggio ?? 'Riprova.', ok: false })
    setPannello(null)
    setEsito({ testo: r.messaggio ?? okTesto, ok: true })
    if (vai) router.push(vai(r.id))
    else router.refresh()
  }

  const voce = 'w-full flex items-center gap-3 px-5 py-3.5 font-inter text-[15px] text-meetoo-accent-dark hover:bg-meetoo-accent-dark/5 text-left'

  return (
    <>
      <button
        type="button"
        onClick={() => setPannello(pannello ? null : 'menu')}
        aria-label="Azioni sulla lezione"
        className="w-10 h-10 rounded-full border border-meetoo-accent-dark/20 flex items-center justify-center text-meetoo-accent-dark/70 hover:bg-white/60"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {esito && (
        <p role="status" className={`basis-full font-inter font-light text-xs mt-2 ${esito.ok ? 'text-meetoo-bg-dark' : 'text-amber-700'}`}>
          {esito.testo}
        </p>
      )}

      {pannello && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => !busy && setPannello(null)}>
          <div
            className="w-full sm:max-w-md bg-meetoo-bg-light rounded-t-3xl sm:rounded-3xl pb-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end px-3 pt-3">
              <button type="button" aria-label="Chiudi" onClick={() => setPannello(null)} className="w-9 h-9 flex items-center justify-center text-meetoo-accent-dark/50">
                <X className="w-5 h-5" />
              </button>
            </div>

            {pannello === 'menu' && (
              <div className="pb-2">
                {!annullata && (
                  <>
                    <button className={voce} onClick={() => setPannello('modifica')}><Pencil className="w-5 h-5" />Modifica</button>
                    <button className={voce} onClick={() => setPannello('duplica')}><Copy className="w-5 h-5" />Duplica su un altro giorno</button>
                    <button
                      className={voce}
                      disabled={busy}
                      onClick={() => esegui(() => bloccaIscrizioni(scheduleId, !bloccate), bloccate ? 'Iscrizioni riaperte.' : 'Iscrizioni bloccate: chi è dentro resta.')}
                    >
                      {bloccate ? <LockOpen className="w-5 h-5" /> : <Ban className="w-5 h-5 text-amber-600" />}
                      {bloccate ? 'Riapri le iscrizioni' : 'Blocca iscrizioni'}
                    </button>
                    <div className="h-px bg-meetoo-accent-dark/10 mx-5 my-1" />
                  </>
                )}
                {conIscritte ? (
                  !annullata && (
                    <button className={`${voce} text-red-600`} onClick={() => setPannello('annulla')}><Trash2 className="w-5 h-5" />Annulla lezione</button>
                  )
                ) : (
                  <button className={`${voce} text-red-600`} onClick={() => setPannello('elimina')}><Trash2 className="w-5 h-5" />Elimina lezione</button>
                )}
              </div>
            )}

            {pannello === 'modifica' && (
              <div className="px-5 space-y-4">
                <h2 className="font-inter font-semibold text-lg text-meetoo-accent-dark">Modifica lezione</h2>
                <div><label className={etichetta}>Giorno</label><input type="date" className={input} value={mData} onChange={(e) => setMData(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={etichetta}>Inizio</label><input type="time" className={input} value={mInizio} onChange={(e) => setMInizio(e.target.value)} /></div>
                  <div><label className={etichetta}>Fine</label><input type="time" className={input} value={mFine} onChange={(e) => setMFine(e.target.value)} /></div>
                </div>
                <div>
                  <label className={etichetta}>Insegnante</label>
                  <select className={input} value={mIns} onChange={(e) => setMIns(e.target.value)}>
                    <option value="">Da assegnare</option>
                    {insegnanti.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                  </select>
                </div>
                <div><label className={etichetta}>Posti disponibili</label><input type="number" min={1} max={30} className={input} value={mPosti} onChange={(e) => setMPosti(Number(e.target.value))} /></div>
                <div><label className={etichetta}>Note (es. livello base)</label><input type="text" className={input} value={mNote} onChange={(e) => setMNote(e.target.value)} /></div>
                {(mData !== a.data || mInizio !== a.ora) && conIscritte && (
                  <p className="font-inter font-light text-xs text-amber-700">Cambia l’orario: chi è iscritta riceve un avviso.</p>
                )}
                {esito && !esito.ok && <p className="font-inter font-light text-xs text-amber-700">{esito.testo}</p>}
                <button
                  className={scuro}
                  disabled={busy}
                  onClick={() =>
                    esegui(
                      () =>
                        modificaLezione(scheduleId, {
                          inizio: isoRoma(mData, mInizio),
                          fine: isoRoma(mData, mFine),
                          insegnante: mIns || null,
                          posti: mPosti,
                          note: mNote,
                        }),
                      'Lezione aggiornata.'
                    )
                  }
                >
                  {busy ? 'Un attimo…' : 'Salva'}
                </button>
              </div>
            )}

            {pannello === 'duplica' && (
              <div className="px-5 space-y-4">
                <h2 className="font-inter font-semibold text-lg text-meetoo-accent-dark">Duplica su un altro giorno</h2>
                <p className="font-inter font-light text-sm text-meetoo-accent-dark/60">Stessa lezione, insegnante, posti e note. Senza iscritte.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={etichetta}>Giorno</label><input type="date" className={input} value={dData} onChange={(e) => setDData(e.target.value)} /></div>
                  <div><label className={etichetta}>Ora</label><input type="time" className={input} value={dOra} onChange={(e) => setDOra(e.target.value)} /></div>
                </div>
                {esito && !esito.ok && <p className="font-inter font-light text-xs text-amber-700">{esito.testo}</p>}
                <button
                  className={scuro}
                  disabled={busy}
                  onClick={() => esegui(() => duplicaLezione(scheduleId, isoRoma(dData, dOra)), 'Lezione duplicata.', (id) => `/agenda/lezione/${id}`)}
                >
                  {busy ? 'Un attimo…' : 'Duplica'}
                </button>
              </div>
            )}

            {pannello === 'annulla' && (
              <div className="px-5 space-y-4">
                <h2 className="font-inter font-semibold text-lg text-meetoo-accent-dark">Annullare la lezione?</h2>
                <p className="font-inter font-light text-sm leading-relaxed text-meetoo-accent-dark/70">
                  Chi era iscritta riceve indietro la lezione intera sul pacchetto e un avviso. Chi aveva il posto fisso lo tiene per le altre settimane. Non si torna indietro.
                </p>
                {esito && !esito.ok && <p className="font-inter font-light text-xs text-amber-700">{esito.testo}</p>}
                <button className={rosso} disabled={busy} onClick={() => esegui(() => annullaLezione(scheduleId), 'Lezione annullata.')}>
                  {busy ? 'Un attimo…' : 'Sì, annulla la lezione'}
                </button>
              </div>
            )}

            {pannello === 'elimina' && (
              <div className="px-5 space-y-4">
                <h2 className="font-inter font-semibold text-lg text-meetoo-accent-dark">Eliminare la lezione?</h2>
                <p className="font-inter font-light text-sm leading-relaxed text-meetoo-accent-dark/70">
                  Non ha iscritte: sparisce dal palinsesto.
                </p>
                {esito && !esito.ok && <p className="font-inter font-light text-xs text-amber-700">{esito.testo}</p>}
                <button className={rosso} disabled={busy} onClick={() => esegui(() => eliminaLezione(scheduleId), 'Lezione eliminata.', () => `/agenda?giorno=${a.data}`)}>
                  {busy ? 'Un attimo…' : 'Sì, elimina'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
