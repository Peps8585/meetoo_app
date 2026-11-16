import type { CSSProperties } from 'react'

// Come si colora la card di una lezione nel palinsesto, a partire dal colore
// dato al tipo di lezione (classes.color). Tre prove da far giudicare a Mattia
// (16/11/2026); quella scelta resta, le altre si tolgono.
export type ProvaColore = 'a' | 'b' | 'c' | null

const rgb = (hex: string) => {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? 'a8876a'
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')
}

export function stileLezione(colore: string | null | undefined, prova: ProvaColore): CSSProperties | undefined {
  const c = rgb(colore ?? '#a8876a')
  // a: sfondo della tonalita' della lezione
  if (prova === 'a') return { backgroundColor: `rgba(${c}, 0.22)`, borderColor: `rgba(${c}, 0.35)` }
  // b: contorno del colore della lezione, sfondo bianco
  if (prova === 'b') return { backgroundColor: 'rgba(255,255,255,0.75)', borderColor: `rgb(${c})`, borderWidth: 2 }
  // c: fascia piena a sinistra e sfondo appena tinto
  if (prova === 'c') return { backgroundColor: `rgba(${c}, 0.10)`, borderColor: `rgba(${c}, 0.25)`, borderLeft: `8px solid rgb(${c})` }
  return undefined
}
