import { redirect } from 'next/navigation'

// Il palinsesto dello studio e' una pagina sola, la stessa dell'agenda (16/11/2026,
// regola di Mattia: poche pagine da cui si fa tutto). Li' si sceglie il giorno,
// si aggiunge una lezione e toccando una lezione si fa tutto il resto.
export default function PalinsestoAdminPage() {
  redirect('/agenda')
}
