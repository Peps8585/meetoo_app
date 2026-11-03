import 'server-only'

/**
 * Avvisi su Telegram allo studio (bot "Mee Too Notifiche"), come quelli di LUMA
 * per i corsi venduti. Destinatari in TELEGRAM_CHAT_IDS, separati da virgola.
 * Best effort: un avviso che non parte non blocca mai la vendita.
 */
export async function avvisaTelegram(testo: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chat = (process.env.TELEGRAM_CHAT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!token || !chat.length) {
    console.warn('[telegram] bot non configurato, avviso saltato')
    return
  }
  await Promise.all(
    chat.map(async (id) => {
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: id, text: testo, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(8000),
        })
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string }
        if (!j.ok) console.error('[telegram]', id, j.description ?? r.status)
      } catch (e) {
        console.error('[telegram]', id, (e as Error).message)
      }
    }),
  )
}
