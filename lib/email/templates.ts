// Template email transazionali Mee Too.
// HTML a tabelle con stili inline: i client di posta non caricano CSS esterni
// né supportano gli SVG del sistema <Logo> → il lockup ufficiale è reso come PNG
// @2x (public/brand/email-logo.png, generato da scripts con la stessa geometria
// di Logo.tsx: MARK_RATIO 0.499, stroke 9, gap 0.076, sfondo #f5f0e8 bakato per
// restare leggibile anche nei client in dark mode). L'immagine è servita
// dall'app deployata: gli URL devono essere ASSOLUTI e pubblici, mai localhost.

const BG = '#f5f0e8' // meetoo-bg-light
const INK = '#2c2c2c' // meetoo-accent-dark
const ACCENT = '#a8876a' // meetoo-accent-light
const SAGE = '#7d8b78' // meetoo-bg-dark

const FONT = "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"

// Base pubblica degli asset email (il PNG del lockup). Deve essere raggiungibile
// dal client di posta del destinatario → produzione, MAI l'origin locale.
const ASSETS_BASE = process.env.EMAIL_ASSETS_URL ?? 'https://meetoo-app-ntls.vercel.app'

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
            <td align="center" style="padding-bottom:28px;">
              <img src="${ASSETS_BASE}/brand/email-logo.png" width="150" alt="MEE TOO" style="${FONT} display:block; width:150px; height:auto; border:0; font-size:24px; font-weight:800; letter-spacing:0.3em; color:${INK};"></td>
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

// ── Regali (gift card) ───────────────────────────────────────────────────────
// La copertina scelta da chi regala apre l'email: e' la stessa immagine della
// pagina del regalo. Il messaggio personale NON sta qui: lo si legge aprendo
// il regalo, come una busta.

function giftCover(coverUrl: string, occasion: string | null, toName: string): string {
  const caption = occasion && occasion !== 'Nessuna'
    ? `<div style="${FONT} margin-top:12px; font-size:20px; font-weight:300; color:${INK}; text-align:center;">${escapeHtml(occasion)}, ${escapeHtml(toName)}</div>`
    : ''
  return `<img src="${ASSETS_BASE}${coverUrl}" width="416" alt="" style="display:block; width:100%; height:auto; border:0; border-radius:12px;">${caption}`
}

