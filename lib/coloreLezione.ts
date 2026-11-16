import type { CSSProperties } from 'react'

// La card di una lezione prende lo sfondo della tonalita' data al tipo di
// lezione (classes.color, che lo studio sceglie in Lezioni). Scelta di Mattia
// del 16/11/2026: le card tutte bianche con la lineetta si confondevano.
// Si usa dappertutto dove compare una lezione, cosi' il colore e' uno solo.
export function stileLezione(colore: string | null | undefined): CSSProperties {
  const h = /^#?([0-9a-f]{6})$/i.exec(colore ?? '')?.[1] ?? 'a8876a'
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')
  return { backgroundColor: `rgba(${c}, 0.22)`, borderColor: `rgba(${c}, 0.35)` }
}
