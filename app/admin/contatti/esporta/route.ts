import { getAdminStaff } from '@/lib/gift/staff'
import { elencoContatti } from '@/lib/contatti-elenco'

/** I contatti in un file che Excel apre in italiano (punto e virgola, UTF-8 con BOM). */
export async function GET(request: Request) {
  const staff = await getAdminStaff()
  if (!staff) return new Response('non autorizzato', { status: 401 })
  const u = new URL(request.url)
  const contatti = await elencoContatti(staff.studioId, {
    etichetta: u.searchParams.get('etichetta') || undefined,
    consenso: u.searchParams.get('consenso') === '1',
    q: u.searchParams.get('q') || undefined,
  })
  const cella = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const righe = [
    ['Nome', 'Email', 'Telefono', 'Etichette', 'Vuole le novità', 'Consenso dal', 'Contatto dal', 'Ultima attività'],
    ...contatti.map((c) => [
      c.nome,
      c.email,
      c.telefono,
      c.etichette.join(', '),
      c.consenso_novita ? 'sì' : 'no',
      c.consenso_at ? c.consenso_at.slice(0, 10) : '',
      c.created_at.slice(0, 10),
      c.contatti_eventi[0]?.descrizione ?? '',
    ]),
  ]
  const csv = '﻿' + righe.map((r) => r.map(cella).join(';')).join('\r\n')
  const oggi = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="contatti-mee-too-${oggi}.csv"`,
    },
  })
}