// Il QR da mostrare in studio. PNG servito dall'app: i client di posta non
// mostrano SVG ne' immagini incorporate. Serve l'indirizzo pubblico dell'app.
function giftQr(qrUrl: string, code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0; background-color:${BG}; border-radius:12px;">
    <tr><td align="center" style="padding:16px 20px;">
      <img src="${qrUrl}" width="150" height="150" alt="QR del regalo" style="display:block; width:150px; height:150px; border:0;">
      <div style="${FONT} margin-top:10px; font-size:18px; font-weight:700; letter-spacing:0.14em; color:${INK};">${code}</div>
      <div style="${FONT} margin-top:6px; font-size:12px; line-height:1.5; color:${SAGE}; max-width:260px;">Mostralo in studio la prima volta che vieni: lo attiviamo insieme e scegliamo il gruppo giusto.</div>
    </td></tr>
  </table>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/** A chi riceve il regalo (consegna per email). */
export function giftRecipientEmail(params: {
  toName: string
  fromName: string
  contents: string
  coverUrl: string
  occasion: string | null
  giftUrl: string
  qrUrl: string
  code: string
  studioName: string
}): { subject: string; html: string } {
  const body = `
    ${giftCover(params.coverUrl, params.occasion, params.toName)}
    <p style="${FONT} margin:28px 0 12px; font-size:15px; line-height:1.7; color:${INK};">Ciao ${escapeHtml(params.toName)},</p>
    <p style="${FONT} margin:0; font-size:15px; line-height:1.7; color:${INK};">${escapeHtml(params.fromName)} ti ha regalato ${escapeHtml(params.contents)} da ${escapeHtml(params.studioName)}. Dentro c'è anche un suo messaggio per te.</p>
    ${ctaButton(params.giftUrl, 'Apri il regalo')}
    ${giftQr(params.qrUrl, params.code)}
  `
  return { subject: `${params.fromName} ti ha fatto un regalo`, html: layout(body) }
}

/**
 * A chi ha regalato, appena pagato. Senza prezzo: chi lo consegna da se' a volte
 * inoltra tutta l'email, e il prezzo non deve arrivare a chi riceve il regalo.
 */
export function giftBuyerEmail(params: {
  fromName: string
  toName: string
  contents: string
  coverUrl: string
  occasion: string | null
  giftUrl: string
  /** testo gia' pronto: "Arriva a Marta il 25 dicembre alle 8:00 per email." */
  delivery: string
  selfDelivery: boolean
}): { subject: string; html: string } {
  const body = `
    ${giftCover(params.coverUrl, params.occasion, params.toName)}
    <p style="${FONT} margin:28px 0 12px; font-size:15px; line-height:1.7; color:${INK};">Ciao ${escapeHtml(params.fromName)},</p>
    <p style="${FONT} margin:0 0 12px; font-size:15px; line-height:1.7; color:${INK};">grazie, il tuo regalo per ${escapeHtml(params.toName)} è pronto: ${escapeHtml(params.contents)}.</p>
    <p style="${FONT} margin:0; font-size:15px; line-height:1.7; color:${INK};">${escapeHtml(params.delivery)}</p>
    ${params.selfDelivery
      ? `<p style="${FONT} margin:16px 0 0; font-size:15px; line-height:1.7; color:${INK};">Il link qui sotto è il regalo: puoi mandarlo su WhatsApp o aprirlo e stamparlo.</p>${ctaButton(params.giftUrl, 'Il regalo')}`
      : `${ctaButton(params.giftUrl, 'Guarda il regalo')}`}
  `
  return { subject: `Il tuo regalo per ${params.toName}`, html: layout(body) }
}

/** A chi ha regalato, quando il regalo viene attivato in studio. */
export function giftActivatedEmail(params: {
  fromName: string
  toName: string
  contents: string
}): { subject: string; html: string } {
  const body = `
    <p style="${FONT} margin:0 0 12px; font-size:15px; line-height:1.7; color:${INK};">Ciao ${escapeHtml(params.fromName)},</p>
    <p style="${FONT} margin:0; font-size:15px; line-height:1.7; color:${INK};">${escapeHtml(params.toName)} ha attivato in studio il tuo regalo: ${escapeHtml(params.contents)}. Da adesso le lezioni sono pronte.</p>
  `
  return { subject: `${params.toName} ha attivato il tuo regalo`, html: layout(body) }
}

/**
 * Allo studio, a ogni regalo pagato. Serve a fare subito la ricevuta quando
 * chi compra e' gia' cliente; altrimenti la si fa all'attivazione.
 */
export function giftSoldStudioEmail(params: {
  fromName: string
  toName: string
  buyerEmail: string
  contents: string
  price: string
  code: string
  delivery: string
  studioUrl: string
}): { subject: string; html: string } {
  const row = (label: string, value: string) => `
    <tr>
      <td style="${FONT} padding:6px 0; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:${ACCENT}; white-space:nowrap;">${label}</td>
      <td style="${FONT} padding:6px 0 6px 20px; font-size:15px; color:${INK}; text-align:right;">${escapeHtml(value)}</td>
    </tr>`
  const body = `
    <h1 style="${FONT} margin:0 0 20px; font-size:18px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:${INK}; text-align:center;">Regalo venduto</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BG}; border-bottom:1px solid ${BG}; padding:8px 0;">
      ${row('Regalo', params.contents)}
      ${row('Pagato', params.price)}
      ${row('Da', params.fromName)}
      ${row('Email', params.buyerEmail)}
      ${row('Per', params.toName)}
      ${row('Consegna', params.delivery)}
      ${row('Codice', params.code)}
    </table>
    <p style="${FONT} margin:20px 0 0; font-size:14px; line-height:1.7; color:${INK};">Se ${escapeHtml(params.fromName)} è già cliente dello studio, puoi fare subito la ricevuta e segnarla come fatta. Altrimenti si fa quando ${escapeHtml(params.toName)} viene ad attivare il regalo.</p>
    ${ctaButton(params.studioUrl, 'Apri il regalo')}
  `
  return { subject: `Regalo venduto: ${params.contents}, ${params.price}`, html: layout(body) }
}
