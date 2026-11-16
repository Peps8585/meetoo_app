// Sfondo della schermata di apertura: le foto dello studio a tutto schermo che
// si danno il cambio in dissolvenza lenta (scelte da Mattia il 16/11/2026).
// Solo CSS, niente JavaScript: la prima foto e' gia' a schermo al caricamento,
// le altre arrivano dopo. Il velo scuro e' uniforme su tutta l'immagine, cosi'
// logo e pulsanti restano leggibili su qualsiasi foto.
const FOTO = ['/apertura/1.jpg', '/apertura/2.jpg', '/apertura/3.jpg', '/apertura/4.jpg']

export default function SfondoApertura({ velo = 0.45 }: { velo?: number }) {
  return (
    <div aria-hidden className="mt-sfondo absolute inset-0 overflow-hidden bg-meetoo-accent-dark">
      {/* base ferma: e' quello che si vede subito e con le animazioni ridotte */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FOTO[0]} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      {FOTO.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading={i === 0 ? 'eager' : 'lazy'}
          className="mt-sfondo-foto absolute inset-0 h-full w-full object-cover"
          style={{ animationDelay: `${i * 6}s` }}
        />
      ))}
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(20, 18, 16, ${velo})` }} />
    </div>
  )
}
