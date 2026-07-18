> Travasato dal progetto Claude web "Mee too app" il 18-lug-2026. Documento storico (v1.0, maggio 2026):
> dove contrasta con ROADMAP.md o CLAUDE.md, valgono questi ultimi. Le 7 metriche MVP citate dalla ROADMAP sono qui (§11 "Metriche di successo dell'MVP").

# 🧘 MEE TOO APP — MASTER PLAN DI SVILUPPO
### Da zero a PWA funzionante entro settembre 2026
*Versione 1.0 — Maggio 2026*

---

## 1. VISIONE & OBIETTIVO

**Cosa stiamo costruendo:**
Una Progressive Web App (PWA) per studi Pilates/Yoga con tre anime:
1. **Strumento interno** → sostituisce App Palestre per Mee Too
2. **Prodotto digitale** → vende contenuti online e gestisce clienti
3. **Futuro SaaS** → replicabile su altri studi con architettura multi-tenant

**MVP entro 1 settembre 2026** — testabile dalle clienti di Mee Too Pilates.

---

## 2. STACK TECNOLOGICO DEFINITIVO

### Frontend
| Tool | Ruolo | Costo |
|---|---|---|
| **Next.js 14+** | Framework React, PWA, routing, SSR | Gratuito |
| **Tailwind CSS** | Stile e design system | Gratuito |
| **shadcn/ui** | Componenti UI pronti e personalizzabili | Gratuito |
| **Framer Motion** | Animazioni e micro-interazioni | Gratuito |

### Backend & Database
| Tool | Ruolo | Costo |
|---|---|---|
| **Supabase** | Database PostgreSQL, Auth, Storage, Real-time, RLS | Gratuito (free tier) |
| **Supabase Edge Functions** | Logica server-side, webhook | Gratuito |

### Pagamenti & Fatturazione
| Tool | Ruolo | Costo |
|---|---|---|
| **Stripe** | Pagamenti online, abbonamenti, gift card | % su transazione |
| **Fatture in Cloud API** | SDI intermediario, FatturaPA | ~10€/mese |

### Email & Comunicazioni
| Tool | Ruolo | Costo |
|---|---|---|
| **Resend** | Invio email transazionali e marketing | Gratuito fino 3k/mese |
| **React Email** | Template email in codice | Gratuito |

### Deployment & Versioning
| Tool | Ruolo | Costo |
|---|---|---|
| **Vercel** | Hosting frontend, deploy automatico | Gratuito (hobby) |
| **GitHub** | Controllo versione, backup codice | Gratuito |

### AI Dev Tools
| Tool | Ruolo |
|---|---|
| **Claude Code** | Scrittura codice, debug, architettura |
| **Claude.ai (questo)** | Strategia, review, planning sessioni |
| **Cowork** | Documentazione, SOP, task non-code |

---

## 3. COSA INSTALLARE SUL TUO PC (SETUP INIZIALE)

### Ordine di installazione — fai tutto in questa sequenza:

**Step 1 — Node.js**
- Vai su https://nodejs.org → scarica versione LTS
- Verifica: apri Terminale e scrivi `node --version`

**Step 2 — VS Code**
- Vai su https://code.visualstudio.com → scarica e installa
- È l'editor dove lavora Claude Code
- Installa estensioni: ESLint, Prettier, Tailwind CSS IntelliSense, GitLens

**Step 3 — Claude Code**
- Nel Terminale: `npm install -g @anthropic-ai/claude-code`
- Segui la procedura di autenticazione con il tuo account Anthropic

