# MEE TOO APP — ROADMAP AL LANCIO E OLTRE
*v1 — 14 luglio 2026 · Si aggiorna solo ai checkpoint, non a ogni sessione (il log vivo resta CLAUDE.md)*

---

## Principi non negoziabili

1. **Niente feature creep.** Ogni idea nuova da qui al 1/9 va nella sezione "Backlog V2" in fondo, senza eccezioni.
2. **Un checkpoint mancato sposta il piano, non si ignora.** Se un CP fallisce, la settimana dopo si dedica al recupero, non si accumula.
3. **Scoping confermato per il 1/9:** fatturazione via dashboard manuale Fatture in Cloud (SDI automatico → ottobre), CRM/campagne → ottobre-novembre, contenuti+Stripe → gennaio 2027, funnel pubblico `/lezioni` → post-lancio.

---

## FASE A — Chiusura prodotto (15–27 luglio)

### Settimana 29 (14–20 lug) · ~3 sessioni (S22–S24)
- S22: vista giornaliera palinsesto admin/istruttori + check notturno pg_cron + staleness S8
- S23: form pacchetti admin con `credit_amount` + fix `scrollIntoView`
- S24: email transazionali minime (Resend: benvenuto + conferma prenotazione; `RESEND_API_KEY` in Vercel)
- **Azione non-codice (bloccante):** chiedere a Giorgia la **formula di conversione crediti** (valore storico per lezione / prezzo attuale / caso per caso). Senza questa, la Fase C slitta.

**✅ CHECKPOINT 1 (20 lug) — Demo completa a Giorgia**
Test da fare insieme a lei, area admin su produzione:
- [ ] Crea una lezione a palinsesto, modifica, cancella
- [ ] Crea un pacchetto con importo in euro
- [ ] Assegna il pacchetto a una cliente test e verifica il saldo
- [ ] Apri la scheda di una cliente, scrivi una nota
- [ ] Vista giornaliera: la giornata di domani si legge in un colpo d'occhio
- [ ] **Decisione registrata: formula conversione crediti** ← output obbligatorio del CP

### Settimana 30 (21–27 lug) · ~2 sessioni + dry-run
- Fix emersi dal CP1
- **Dry-run con 3–5 clienti selezionate**: si registrano, prenotano e cancellano lezioni *non vincolanti* (App Palestre resta la verità). Obiettivo: rompere l'app con utenti veri prima di agosto.
- 12 issue accessibilità Chrome (batch unico)

**✅ CHECKPOINT 2 (27 lug) — Esito dry-run**
- [ ] ≥3 clienti hanno completato registrazione + prenotazione + cancellazione **da sole, su iPhone, senza aiuto**
- [ ] PWA installata su almeno 2 device reali (Add to Home Screen)
- [ ] Zero errori bloccanti in console/network durante il dry-run
- [ ] Lista fix prioritizzata (max 1 sessione di lavoro; se serve di più → si mangia la settimana 31)

---

## FASE B — Rito di agosto: infrastruttura (28 lug – 10 ago)

### Settimana 31 (28 lug – 3 ago) · ~2 sessioni
- Fix residui dry-run
- Preparazione rito: piano scritto passo-passo per repair/chiavi (si esegue a studio chiuso)

