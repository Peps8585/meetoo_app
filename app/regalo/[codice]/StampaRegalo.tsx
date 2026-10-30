'use client'

export function StampaRegalo() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-3 block w-full rounded-full border border-[#2c2c2c]/20 py-[15px] text-center text-[15px] font-medium transition-colors hover:bg-[#2c2c2c] hover:text-[#f5f0e8] print:hidden"
    >
      Stampa
    </button>
  )
}
