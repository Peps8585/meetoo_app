import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen bg-meetoo-bg-light px-6 py-24">
      <div className="text-center flex flex-col items-center gap-8">
        <span className="font-inter font-extrabold uppercase tracking-[0.3em] text-xs text-meetoo-accent-dark">
          Studio Pilates &amp; Yoga
        </span>

        {/*
          Glyph widths in Inter uppercase (advance units, approx):
          M=88 E=64 → MEE = 216u + 3×tracking
          P=68 I=28 L=60 A=72 T=62 E=64 S=65 → PILATES = 419u + 7×tracking
          With tracking-widest (0.1em): effective ratio ≈ 2.15
          MEE/TOO: 6rem → PILATES: 6 / 2.15 ≈ 2.8rem
          MEE/TOO: 8rem → PILATES: 8 / 2.15 ≈ 3.7rem
        */}
        <div className="flex flex-col items-center font-inter font-extrabold uppercase text-meetoo-accent-dark">
          <span className="text-8xl md:text-9xl tracking-widest leading-none">MEE</span>
          <span className="text-8xl md:text-9xl tracking-widest leading-none">TOO</span>
          <span className="text-[2.8rem] md:text-[3.7rem] tracking-widest leading-none">PILATES</span>
        </div>

        <p className="font-inter font-light text-lg md:text-xl text-[#2c2c2c] max-w-md leading-relaxed">
          Ritrova il tuo equilibrio. Corpo, respiro e consapevolezza in ogni
          lezione.
        </p>

        <Link
          href="/registrati"
          className="mt-2 inline-block bg-meetoo-accent-dark text-meetoo-bg-light font-inter font-normal uppercase tracking-widest text-sm px-12 py-4 rounded-full transition-colors duration-300 hover:bg-meetoo-accent-light"
        >
          Scopri le lezioni
        </Link>
      </div>
    </main>
  );
}
