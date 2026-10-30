import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getGiftCatalog, getGiftStudio } from '@/lib/gift/data'
import { RegalaFlow } from './RegalaFlow'

export const metadata: Metadata = {
  title: 'Regala lezioni di Pilates e Yoga · Mee Too Pilates',
  description:
    'Gift card per lezioni di Pilates Reformer, matwork e yoga a Pieve di Curtarolo. Scegli la copertina, scrivi il tuo messaggio e decidi quando arriva.',
}

// prezzi e disponibilita' si leggono a ogni visita
export const dynamic = 'force-dynamic'

export default async function RegalaPage() {
  const studio = await getGiftStudio()
  if (!studio) notFound()
  const { products, covers } = await getGiftCatalog(studio.id)
  if (!products.length || !covers.length) notFound()
  return (
    <main className="min-h-svh bg-[#f5f0e8] text-[#2c2c2c]">
      <RegalaFlow products={products} covers={covers} validMonths={studio.validMonths} />
    </main>
  )
}
