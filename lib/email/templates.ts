// Template email transazionali Mee Too.
// HTML a tabelle con stili inline: i client di posta non caricano CSS esterni
// né supportano gli SVG del sistema <Logo> → il brand è reso col wordmark
// tipografico (stesse scelte della UI: uppercase, tracking largo, palette a 4 toni).

const BG = '#f5f0e8' // meetoo-bg-light
const INK = '#2c2c2c' // meetoo-accent-dark
const ACCENT = '#a8876a' // meetoo-accent-light
const SAGE = '#7d8b78' // meetoo-bg-dark

const FONT = "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"

function layout(bodyHtml: string): string {
  return `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background-color:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="${FONT} font-size:26px; font-weight:800; letter-spacing:0.3em; color:${INK};">MEE&nbsp;TOO</div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff; border-radius:16px; padding:36px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <div style="${FONT} font-size:11px; letter-spacing:0.12em; color:${SAGE};">MEE TOO &middot; PILATES &middot; YOGA &middot; MINDFULNESS</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
    <tr>
      <td style="background-color:${INK}; border-radius:999px;">
        <a href="${href}" style="${FONT} display:inline-block; padding:14px 36px; font-size:13px; letter-spacing:0.18em; text-transform:uppercase; color:${BG}; text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

// I server (Vercel, locale) possono girare in UTC: la timezone va resa
// esplicita, le lezioni sono sempre in ora italiana.
function fmtDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Rome',
    }),
    time: d.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Rome',
    }),
  }
}

export function welcomeEmail(params: {
  firstName: string | null
  appUrl: string
}): { subject: string; html: string } {
  const saluto = params.firstName ? `Ciao ${params.firstName},` : 'Ciao,'
  const body = `
    <h1 style="${FONT} margin:0 0 20px; font-size:18px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:${INK}; text-align:center;">Benvenuta in Mee Too</h1>
    <p style="${FONT} margin:0 0 16px; font-size:15px; line-height:1.7; color:${INK};">${saluto}</p>
    <p style="${FONT} margin:0 0 16px; font-size:15px; line-height:1.7; color:${INK};">il tuo account è stato creato. Dal tuo spazio personale puoi consultare il palinsesto, prenotare le lezioni e seguire il tuo credito.</p>
    <p style="${FONT} margin:0; font-size:15px; line-height:1.7; color:${INK};">Ti aspettiamo in studio.</p>
    ${ctaButton(params.appUrl, 'Entra')}
  `
  return { subject: 'Benvenuta in Mee Too', html: layout(body) }
}

export function bookingConfirmationEmail(params: {
  firstName: string | null
  className: string
  startsAt: string
  instructorName: string | null
  location: string | null
  price: number | null
  appUrl: string
}): { subject: string; html: string } {
  const saluto = params.firstName ? `Ciao ${params.firstName},` : 'Ciao,'
  const { date, time } = fmtDateTime(params.startsAt)

  const row = (label: string, value: string) => `
    <tr>
      <td style="${FONT} padding:6px 0; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:${ACCENT}; white-space:nowrap;">${label}</td>
      <td style="${FONT} padding:6px 0 6px 20px; font-size:15px; color:${INK}; text-align:right;">${value}</td>
    </tr>`

  const rows = [
    row('Lezione', params.className),
    row('Giorno', date),
    row('Ora', time),
    params.instructorName ? row('Con', params.instructorName) : '',
    params.location ? row('Dove', params.location) : '',
    params.price != null && params.price > 0 ? row('Addebito', fmtEuro(params.price)) : '',
  ].join('')

  const body = `
    <h1 style="${FONT} margin:0 0 20px; font-size:18px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:${INK}; text-align:center;">Prenotazione confermata</h1>
    <p style="${FONT} margin:0 0 20px; font-size:15px; line-height:1.7; color:${INK};">${saluto}</p>
    <p style="${FONT} margin:0 0 20px; font-size:15px; line-height:1.7; color:${INK};">il tuo posto è riservato:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BG}; border-bottom:1px solid ${BG}; padding:8px 0;">${rows}</table>
    <p style="${FONT} margin:20px 0 0; font-size:13px; line-height:1.7; color:${SAGE};">Se non puoi venire, puoi disdire dall'app fino a 24 ore prima con riaccredito completo.</p>
    ${ctaButton(`${params.appUrl}/palinsesto`, 'Vedi il palinsesto')}
  `
  return {
    subject: `Prenotazione confermata — ${params.className}, ${date} ore ${time}`,
    html: layout(body),
  }
}
