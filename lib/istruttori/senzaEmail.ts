// Istruttori senza email (Mattia 24/11/2026): lo studio li inserisce con solo nome e
// cognome, cosi' si possono assegnare le lezioni e le clienti vedono chi le tiene.
// L'account esiste (serve al palinsesto) ma con un indirizzo segnaposto su un
// sottodominio nostro che non riceve posta: non si usa per entrare e non gli si
// scrive mai. Quando l'istruttore da' la sua email, lo studio la sostituisce.
export const DOMINIO_SENZA_EMAIL = 'senza-email.meetoopilates.com'

export function emailSegnaposto(): string {
  return `istruttore-${crypto.randomUUID()}@${DOMINIO_SENZA_EMAIL}`
}

export function isSenzaEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith('@' + DOMINIO_SENZA_EMAIL)
}
