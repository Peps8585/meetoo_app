// Sfondo della schermata di apertura: le foto dello studio a tutto schermo che
// scorrono come un carosello, una dopo l'altra verso sinistra (scelta di Mattia
// del 16/11/2026: le dissolvenze lente non gli piacevano).
// Solo CSS, niente JavaScript: la prima foto e' gia' a schermo al caricamento.
// In fondo alla fila la prima foto e' ripetuta, cosi' il giro ricomincia senza
// salti. Il velo scuro e' uniforme su tutta l'immagine (0.45, scelto da Mattia),
// cosi' logo e pulsanti restano leggibili su qualsiasi foto.
const FOTO = ['/apertura/1.jpg', '/apertura/2.jpg', '/apertura/3.jpg', '/apertura/4.jpg']

export default function SfondoApertura() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-meetoo-accent-dark">
      <div className="mt-sfondo-fila flex h-full w-[500%]">
        {[...FOTO, FOTO[0]].map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            fetchPriority={i === 0 ? 'high' : undefined}
            className="h-full w-1/5 shrink-0 object-cover"
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-[rgba(20,18,16,0.45)]" />
    </div>
  )
}
