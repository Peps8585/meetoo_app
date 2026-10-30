// La gift card disegnata: copertina scelta, marchio, occasione e contenuto.
// Senza hook: la usano sia le pagine server sia il percorso di acquisto.

type Props = {
  coverUrl: string
  occasion?: string | null
  toName?: string
  title: string
  discipline: string
  /** piccola: niente testi, solo foto e marchio (riepilogo) */
  mini?: boolean
  className?: string
}

export function GiftCardVisual({ coverUrl, occasion, toName, title, discipline, mini, className = '' }: Props) {
  const occasione = occasion && occasion !== 'Nessuna' ? `${occasion}${toName ? `, ${toName}` : ''}` : null
  return (
    <div
      className={`relative aspect-[1.58] overflow-hidden bg-[#e6dccd] ${mini ? 'rounded-md' : 'rounded-[14px] shadow-[0_10px_30px_rgb(44_44_44/0.22)]'} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- foto locale gia' ridotta, serve identica anche nelle email */}
      <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.28)_0%,rgb(0_0_0/0)_32%,rgb(0_0_0/0)_52%,rgb(0_0_0/0.5)_100%)]" />
      <div className={`absolute font-bold leading-none tracking-[0.08em] text-white ${mini ? 'left-[7px] top-[6px] text-[7px]' : 'left-4 top-3.5 text-[13px]'}`}>
        MEE TOO
        <small className={`mt-[3px] block font-medium tracking-[0.5em] ${mini ? 'text-[4px]' : 'text-[6.5px]'}`}>PILATES</small>
      </div>
      {!mini && (
        <>
          <div className="absolute right-4 top-3.5 text-right text-[11px] font-medium leading-snug text-white/90">
            {title}
            <br />
            {discipline}
          </div>
          {occasione && (
            <div className="absolute bottom-3.5 left-4 right-4 text-[21px] font-light tracking-[-0.02em] text-white">{occasione}</div>
          )}
        </>
      )}
    </div>
  )
}
