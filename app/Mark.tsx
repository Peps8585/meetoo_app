// Mark canonico Mee Too — due anelli, single source of truth.
// Geometria = "l'anello della O" del wordmark reso monolineare, nello spazio
// viewBox del wordmark (scala condivisa → abilita il lockstep mark/wordmark nel
// blocco <Logo>). Interasse 42.586 = raggio esterno → gli anelli si compenetrano
// (interlock, la stessa invariante del mark già shippato nella favicon).
//
// r NON è costante: è DERIVATO dallo stroke — r = 42.586 - strokeWidth/2 — così
// il diametro esterno (85.172) e l'interlock restano invarianti al variare dello
// spessore (assottigliare lo stroke gonfia r, il bordo esterno non si muove).
//
// Default CANONICO = 9 (filo fine), scelto a occhio in calibrazione. Supera
// DELIBERATAMENTE la parità 18.234 ancorata all'anello della "O" in S14: quella è
// corretta come geometria ma otticamente troppo pesante e "appiccicata". La prop
// strokeWidth resta esposta come primitiva utile ad altri contesti (es. favicon).
//
// fill="none" è CRITICO: senza, i <circle> diventano dischi pieni (regressione
// nota). stroke="currentColor" eredita il token text-meetoo-accent-dark dal
// consumer. I due anelli sono elementi separati con hook di classe stabili così
// che l'animazione indipendente (keyframes già in globals.css) possa agganciarli
// in un blocco successivo — qui NESSUNA animazione, solo gli hook.
//
// Nota convenzione: WordmarkMeeToo.tsx usa `export default`; qui si usa un export
// NOMINATO `Mark` come da richiesta (il futuro <Logo> compone i due).

type MarkProps = {
  /** Applicata all'<svg>: colore, taglia, opt-in animazione dal consumer. */
  className?: string
  /**
   * true (default) → svg decorativo (aria-hidden). Usa quando il nome "Mee Too"
   * è già dato altrove (es. h1 sr-only della pagina).
   * false → svg con role="img" + aria-label="Mee Too". Usa SOLO quando il logo
   * è l'unico portatore del nome accessibile (es. header senza h1).
   */
  decorative?: boolean
  /**
   * Peso-fianco degli anelli in unità viewBox. Default 9 = valore CANONICO (filo
   * fine, scelto a occhio), che supera la parità geometrica 18.234 con l'anello
   * della "O". La prop consente override per contesti (es. favicon) che richiedono
   * un peso diverso; diametro esterno e interlock restano invarianti (r derivato).
   */
  strokeWidth?: number
}

export function Mark({
  className,
  decorative = true,
  strokeWidth = 9,
}: MarkProps) {
  // r derivato: bordo esterno (cx + r + strokeWidth/2 = 85.172) e interlock fissi.
  const r = 42.586 - strokeWidth / 2
  return (
    <svg
      className={className}
      viewBox="0 0 127.758 85.172"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      xmlns="http://www.w3.org/2000/svg"
      {...(decorative
        ? { 'aria-hidden': true, focusable: false }
        : { role: 'img', 'aria-label': 'Mee Too' })}
    >
      <circle className="mt-mark-ring-left" cx="42.586" cy="42.586" r={r} />
      <circle className="mt-mark-ring-right" cx="85.172" cy="42.586" r={r} />
    </svg>
  )
}
