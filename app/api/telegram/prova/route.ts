import { getAdminStaff } from '@/lib/gift/staff'
import { avvisaTelegram } from '@/lib/telegram'

/** Messaggio di prova del bot allo studio. Solo admin collegati. */
export async function GET() {
  const staff = await getAdminStaff()
  if (!staff) return new Response('non autorizzato', { status: 401 })
  await avvisaTelegram(`👋 Prova del bot Mee Too Notifiche, mandata da ${staff.name}.\n\nDa adesso qui arriva un messaggio a ogni gift card venduta.`)
  const destinatari = (process.env.TELEGRAM_CHAT_IDS ?? '').split(',').filter(Boolean).length
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;background:#f5f0e8;color:#2c2c2c;padding:40px 20px;text-align:center"><h2>Messaggio di prova inviato</h2><p>Destinatari: ${destinatari}. Controllate Telegram, chat "Mee Too Notifiche".</p></body>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}
