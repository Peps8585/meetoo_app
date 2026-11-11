// Testi degli avvisi dei posti fissi e della lista d'attesa. Gli stessi testi
// vanno nella notifica sul telefono e nell'email di riserva: si scrivono qui
// una volta sola. Ore sempre in ora italiana, nel formato del palinsesto (8.00).

function parti(iso: string) {
  const d = new Date(iso)
  const giorno = d.toLocaleDateString('it-IT', { weekday: 'long', timeZone: 'Europe/Rome' })
  const data = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })
  const ora = d
    .toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Rome' })
    .replace(':', '.')
  return { giorno, data, ora }
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Scadenza per cancellare senza che venga scalata: 24 ore prima della lezione.
function scadenza(startsAt: string) {
  return parti(new Date(new Date(startsAt).getTime() - 24 * 60 * 60 * 1000).toISOString())
}

export type Avviso = { titolo: string; testo: string }

/** Alla cliente fissa, prima della scadenza: "ci sei?" */
export function testoPromemoria(className: string, startsAt: string): Avviso {
  const l = parti(startsAt)
  const s = scadenza(startsAt)
  return {
    titolo: `${maiuscola(l.giorno)} alle ${l.ora} ci sei?`,
    testo: `${className}, il tuo posto fisso. Se questa volta non vieni avvisa entro ${s.giorno} alle ${s.ora}: il posto passa a chi è in lista e la lezione non ti viene scalata.`,
  }
}

/** Fino a quando vale l'offerta: "alle 10.30" se e' oggi, "domani alle 8.15" se no. */
export function entroLe(iso: string, adesso = new Date()) {
  const giornoDi = (d: Date) => d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })
  const d = new Date(iso)
  const { giorno, ora } = parti(iso)
  if (giornoDi(d) === giornoDi(adesso)) return `alle ${ora}`
  const domani = new Date(adesso.getTime() + 24 * 60 * 60 * 1000)
  return giornoDi(d) === giornoDi(domani) ? `domani alle ${ora}` : `${giorno} alle ${ora}`
}

/**
 * Alla prima in lista d'attesa, quando si libera un posto: il posto e' tenuto
 * per lei fino alla scadenza, poi passa alla prossima.
 */
export function testoPostoLibero(className: string, startsAt: string, scade: string): Avviso {
  const l = parti(startsAt)
  return {
    titolo: 'Si è liberato un posto per te',
    testo: `${className}, ${l.giorno} ${l.data} alle ${l.ora}. Sei la prima in lista e il posto è tenuto per te fino ${entroLe(scade)}. Se non ti serve tocca «Questa volta no», così passa subito alla prossima.`,
  }
}

/** Alla cliente fissa: il pacchetto e' finito (no_credits) o il posto e' stato liberato. */
export function testoPacchetto(issue: string, className: string, startsAt: string, avvisoEntro: string): Avviso {
  const l = parti(startsAt)
  if (issue === 'released_no_credits') {
    return {
      titolo: 'Posto fisso liberato per questa settimana',
      testo: `Il pacchetto è finito, quindi il posto di ${l.giorno} ${l.data} alle ${l.ora} (${className}) è passato a chi è in lista. Quando rinnovi in studio il tuo posto fisso torna per le settimane dopo.`,
    }
  }
  const e = parti(avvisoEntro)
  return {
    titolo: 'Il tuo pacchetto è finito',
    testo: `Per tenere il posto fisso di ${l.giorno} ${l.data} alle ${l.ora} (${className}) rinnova il pacchetto in studio entro ${e.giorno} alle ${e.ora}. Dopo, per quella lezione il posto passa a chi è in lista.`,
  }
}

/** Allo studio, quando a una fissa finisce il pacchetto. */
export function testoPacchettoStudio(issue: string, nome: string, className: string, startsAt: string): Avviso {
  const l = parti(startsAt)
  return issue === 'released_no_credits'
    ? {
        titolo: `Posto fisso liberato: ${nome}`,
        testo: `${nome} non ha rinnovato il pacchetto: il suo posto di ${l.giorno} ${l.data} alle ${l.ora} (${className}) è stato liberato.`,
      }
    : {
        titolo: `Pacchetto finito: ${nome}`,
        testo: `${nome} ha il posto fisso ${l.giorno} ${l.data} alle ${l.ora} (${className}) ma il pacchetto è finito. Se rinnova prima del promemoria, il posto resta suo.`,
      }
}

/** Lo studio ha annullato la lezione: la lezione torna sul pacchetto. */
export function testoAnnullata(className: string, startsAt: string, rimborsata: boolean): Avviso {
  const l = parti(startsAt)
  return {
    titolo: 'Lezione annullata',
    testo: `${className} di ${l.giorno} ${l.data} alle ${l.ora} è stata annullata dallo studio.${rimborsata ? ' La lezione ti torna sul pacchetto.' : ''} Ci scusiamo per il cambio.`,
  }
}

/** Lo studio ha tolto la cliente dalla lezione. */
export function testoTolta(className: string, startsAt: string): Avviso {
  const l = parti(startsAt)
  return {
    titolo: 'Prenotazione tolta dallo studio',
    testo: `Lo studio ha tolto la tua prenotazione a ${className} di ${l.giorno} ${l.data} alle ${l.ora}. La lezione ti torna sul pacchetto.`,
  }
}

/** Lo studio ha spostato l'orario della lezione. */
export function testoSpostata(className: string, primaIso: string, dopoIso: string): Avviso {
  const a = parti(primaIso)
  const b = parti(dopoIso)
  return {
    titolo: 'Lezione spostata',
    testo: `${className} di ${a.giorno} ${a.data} alle ${a.ora} si sposta a ${b.giorno} ${b.data} alle ${b.ora}. Se non riesci a venire puoi cancellarla dall'app.`,
  }
}
