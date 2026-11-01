import 'server-only'
import QRCode from 'qrcode'

// Il QR del regalo porta alla pagina del regalo: a chi lo riceve mostra il
// regalo, a chi e' dello studio (entrato con l'account) anche il pulsante per
// attivarlo. Un QR solo, due usi.

const OPZIONI = { margin: 1, errorCorrectionLevel: 'M' as const, color: { dark: '#2c2c2c', light: '#fffdf9' } }

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...OPZIONI, type: 'svg' })
}

/** PNG per le email: i client di posta non mostrano SVG ne' immagini incorporate. */
export function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...OPZIONI, type: 'png', width: 480 })
}
