// Date e testi dei regali. Niente import server: lo usano anche i componenti client.

const ROMA = 'Europe/Rome'

/** "2026-12-25" + "08:00" ora italiana → istante UTC, ora legale compresa. */
export function romeLocalToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const comeSeUtc = Date.UTC(y, m - 1, d, hh, mm)
  const scarto = (t: number) => {
    const parti = new Intl.DateTimeFormat('en-US', {
      timeZone: ROMA, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(t))
    const v = (k: string) => Number(parti.find((p) => p.type === k)!.value)
    return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute')) - t
  }
  // due passaggi: il secondo corregge i casi a cavallo del cambio d'ora
  let t = comeSeUtc - scarto(comeSeUtc)
  t = comeSeUtc - scarto(t)
  return new Date(t)
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + months)
  return r
}

/** "25 dicembre 2026" */
export function fmtDay(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ROMA })
}

/** "25 dicembre alle 8:00" */
export function fmtDayTime(iso: string | Date): string {
  const d = new Date(iso)
  const giorno = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: ROMA })
  const ora = d.toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit', timeZone: ROMA })
  return `${giorno} alle ${ora}`
}

export function fmtEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
}

/** "5 lezioni di Pilates Reformer & Chair" */
export function giftContents(g: { lessons: number; discipline: string }): string {
  return `${g.lessons === 1 ? '1 lezione' : `${g.lessons} lezioni`} di ${g.discipline}`
}

export const OCCASIONI = ['Nessuna', 'Per te', 'Buon compleanno', 'Buon Natale', 'Grazie', 'Auguri'] as const
