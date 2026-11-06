// Posti fissi: giorno e ora sono sempre in ora italiana, anche se il server
// gira in UTC. Il database li confronta con extract(isodow) e ::time a
// Europe/Rome, qui si calcolano allo stesso modo.

export const GIORNI = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

const ISODOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

export function romeSlot(iso: string): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { weekday: ISODOW[get('weekday')] ?? 0, time: `${get('hour')}:${get('minute')}` }
}

// "08:00:00" o "08:00" -> "8.00", come nel palinsesto appeso in sala
export function oraBreve(time: string): string {
  const [h, m] = time.split(':')
  return `${Number(h)}.${m}`
}

export function etichettaSlot(weekday: number, time: string, className: string): string {
  return `${GIORNI[weekday]} ${oraBreve(time)} · ${className}`
}