**Step 4 — Git + GitHub**
- Scarica Git: https://git-scm.com
- Crea account su https://github.com
- Installa GitHub Desktop (https://desktop.github.com) se non sei comodo con terminale

**Step 5 — Account Supabase**
- Vai su https://supabase.com → crea account gratuito
- Crea nuovo progetto: "meetoo-pilates"
- Salva le chiavi API (le userai nel codice)

**Step 6 — Account Vercel**
- Vai su https://vercel.com → crea account (entra con GitHub)

**Step 7 — Account Resend**
- Vai su https://resend.com → crea account gratuito
- Crea una API Key → salvala

---

## 4. ARCHITETTURA DEL DATABASE (Multi-tenant da subito)

Ogni tabella ha un campo `studio_id` — questo è il fondamento del SaaS futuro.
La Row Level Security (RLS) di Supabase filtra automaticamente i dati per studio.

```
studios                     → anagrafica di ogni studio (Mee Too = studio #1)
  └── users                 → clienti + istruttori + admin
  └── packages              → pacchetti acquistabili (10 lezioni, mensile, ecc.)
  └── client_packages       → pacchetti acquistati da ogni cliente
  └── classes               → tipi di lezione (Pilates Mat, Yoga, ecc.)
  └── schedules             → palinsesto (giorno, ora, istruttore, max posti)
  └── bookings              → prenotazioni (cliente + schedule + stato)
  └── invoices              → fatture collegate a Fatture in Cloud
  └── products              → corsi/contenuti digitali vendibili
  └── content_items         → PDF, video, e-book caricati
  └── events                → workshop, masterclass, eventi
  └── event_registrations   → iscrizioni agli eventi
  └── email_campaigns       → campagne CRM
  └── wallet_transactions   → credito digitale del cliente
```

---

## 5. STRUTTURA DELL'APP (Aree principali)

### Area Cliente (PWA pubblica)
- **Home** → benvenuto, prossime lezioni prenotate, notifiche
- **Palinsesto** → calendario settimanale, filtri per tipo lezione
- **Prenotazioni** → prenota/cancella lezione, lista d'attesa
- **Profilo** → pacchetti attivi, credito, storico pagamenti
- **Contenuti** → corsi gratuiti, PDF, video, corsi a pagamento
- **Shop** → gift card, eventi, prodotti merch
- **Comunità** → sfide mensili, notifiche push

### Area Admin (Giorgia)
- **Dashboard** → incassi oggi/mese, lezioni piene/vuote, KPI
- **Clienti** → lista CRM, profilo cliente, note, pacchetti
- **Palinsesto** → gestione lezioni, istruttori, orari
- **Fatturazione** → lista fatture, invio a SDI via API, stato
- **Email Marketing** → campagne, segmentazione, automazioni
- **Contenuti** → upload PDF/video, gestione corsi
- **Eventi** → crea evento, gestisci iscrizioni, pagamenti
- **Impostazioni** → prezzi, pacchetti, configurazione studio

### Area Istruttore
- **Le mie lezioni** → palinsesto personale, lista partecipanti
- **Note clienti** → leggi/scrivi note sui clienti
- **Personal training** → inserisci sessioni nei buchi liberi

---

## 6. COME USARE CLAUDE CODE — GUIDA PRATICA

### Come aprire un progetto
1. Apri VS Code
2. Apri il Terminale integrato (Ctrl+` o Cmd+`)
3. Naviga nella cartella del progetto: `cd meetoo-app`
4. Lancia Claude Code: `claude`

### Il Framework del Prompt Perfetto (usalo sempre)
Ogni volta che chiedi qualcosa a Claude Code, usa questa struttura:

```
CONTESTO: [Cosa stiamo costruendo, stack usato]
TASK: [Cosa voglio che faccia ORA, specifico]
VINCOLI: [Cosa NON deve fare, stile da rispettare]
OUTPUT: [Cosa mi aspetto come risultato]
```

**Esempio pratico:**
```
CONTESTO: Sto costruendo la PWA Mee Too Pilates con Next.js 14, 
Supabase e Tailwind CSS. Il design system usa colori #1e2e22 
(dark green) e #c8dba0 (light green), font Montserrat 900 
per i titoli e Lato 300/400 per il body.

TASK: Crea il componente React per la card di una lezione nel 
palinsesto. Deve mostrare: nome lezione, istruttore, ora, 
posti disponibili/totali, pulsante "Prenota".

VINCOLI: Non usare librerie esterne oltre a Tailwind. Il 
pulsante deve essere disabilitato se posti = 0. Usa TypeScript.

OUTPUT: Un file .tsx completo con il componente e i suoi tipi.
```

### Modelli di pensiero per tipo di task

| Task | Approccio |
|---|---|
| **Nuova feature** | Prima descrivi il flusso utente a parole → poi chiedi il codice |
| **Bug** | Incolla il codice + il messaggio di errore esatto → chiedi diagnosi |
| **Database** | Disegna le relazioni su carta → poi chiedi lo schema SQL |
| **Design UI** | Porta il design system (colori, font) in ogni prompt |
| **Integrazione API** | Prima leggi la docs dell'API → poi chiedi l'implementazione |
| **Refactoring** | Chiedi prima una review → poi chiedi le modifiche |
| **Testing** | Chiedi i test subito dopo ogni componente, non alla fine |

### Sessione tipo con Claude Code
Una sessione efficace dura **2-3 ore max**. Struttura:
1. **15 min** → rivedi cosa hai fatto nella sessione precedente
2. **90 min** → lavora su un singolo modulo/feature
3. **30 min** → testa quello che hai costruito nel browser
4. **15 min** → documenta con Cowork cosa hai fatto e i prossimi step

---

## 7. COME USARE COWORK IN QUESTO PROGETTO

Cowork è il tuo **project manager AI** per tutto ciò che non è codice:

- **SOP** → scrivi procedure per ogni processo (es. "Come aggiungere un nuovo istruttore")
- **Documentazione** → tieni traccia delle decisioni architetturali
- **Contenuti** → brief per copy dell'app, notifiche push, email template
- **Onboarding** → prepara il manuale per Giorgia (come usare la dashboard)
- **SaaS futuro** → documenta come onboardare un nuovo studio

**Crea in Cowork un workspace dedicato:** `MEE TOO APP DEV`
Con sezioni: Decisioni Tecniche / Feature Log / SOP Operative / Contenuti App / Roadmap

---

## 8. ROADMAP SETTIMANA PER SETTIMANA

### FASE 1 — Setup & Fondamenta (Settimane 1-2 | 12-25 Maggio)

**Settimana 1 (12-18 Maggio)**
- [ ] Installa tutto lo stack (Node, VS Code, Git, Claude Code)
- [ ] Crea account Supabase, Vercel, GitHub, Resend
- [ ] Crea repository GitHub "meetoo-app"
- [ ] Inizializza progetto Next.js: `npx create-next-app@latest meetoo-app`
- [ ] Configura Tailwind CSS + shadcn/ui
- [ ] Crea design system base (variabili colori, font Montserrat/Lato)
- [ ] Prima sessione Claude Code: struttura cartelle progetto

**Settimana 2 (19-25 Maggio)**
- [ ] Crea database Supabase (tutte le tabelle dello schema sopra)
- [ ] Configura Row Level Security (RLS) per multi-tenancy
- [ ] Inserisci studio "Mee Too Pilates" come primo record
- [ ] Setup autenticazione Supabase (email + password)
- [ ] Pagina login/registrazione cliente funzionante
- [ ] Deploy su Vercel (anche se è solo il login, per abituarsi al processo)

---

### FASE 2 — Palinsesto & Prenotazioni (Settimane 3-4 | 26 Maggio - 8 Giugno)

**Settimana 3**
- [ ] Gestione istruttori (CRUD admin)
- [ ] Gestione tipologie lezioni (CRUD admin)
- [ ] Palinsesto settimanale — vista admin (crea/modifica/cancella lezioni)
- [ ] Palinsesto settimanale — vista cliente (calendario visuale)

**Settimana 4**
- [ ] Sistema prenotazione: prenota una lezione
- [ ] Sistema cancellazione: cancella entro 24h (logica automatica)
- [ ] Gestione posti: contatore real-time con Supabase Realtime
- [ ] Lista d'attesa: notifica quando si libera un posto
- [ ] Notifiche push PWA per reminder lezione

---

### FASE 3 — Profili Cliente & Pacchetti (Settimane 5-6 | 9-22 Giugno)

**Settimana 5**
- [ ] Profilo cliente completo (dati anagrafici, foto, note mediche)
- [ ] Gestione pacchetti: creazione pacchetti in admin
- [ ] Assegnazione pacchetto a cliente con scalamento lezioni automatico
- [ ] Wallet digitale: credito cliente con storico movimenti
- [ ] Blocco prenotazione se pacchetto esaurito

**Settimana 6**
- [ ] Dashboard admin: lista clienti con filtri e ricerca
- [ ] Scheda cliente admin: storico lezioni, pacchetti, pagamenti, note
- [ ] Dashboard istruttore: le mie lezioni + lista partecipanti
- [ ] Note cliente: istruttori leggono, admin scrive

---

### FASE 4 — Fatturazione (Settimane 7-8 | 23 Giugno - 6 Luglio)

**Settimana 7**
- [ ] Integrazione Fatture in Cloud API (autenticazione OAuth2)
- [ ] Generazione automatica fattura a ogni pagamento
- [ ] Template fattura con dati Mee Too Pilates
- [ ] Invio automatico a SDI via Fatture in Cloud
- [ ] Lista fatture in admin con stato SDI (inviata/accettata/rifiutata)

**Settimana 8**
- [ ] Invio fattura PDF via email al cliente (con Resend)
- [ ] Gestione fatture manuali (per pagamenti in studio/POS)
- [ ] Report fatturazione mensile in dashboard admin
- [ ] Test completo flusso: pagamento → fattura → SDI → email cliente

---

### FASE 5 — CRM & Email Marketing (Settimane 9-10 | 7-20 Luglio)

**Settimana 9**
- [ ] Segmentazione clienti: per pacchetto, frequenza, data iscrizione
- [ ] Automazione compleanno: email automatica con offerta personalizzata
- [ ] Automazione riattivazione: email a clienti inattivi da 30+ giorni
- [ ] Email benvenuto nuovi iscritti
- [ ] Template email brandizzati Mee Too (con React Email)

**Settimana 10**
- [ ] Campagne manuali: crea e invia email a segmenti
- [ ] Gestione opt-in/opt-out GDPR
- [ ] Statistiche email: aperture, click (Resend dashboard)
- [ ] Raccolta email da landing page esterna (per non-clienti)

---

### FASE 6 — Contenuti & Prodotti Online (Settimane 11-12 | 21 Luglio - 3 Agosto)

**Settimana 11**
- [ ] Upload contenuti: PDF, video, audio su Supabase Storage
- [ ] Sezione "Contenuti Gratuiti": visibile a tutti gli iscritti app
- [ ] Sezione "Corsi a Pagamento": accesso dopo acquisto
- [ ] Player video integrato (HTML5 native)
- [ ] Lettore PDF in-app

**Settimana 12**
- [ ] Integrazione Stripe per pagamenti online
- [ ] Acquisto corsi/contenuti: checkout → accesso immediato
- [ ] Gift card digitali: acquisto → codice → riscatto
- [ ] Gestione eventi: crea evento, apri iscrizioni, gestisci pagamenti
- [ ] Pagina evento pubblica (acquistabile anche senza app)

---

### FASE 7 — Polish & Test (Settimane 13-14 | 4-17 Agosto)
*(Studio chiuso → tempo pieno per sviluppo)*

**Settimana 13**
- [ ] Testing completo di tutti i flussi con dati reali
- [ ] Ottimizzazione performance PWA (Lighthouse score 90+)
- [ ] Installabilità PWA (manifest, service worker, icone)
- [ ] Adattamento mobile completo (ogni schermata)
- [ ] Fix di tutti i bug trovati

**Settimana 14**
- [ ] Dashboard BI admin: grafici incassi, lezioni, trend
- [ ] Export dati (lista clienti CSV, report fatturazione)
- [ ] Onboarding in-app per nuovi clienti (tour guidato)
- [ ] Documentazione admin per Giorgia (con Cowork)
- [ ] Test di sicurezza (RLS funziona correttamente?)

---

### FASE 8 — Beta Launch (Settimane 15-16 | 18-31 Agosto)

**Settimana 15**
- [ ] Migrazione dati clienti da App Palestre → database Mee Too App
- [ ] Beta test con 5-10 clienti selezionate
- [ ] Raccolta feedback con form semplice
- [ ] Prioritizzazione fix pre-lancio

**Settimana 16**
- [ ] Fix critici da feedback beta
- [ ] Comunicazione lancio (email + WhatsApp + Instagram)
- [ ] Guida "Come usare l'app" per clienti (PDF + video)
- [ ] Lancio ufficiale 1 settembre 🚀

---

## 9. CALENDAR GOOGLE — BLOCCHI SETTIMANALI CONSIGLIATI

### Schema settimanale ricorrente (adatta ai tuoi impegni):

| Giorno | Ora | Attività |
|---|---|---|
| Lunedì | 9:00-11:00 | Sessione Claude Code — sviluppo feature |
| Martedì | 9:00-11:00 | Sessione Claude Code — sviluppo feature |
| Mercoledì | 9:00-10:00 | Review codice + testing nel browser |
| Giovedì | 9:00-11:00 | Sessione Claude Code — sviluppo feature |
| Venerdì | 9:00-10:00 | Documentazione Cowork + piano settimana successiva |

**Blocchi speciali da inserire:**
- **Ogni domenica sera** (30 min): rivedi i task della settimana e prepara i prompt Claude Code per il lunedì
- **Fine mese** (2h): review progresso vs roadmap, aggiusta priorità
- **1 Agosto** (mezza giornata): check-point mid-point — sei in linea con l'obiettivo settembre?

---

## 10. FIRST SESSION — COSA FARE OGGI O DOMANI

Esegui questi comandi nel Terminale in ordine:

```bash
# 1. Crea il progetto
npx create-next-app@latest meetoo-app --typescript --tailwind --app

# 2. Entra nella cartella
cd meetoo-app

# 3. Installa dipendenze base
npm install @supabase/supabase-js @supabase/ssr
npm install framer-motion
npm install resend

# 4. Installa shadcn/ui
npx shadcn@latest init

# 5. Apri VS Code
code .

# 6. Lancia Claude Code
claude
```

**Primo prompt da dare a Claude Code:**
```
CONTESTO: Sto costruendo una PWA per uno studio Pilates/Yoga chiamato 
"Mee Too Pilates". Stack: Next.js 14 App Router, TypeScript, Tailwind CSS, 
shadcn/ui, Supabase. Architettura multi-tenant (ogni studio ha un studio_id).

Design system:
- BG: #ffffff / #f7faf7 (chiaro) e #1e2e22 (scuro)
- Accent: #c8dba0 (verde chiaro) e #4a6755 (verde scuro)
- Titoli: Montserrat 900, uppercase
- Body: Lato 300/400

TASK: 
1. Struttura le cartelle del progetto secondo le best practice Next.js 14 App Router
2. Crea il file globals.css con tutte le variabili CSS del design system
3. Crea il layout.tsx root con i font Google (Montserrat + Lato)
4. Crea una home page placeholder stilizzata con il design system

VINCOLI: Tutto in TypeScript. Nessuna libreria extra oltre a quelle installate.

OUTPUT: Lista dei file da creare con il codice completo di ognuno.
```

---

## 11. METRICHE DI SUCCESSO DELL'MVP

Alla data del 1 settembre, l'app è pronta se:

- [ ] Una cliente può registrarsi, vedere il palinsesto e prenotare una lezione
- [ ] Giorgia può gestire il palinsesto dall'admin senza toccare codice
- [ ] Una fattura viene generata e inviata a SDI automaticamente
- [ ] Si può inviare un'email a tutti i clienti con un click
- [ ] Almeno un contenuto gratuito è accessibile nell'app
- [ ] L'app si installa come PWA su iPhone (Add to Home Screen)
- [ ] Funziona correttamente su mobile Safari e Chrome

---

## 12. RISCHI E COME GESTIRLI

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| SDI integration più lenta del previsto | Alta | Inizia con Fatture in Cloud dashboard manuale, automatizza dopo |
| Feature creep (aggiungi troppe cose) | Alta | Rispetta la roadmap. Ogni idea nuova va in "V2 backlog" su Cowork |
| Claude Code genera codice che non capisci | Media | Chiedi sempre spiegazioni + fai review prima di andare avanti |
| Migrazione dati da App Palestre difficile | Media | Fallo in settimana 15, non prima. Esporta CSV da App Palestre |
| PWA non installabile su alcuni device | Bassa | Testa su iPhone reale ogni settimana dalla settimana 7 |

---

*Piano creato: Maggio 2026 — Aggiorna questo documento ogni fine mese con i progressi reali.*