### Settimana 32 (4–10 ago, studio chiuso) · ~3 sessioni
- `supabase migration repair` su produzione (gated da S15)
- Versioning migrazioni S8 (se il check staleness di S22 non l'ha già chiuso)
- **Rigenerazione tutte le chiavi** (service role esposta nel doc pinnato: debito noto da giugno)
- `profiles.studio_id` → `NOT NULL`
- pg_cron schedulato su **produzione** (già provato su dev da S21)

**✅ CHECKPOINT 3 (10 ago) — Infrastruttura pronta al carico reale**
- [ ] Migration history di prod riconciliata (`supabase migration list` pulito)
- [ ] Vecchie chiavi revocate, nuove in Vercel + doc privato, deploy verificato
- [ ] I due sweep girano su prod (`cron.job_run_details` con run `succeeded`)
- [ ] Signup di test su prod: profilo con `studio_id` valorizzato

---

## FASE C — Migrazione e beta (11–24 agosto)

### Settimana 33 (11–17 ago) · ~3 sessioni
- **Prova generale migrazione** su dev: export CSV da App Palestre → import clienti → conversione crediti in euro con la formula di Giorgia → quadratura ledger (il principio S21: somma movimenti = saldo, per ogni cliente)
- Guida clienti "Come usare l'app" (PDF/video — qui il tuo mestiere vale più del codice)

**✅ CHECKPOINT 4 (17 ago) — Migrazione provata**
- [ ] Import completo su dev senza orfani (query di verifica: profili senza studio_id = 0, clienti senza wallet coerente = 0)
- [ ] Quadratura euro: per ogni cliente migrata, saldo = somma ledger
- [ ] Tempo totale della migrazione misurato (deve stare in una serata per il cutover vero)

### Settimana 34 (18–24 ago) · ~3 sessioni
- **Migrazione reale su produzione** (finestra serale, App Palestre resta attiva come fallback)
- **Beta con 5–10 clienti** su dati veri, prenotazioni vincolanti
- Form feedback semplice + fix quotidiani

**✅ CHECKPOINT 5 (24 ago) — Go/No-Go**
- [ ] Le 7 metriche MVP del master plan tutte verdi (registrazione→prenotazione, admin autonoma, email operative, PWA installabile, mobile Safari+Chrome ok)
- [ ] Giorgia gestisce una settimana di palinsesto **senza chiederti nulla**
- [ ] Zero incidenti su soldi/crediti durante la beta
- **No-Go = lancio al 8/9, non lancio zoppo il 1/9.** Una settimana di ritardo costa meno di una figuraccia con le clienti.

---

## FASE D — Lancio (25 ago – 1 set)

### Settimana 35 (25–31 ago) · ~2 sessioni
- Fix critici da beta (solo critici: il resto è V2)
- Comunicazione lancio: email + WhatsApp + Instagram (asset tuoi, pianificali ora)
- Cutover finale: App Palestre in sola lettura

**🚀 1 settembre — LANCIO**

---

## FASE E — Da prodotto ad asset (settembre 2026 → 2027)

> Obiettivo dichiarato: il tempo investito deve remunerare oltre Mee Too. La leva non è "più codice": è **la prova che funziona**, impacchettata.

### Set–Ott 2026 · Stabilizzazione + raccolta prove
- 1–2 sessioni/settimana: SDI automatico, poi CRM
- **Da subito, raccogliere le metriche che venderanno il prodotto:**
  - ore/settimana risparmiate a Giorgia (prima vs dopo — chiediglielo e scrivilo)
  - % prenotazioni self-service vs telefono/WhatsApp
  - incassi tracciati a sistema, no-show, riempimento medio lezioni
- Screenshot e mini-video dell'app in uso reale (materiale caso studio)

**✅ CHECKPOINT 6 (31 ott) — Caso studio pronto**
- [ ] 60 giorni di uso reale continuativo senza incidenti
- [ ] Documento 1 pagina: problema → soluzione → numeri di Giorgia
- [ ] Testimonianza di Giorgia (video breve o quote scritta)

### Nov–Dic 2026 · Impacchettamento offerta
- Ambiente demo con dati fittizi (uno studio "Demo" nel multi-tenant: costo ~zero, già architettato)
- SOP onboarding nuovo studio (setup, migrazione dati, formazione — scritta mentre è fresca)
- Pricing v1 da validare: setup una tantum (500–1.000€, copre migrazione+formazione) + canone 60–90€/mese. Sotto i 60€ non copri il supporto; sopra i 100€ competi coi big senza il loro brand.
- Upgrade infrastruttura: Supabase Pro prima del secondo tenant (il free tier non regge N studi — vincolo noto)

### Q1 2027 · Pilota commerciale
- **2–3 studi pilota dal tuo network olistico** (il tuo target d'agenzia È il mercato: vendita a canale caldo, non cold outreach)
- Onboarding manuale, prezzo pilota scontato in cambio di feedback + testimonianza
- **Regola:** niente feature "da SaaS" (billing self-service, onboarding automatico) prima del **terzo** cliente pagante. Il multi-tenant che c'è già è tutta l'opzionalità necessaria.

**✅ CHECKPOINT 7 (31 mar 2027) — Decisione industrializzazione**
- [ ] ≥2 studi pilota attivi e paganti
- [ ] Costo reale di supporto per studio misurato (ore/mese)
- [ ] Solo ora: decidere se investire in prodotto SaaS vero (pricing pubblico, onboarding automatico) o restare boutique ad alto margine (pochi studi, setup fee alta, gestione via agenzia)

---

## Backlog V2 (parcheggio, non si tocca prima di ottobre)
- Funnel pubblico `/lezioni` · Contenuti online + Stripe (gennaio) · Gift card · Eventi · Vista co-partecipanti (blocked: privacy Giorgia) · Raggruppamento movimenti per booking_id · Role-gating esplicito route · Push notifications avanzate · Dashboard BI estesa
