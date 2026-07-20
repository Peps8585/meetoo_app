@AGENTS.md

# Mee Too Pilates — Stato del progetto

## Regole di lavoro

- A inizio sessione leggi questo file (stato + roadmap + log). A fine sessione aggiornalo e fai commit/push.
- Qualsiasi comando verso Supabase (.supabase.co) funziona SOLO su hotspot iPhone (la rete TIM blocca quei domini via DNS). Se un comando Supabase fallisce con errore DNS/host, fermarsi e chiedere a Mattia di passare all'hotspot.
- Le azioni possibili solo da dashboard web (creare/disabilitare API key Supabase, rigenerare key Resend, certe impostazioni Vercel) non si possono fare da qui: fermarsi e dare a Mattia i passi esatti da cliccare.
- Mai committare segreti. `.env.local` è in `.gitignore`. Le key Supabase/Resend si leggono da `.env.local`, non si trascrivono in nessun file pubblico.
- Lo schema DB è la fonte di verità: verificare le colonne con `information_schema` prima di scrivere query. Storico mismatch: `remaining_lessons`, `credits`, `full_name`.
- Lavorare a piccoli step, spiegare il ragionamento, committare dopo ogni milestone.
- `CLAUDE.md` viene committato su GitHub: trattarlo come PUBBLICO. Nessun segreto (niente password, niente API key, niente ID hardcodati stantii).
- Gli ID (studio_id, istruttori, ecc.) si ricavano a runtime con query, non hardcodati.
- Prima di ogni commit, review del diff: `git --no-pager diff` (per file NUOVI: `git add -N . && git --no-pager diff`, altrimenti non compaiono).
- Commit separati per tema: codice e aggiornamento CLAUDE.md non si mischiano mai nello stesso commit.
- La validazione visiva si fa nel BROWSER (incluso mobile 390px), non nelle preview dell'editor (la preview SVG di VS Code sbaglia i transform annidati).
- Blocchi SQL nel SQL Editor: uno alla volta; migrazioni in transazione; sempre query di verifica post-esecuzione (i fallimenti silenziosi esistono: storico `handle_new_user` che ingoia eccezioni → profili orfani con studio_id NULL).
- Stile: raccomandazione ferma motivata dai dati (codice, browser, metriche), non menù di opzioni. Per decisioni da validare: prima spiegazione in linguaggio semplice, poi conferma di Mattia, poi implementazione.

## Stack

- Next.js 16.2.6 (App Router), TypeScript, Tailwind v4, shadcn/ui
- Backend: Supabase (postgres + auth + storage)
- Deploy: Vercel (progetto `meetoo-app-ntls`, branch main)
- Multi-tenant via `studio_id`
- Repo: github.com/Peps8585/meetoo_app

## Decisioni di design

- **`wallet_transactions` ≠ crediti-lezioni**: la tabella `wallet_transactions` è il wallet monetario (gift card, shop — feature non ancora costruita). Il credito-lezioni è gestito interamente da `client_packages.credits_used` via le RPC `book_lesson`/`cancel_booking`. Le due cose sono separate per design. Non integrare `wallet_transactions` nelle RPC di prenotazione senza una decisione esplicita.

- **SEO local + GEO (Generative Engine Optimization) — principio trasversale permanente**: da tenere presenti su tutto ciò che si costruisce. Le leve reali NON stanno nel component layer: stanno in metadata di pagina (title/description/OG), dati strutturati (JSON-LD Organization/LocalBusiness), struttura semantica (h1/h2) e contenuto in prosa citabile. L'unico contributo del logo è il nome accessibile del wordmark (path muto → serve un nome reale nel DOM, es. `h1` sr-only). Primo cantiere reale = public funnel. Nota aperta: l'`h1` sr-only della welcome elenca "Pilates, Yoga, Mindfulness" — da rivedere per la chiarezza-entità GEO (entità unica "Mee Too"), da fare alla funnel/metadata, NON nel logo.

## Dipendenze chiave

- `@supabase/supabase-js`: 2.106.0
- `@supabase/ssr`: 0.10.3 (peer dep: supabase-js ^2.105.3 — compatibile)
- `next`: 16.2.6

## Stato attuale (aggiornato: 20 luglio 2026 — S24 email Resend)

**Ultimo chiuso:** S24 — email con Resend COMPLETA su dev: transazionali (benvenuto + conferma prenotazione) costruite e verificate E2E, SMTP custom di Auth configurato su MeeToo_Dev e provato (reset password ARRIVA a Gmail, mittente "Mee Too" — il problema deliverability di S23 è risolto). Logo ufficiale nelle email (PNG @2x da `scripts/generate-email-logo.sh`). Dettagli nel log "S24" in fondo.
**Prossimo kickoff:** S25 — (a) decisione DOMINIO con Giorgia: il sandbox `onboarding@resend.dev` consegna SOLO all'email dell'account Resend → per le clienti vere serve dominio verificato su Resend (2 record DNS), prerequisito del lancio; (b) test onboarding istruttrice col flusso reale (bloccato dal sandbox: serve indirizzo consegnabile); (c) nel rito di agosto: `RESEND_API_KEY` + `EMAIL_FROM` nelle env Vercel e SMTP custom sul progetto PROD (oggi le email in produzione vengono SALTATE in silenzio, by design del wrapper best-effort).

_Nota: la sezione "Fatto / Da fare" qui sotto è storica (sessione 4, migrazione API key Supabase) — conservata, non più lo stato corrente._

### Fatto
- Migrate alle nuove API key Supabase: `sb_publishable_*` (anon) e `sb_secret_*` (service role) create e sostituite in `.env.local` e nelle env Vercel. Redeploy su `meetoo-app-ntls` completato.
- **Publishable key verificata end-to-end**: login su sito deployato funziona dopo fix typo URL Vercel.
- **Secret key verificata**: `GET /auth/v1/admin/users` → HTTP 200, restituisce 3 utenti del progetto. Accettata come service_role.

### Da fare (azioni su dashboard web — solo Mattia)
- **Disabilitare le legacy key `eyJ...`** su Supabase dashboard (ora che entrambe le nuove key sono confermate)
- **Rigenerare la key Resend** e aggiornare `RESEND_API_KEY` in `.env.local` e Vercel → redeploy

### Blocco login — RISOLTO (sessione 17 giu)

Typo `qq` → `gq` nell'URL Supabase baked nel bundle Vercel. Fix: `NEXT_PUBLIC_SUPABASE_URL` corretto su Vercel + redeploy → login ok.

## Roadmap

1. **[FATTO]** ~~Risolvi blocco login (`Failed to fetch`)~~ → fix URL Vercel + redeploy; key publishable e service_role verificate end-to-end
2. **[FATTO]** ~~Pulizia chiavi~~ → legacy key Supabase `eyJ...` disattivate; Resend ruotata (re_9AM1... revocata → re_g5yCUWxg attiva); tutte le chiavi esposte nel PDF ora morte. Pendente (igiene): eliminare il PDF dalla circolazione; aggiungere `RESEND_API_KEY` su Vercel quando si attivano le email
3. **[FATTO]** ~~Versiona nel repo RPC e schema DB~~ → `supabase/migrations/` creata con snapshot 14 tabelle + 4 RPC complete
4. **[FATTO]** ~~RLS hardening~~ → `20260617000000_rls_hardening.sql` applicata e validata: 6 policy RESTRICTIVE TO public su `bookings` e `client_packages`; client bloccato da INSERT/UPDATE/DELETE diretti; SELECT e RPC (`book_lesson`/`cancel_booking`) intatti; **9/9 test PASS** (`supabase/tests/rls_validation_bookings_client_packages.sql`)
5. **[FATTO]** ~~Test E2E funzionale + smoke test UI~~ → SQL 13/13 PASS; UI live (Maria Test): prenota credito 9→8 posto -1, cancella credito 8→9 posto ripristinato. Lezioni di test create nel palinsesto (utili anche per demo Giorgia)
6. **[Auth]** Fix auth callback (magic link / reset password) e bottone "Scopri le lezioni" in homepage
7. **[Pulizia]** Elimina 2 vecchi progetti Vercel (meetoo-app, meetoo-app-v1); risolvi 3 warning ESLint/Tailwind + 1 warning build
8. **[Demo]** Demo con Giorgia (riattivare free tier Supabase se in pausa)
9. **[Fatturazione]** Integrazione Fatture in Cloud API

Backlog successivo: contenuti+Stripe, CRM/email Resend, polish PWA, beta launch 1 settembre.

## Log sessioni

### 2026-06-17 — Sessione 1
- Creato CLAUDE.md con stato, regole, roadmap e log
- Trovato e risolto "Failed to fetch" al login: typo `qq` → `gq` in `NEXT_PUBLIC_SUPABASE_URL` su Vercel → redeploy → login ok
- Secret key verificata: `GET /auth/v1/admin/users` → HTTP 200, 3 utenti
- **Roadmap 1 CHIUSO** — entrambe le key funzionano end-to-end
- **Roadmap 3 CHIUSO**: `supabase/migrations/` creata — 14 tabelle (snapshot) + 4 RPC con corpi reali
- Scritta `20260617000000_rls_hardening.sql` (6 policy RESTRICTIVE su bookings e client_packages)

### 2026-06-19 — Sessione 2
- RLS hardening applicata da Mattia nel SQL Editor (sessione 17 giu, completata 19 giu)
- Preflight Sezione 0 verde: funzioni SECURITY DEFINER owner=postgres, rls_enabled=true su entrambe le tabelle
- Scritto blocco SQL di validazione con tabella risultati (no RAISE NOTICE, compatibile SQL Editor)
- **9/9 test PASS**: 6 policy RESTRICTIVE confermate in pg_policies; INSERT bloccato con eccezione RLS; UPDATE/DELETE 0 righe; SELECT proprie righe intatta
- **Roadmap 4 CHIUSO** — RLS hardening completata e validata
- Salvato blocco di validazione in `supabase/tests/rls_validation_bookings_client_packages.sql`
- Scritto e eseguito test E2E funzionale RPC nel SQL Editor (no app, no hotspot)
- **13/13 PASS**: setup auto (studio/class/schedule/crediti), `book_lesson` scala credits_used +1 e current_bookings +1, `cancel_booking` su lezione >24h rimborsa e libera posto
- **Roadmap 5 CHIUSO (SQL)** — percorso RPC integro dopo la hardening; resta smoke test UI + prep demo Giorgia
- Salvato `supabase/tests/e2e_book_cancel_rpc.sql`

### 2026-06-19 — Sessione 3
- **Smoke test UI SUPERATO** su app live (hotspot): Maria Test prenota lezione → credito 9→8, posto -1; cancella → credito 8→9, posto ripristinato
- Lezioni di test create nel palinsesto, disponibili anche per la demo con Giorgia
- **Roadmap 5 CHIUSO completamente** — E2E SQL (13/13) + smoke test UI entrambi verdi

### 2026-06-19 — Sessione 4
- Legacy key Supabase `eyJ...` disattivate su dashboard
- Resend ruotata: re_9AM1... revocata, re_g5yCUWxg attiva (non ancora su Vercel — email non ancora attive)
- Tutte le chiavi esposte nel PDF ora morte
- **Roadmap 2 CHIUSO** — pendenti non bloccanti: eliminare PDF circolante; aggiungere `RESEND_API_KEY` su Vercel prima di attivare le email

### 2026-06-22 — Sessione 5 — Admin mobile-responsive
- Layout admin responsive: sidebar → drawer off-canvas sotto md (hamburger + 
  top bar mobile), <main> a piena larghezza su mobile (md:ml-60). Desktop invariato.
- Card responsive (Tipologie Lezioni, Istruttori): flex-col mobile / md:flex-row, 
  md:truncate, min-w-0. Istruttori: avatar accanto al nome via wrapper md:contents.
- Header bottone-azione (Istruttori, Palinsesto): w-full md:w-auto + flex-col 
  md:flex-row → bottone sotto il titolo su mobile.
- Backdrop drawer /50 → /60. Palinsesto: tenuto scroll orizzontale grid 7 giorni.
- Pattern utile: md:contents per neutralizzare un wrapper mobile a desktop.

### 2026-06-22 — Sessione 6 — Fix UI: CTA home + redirect role-based login
- Fix 1 — Bottone CTA "Scopri le lezioni" in `app/page.tsx`: era un placeholder 
  `<a href="#">`, ora `<Link href="/registrati">` (next/link). Destinazione 
  /registrati scelta come punto di conversione comune del funnel (sia pubblico 
  in presenza sia audience online). Commit 73faf66.
- Fix 2 — Redirect role-based post-login. Creata helper condivisa 
  `lib/supabase/destination.ts` → `destinationForUser(supabase, userId)`: legge 
  profiles.role, ritorna '/admin' se role==='admin' altrimenti '/dashboard' 
  (fallback sicuro su errore o role null). Applicata ai 3 redirect prima fissi a 
  /dashboard: `app/(auth)/login/page.tsx` (handler), `app/auth/callback/route.ts` 
  (post exchangeCodeForSession + getUser), `app/(auth)/layout.tsx` (utente già 
  loggato). Nessun middleware introdotto. Commit fc90331.
- Verifica produzione OK: admin (mat_peps) → /admin; client (laurarossi/Maria 
  Test) → area cliente. Typecheck (tsc --noEmit) pulito prima del commit.

Backlog / prossimi obiettivi:
- "Funnel landing pubblico": vetrina consultabile da anonimi (anteprima 
  palinsesto read-only + catalogo contenuti/corsi online). Richiede risolvere 
  studio_id per anonimo (probabile hardcode/env, di fatto single-tenant) + 
  aprire RLS in SELECT su schedules/classes/instructors.
- Revisione copy CTA home: "Scopri le lezioni" è stretta per l'audience online, 
  renderla trasversale.
- Verificare il redirect del client: confermare che atterri su /dashboard e non 
  /profilo (non bloccante, da controllare).

### 2026-06-25 — Sessione 7 — Decisioni: funnel pubblico + wallet in euro (NO CODE)

**Funnel pubblico (deciso):**
- Route nuova dedicata (es. `/lezioni`), NON sganciare auth da `/palinsesto`.
- Rendering statico/cache (SSG/ISR), niente posti live → SEO + sicurezza.
- RLS: SELECT `anon` solo su schedules/classes/instructors, solo colonne vetrina; VIEW pubblica per istruttori (mai riga `profiles` intera). bookings/client_packages/profiles restano blindate.
- `studio_id` anonimi: env hardcoded via helper `getPublicStudioId()` (migrabile a slug per SaaS).

**Modello credito → wallet in euro (deciso):**
- Saldo in euro fungibile. Prezzo fisso per disciplina (`classes.price`), override workshop (`schedules.price_override`).
- Pacchetti → confezioni di ricarica (credito + bonus); sconto-volume = credito bonus calibrato sugli sconti attuali (numeri da definire con Giorgia).
- Persa garanzia letterale "10 reformer" → posizionata come flessibilità a costo zero.
- Tranche esplicite (riuso `client_packages`: `amount_initial`/`amount_remaining`/`late_cancel_used`). Scadenza DURA per taglia (5→2m, 10→3m, 15→5m, 20→6m) via `validity_days`. Consumo FIFO per scadenza.
- Ledger `wallet_transactions` append-only (+ FK `booking_id`, `client_package_id`; type: topup/bonus/booking_debit/cancel_refund/gift/adjustment). Scrittura solo via RPC DEFINER.
- §8 chiusi: (a) split-debit; (b) bonus 1 cancellazione tardiva = 1 per ricarica; (c) scadenza dura, quota su tranche scaduta NON rimborsata; (d) valvola gift fuori dal motore.
- RPC `book_lesson`/`cancel_booking` da riscrivere su saldo+prezzo, preservando lock FOR UPDATE / finestra 24h / posto sempre liberato.
- Fix: indice unico `(client_id, schedule_id)` → parziale `WHERE status='confirmed'`. `bookings.client_package_id` → legacy.

**Audit DB (25/06):** `classes` senza prezzo (gap principale); `wallet_transactions` già esiste, dormiente, RLS solo SELECT; RPC tutte/sole in book_lesson/cancel_booking; UNIQUE pieno su bookings da rendere parziale.

**Da verificare a inizio S8:**
- RLS attiva su `wallet_transactions`? `SELECT relname, relrowsecurity FROM pg_class WHERE relname='wallet_transactions';` (se false = ledger aperto, abilitare).
- Definire con Giorgia prezzi reali per disciplina + `credit_amount`/`validity_days` dei bundle.

**Tempi:** nessuna deadline; build a freddo, test/cutover dopo (anche prossima stagione).

**Backlog (passaggi dedicati):** posto fisso; push pre-scadenza + upsell; gift card; workshop UX; funnel pubblico build; migrazione saldi al cutover (oggi su cartellini di carta → inserimento manuale come tranche iniziali).

**Design spec:** `docs/DESIGN_wallet_model_S7.md`.

### 2026-06-26 — Sessione 8 — Build motore wallet in euro (DDL + RPC + test E2E)

**Obiettivo:** trasformare il booking engine da conta-lezioni a wallet in euro, secondo `docs/DESIGN_wallet_model_S7.md`.

**Stato di partenza (verificato, non assunto):** audit Fase 0 confermato sullo schema reale del 25/06. RLS già attiva su `wallet_transactions` (Task 1 chiuso: una sola policy SELECT, ledger blindato — write solo via RPC SECURITY DEFINER).

**Fase 1 — DDL (migration unica, transazionale, additiva):**
- `classes.price numeric NOT NULL DEFAULT 0`
- `schedules.price_override numeric NULL`
- `packages.credit_amount numeric NOT NULL DEFAULT 0`
- `client_packages` + `amount_initial`, `amount_remaining`, `late_cancel_used`
- `wallet_transactions` + `client_package_id`, `booking_id` (FK)
- Fix bug indice: droppato CONSTRAINT `bookings_client_id_schedule_id_key` (UNIQUE pieno) → creato indice parziale `bookings_active_uniq ON (client_id, schedule_id) WHERE status='confirmed'`. Sblocca book→cancel→rebook.
- Colonne vecchie (`credits`, `credits_total`, `credits_used`) NON droppate — DEPRECATE in transizione.

**Fase 2 — RPC riscritti (entrambi SECURITY DEFINER, search_path fissato):**
- `book_lesson`: prezzo = `coalesce(schedules.price_override, classes.price)` via join `class_id`; check saldo somma tranche vive; split-debit FIFO (oldest-first) su più tranche con scrittura ledger `type='debit'`; `bookings.client_package_id` non più popolato (LEGACY→NULL).
- `cancel_booking`: rimborso ripercorrendo le righe `debit` dal ledger (non più da `bookings.client_package_id`); rimborso solo a tranche ancora viva (§8.c: quota su tranche scaduta NON rimborsata); bonus late-cancel = Opzione B (ancorato alla tranche FIFO viva, check+mark sulla stessa riga); bonus consumato SOLO se almeno una quota realmente rimborsata (`v_any_refunded`); json `refunded` = rimborso reale, non eleggibilità.

**Decisioni chiuse:**
- Errore credito insufficiente: resta `no_credits` (retrocompatibilità frontend).
- Tassonomia ledger: usati valori esistenti del CHECK `'debit'`/`'refund'` (NON la tassonomia estesa del doc §3 — il CHECK reale ammette solo credit/debit/refund). Distinzione "addebito da prenotazione" via `booking_id IS NOT NULL`.
- Bonus late-cancel: 1 per ricarica/tranche (Opzione B).

**Feedback Giorgia integrati / registrati:**
- ✅ Finestra iscrizione min 12h prima → aggiunta a `book_lesson` (errore `booking_closed`, valore in variabile `v_min_booking_lead`).
- ✅ Cancellazione ≥24h per credito → già conforme, nessuna modifica.
- ⏳ S9+: minimo 2 persone → annullo+avviso; lezione vuota a 12h → annullo. Probabile cron unico a 12h prima (0→annulla, 1→annulla+avvisa, ≥2→conferma) — DA CONFERMARE. Richiede pg_cron + Edge Function + Resend. Apre necessità di un terzo tipo di rimborso "annullamento studio" (rimborsa sempre, ignora 24h/bonus).
- ⏳ S9+: Pixel Meta, CRM/advertising → layer frontend/marketing, intrecciato col funnel pubblico già a backlog.

**Test E2E (funzioni usa-e-getta, create/lanciate/droppate):**
- `_test_wallet_e2e`: split-debit, invariante §11, rimborso inverso, rebook su indice parziale → 12/12 pass.
- `_test_bonus_e2e`: bonus consumato, bonus esaurito, §8.c (flag non bruciato a vuoto) → 9/9 pass.
- Totale 21/21. Impersonazione via `set_config('request.jwt.claim.sub', ...)`. Entrambe le funzioni DROPPATE a fine sessione.
- NON coperto: concorrenza (protetta dai FOR UPDATE preservati, ma non testabile single-thread) → osservare nel dry-run luglio.

**Nuovi errori RPC per il frontend (da mappare a valle):** `booking_closed` (iscrizioni chiuse <12h), `price_not_set` (disciplina senza prezzo).

**Debito tecnico annotato:** `client_packages.credits_total` è ancora `integer NOT NULL` senza default — il futuro flusso "acquisto bundle" dovrà passare un valore fittizio (0) finché non si fa `DROP NOT NULL` sulle colonne legacy.

**GATE prima di andare live:** backfill `classes.price` con prezzi reali + definizione `credit_amount`/`validity_days` bundle. Finché `price=0`, ogni prenotazione è gratis → RPC nuovi NON attivi in produzione fino al backfill.

**Backfill COMPLETATO (26-06-2026):**
- `classes.price` popolato per 5 discipline: Matwork €16, Functional Pilates €16, Reformer €23, Yoga €18, MAM €20. MOTORE ACCESO (book_lesson scala credito reale).
- `packages`: 14 bundle creati e calibrati (metodo §4). price = prezzo nudo listino; credit_amount = lezioni × singola; validità 60/90/150/180gg. Bonus uniforme per taglia: €5/€20/€37,50/€60. Reformer 10 = UPDATE della riga preesistente (id cc296130), altri 13 = INSERT.
- Functional Pilates: stessi prezzi Matwork; usa i pacchetti Matwork (fungibilità, nessun bundle dedicato).
- `packages.credits` (legacy NOT NULL) popolato col numero lezioni come riferimento; non letto dagli RPC.

**Decisione modello — fungibilità piena CONFERMATA:** il credito euro è spendibile su qualsiasi disciplina; ogni prenotazione scala il prezzo della disciplina DELLA LEZIONE (coalesce(price_override, classes.price)), non del pacchetto. Abilita il cross-disciplina occasionale (es. cliente Reformer fa una Mat) senza far gestire conti a Giorgia. Buco di margine residuo limitato al solo bonus migrabile = trascurabile dato l'uso occasionale. Vincolo per disciplina (Opzione B) valutato e SCARTATO.

**Decisione bollo:** marca da bollo €2 sopra €77,47 NON inclusa in packages.price. Da gestire come regola automatica nel flusso di checkout (Stripe) + voce separata in fattura (Fatture in Cloud). Requisito registrato per quando si costruisce il pagamento.

**Stato motore:** acceso e calibrato, ma nessuna cliente ha ancora tranche euro (saldi reali da inserire a mano al cutover settembre, doc §9) → nessuno può prenotare finché non ha credito. Coerente con fase test.

**Prossimi blocchi (non in S8):**
1. UI admin gestione pacchetti — aggiungere campo credit_amount (la UI è pre-S8). Frontend / Claude Code.
2. Frontend cliente — mostrare saldo/tranche/scadenze nel profilo, costo in prenotazione, mappare errori booking_closed / price_not_set / no_credits. Frontend / Claude Code.
3. Bollo automatico nel checkout (con Stripe).
4. S9 — cron annullamento automatico (minimo 2 persone → annulla+avvisa; lezione vuota a 12h → annulla); probabile cron unico a 12h (DA CONFERMARE); apre terzo tipo di rimborso "annullamento studio". Pixel Meta + CRM.
5. Inserimento manuale tranche iniziali clienti al cutover (settembre).

### 2026-06-26 — Sessione 9 — UI admin pacchetti euro + brief cron sotto-soglia

**PUNTO 1 CHIUSO — Form admin pacchetti allineato al modello wallet euro (S7):**
- Commit `911dc86`, file unico `app/admin/pacchetti/PacchettiManager.tsx`.
- Aggiunto `credit_amount` (= credito totale erogato, base+bonus) a: type `Package`, `FormState`, `emptyForm`, `openEdit`, SELECT in `load()`, payload.
- Riga bonus read-only calcolata live: `credit_amount − price`, mostrata in € con `toFixed(2)` e in % a 1 decimale.
- Validazione submit: blocca se `credit_amount < price`.
- `credits` (legacy, conteggio lezioni interi) retrocesso a campo OPZIONALE con fallback `parseInt(...) || 0`; ri-etichettato "riferimento, non usato dal sistema". `credits` resta NOT NULL in DB.
- `validity_days` ri-etichettato "Scadenza tranche (giorni)".
- 3 test funzionali passati in produzione: (1) creazione con campo lezioni vuoto → `credits=0`, nessun crash NOT NULL; (2) bonus €16.67 (+50%) su prezzo 33.33 / credito 50, nessuna spazzatura float; (3) update non azzera `credit_amount` (payload condiviso insert+update verificato a vista).

**Decisioni di prodotto (S9):**
- UX form pacchetti: scelta **Opzione A** — Giorgia inserisce `price` + `credit_amount`, il form mostra il bonus derivato (non è una colonna). Scartata Opzione B (inserire bonus, calcolare `credit_amount`) per evitare trasformazioni tra input e storage su un campo che muove denaro.
- Pulizia colonna legacy `credits` (`DROP NOT NULL` o `DROP COLUMN`) RINVIATA alla finestra di migration rehearsal di agosto, non fatta mid-flight.

**Brief decisionale cron sotto-soglia** — preparato documento Word (`MeeToo_Decisione_Sotto-Soglia.docx`) da compilare con Giorgia.
- Regola base confermata: soglia 2 persone uguale per tutte le discipline, razionale economico (istruttore ≥25€/h + utenze).
- Caso "1 iscritta": tre vie d'uscita — A) cambio orario, B) conferma da sola con supplemento, C) riaccredito + riprenota. C è anche il default automatico se la cliente non sceglie.
- Punto critico isolato: la "finestra di scelta" (seconda soglia temporale nascosta) — quanto tempo ha la cliente per decidere tra A/B/C.
- Nota strategica: opzione B (supplemento) introduce un addebito extra che il wallet euro oggi NON gestisce e tocca le RPC di prenotazione → vale una sessione a sé. Valutare lancio settembre con solo A+C se B risulta "nice to have".

**Risk register / backlog UI (accumulato in S9 — nessuno blocca il lancio, tutti da chiudere prima di settembre):**
1. Form pacchetti si apre fuori viewport (in testa alla pagina) → Giorgia clicca Modifica e sembra non succeda nulla. Fix: `scrollIntoView` sul form all'apertura. Micro-task UI.
2. Mutation `packages` è insert/update diretto dal browser client su un campo che ora muove denaro (`credit_amount`). Verificare policy RLS WRITE scoped a studio-admin. Finestra hardening agosto.
3. Migrazioni S8 NON versionate (`credit_amount`, `classes.price`, `schedules.price_override`, `client_packages.amount_*`, `wallet_transactions.*` vivono solo in produzione, nessuna migrazione ≥26 giu nel repo). La prova di migrazione di agosto non riprodurrebbe lo schema euro. Recuperare in migrazione versionata. CUTOVER-KILLER se dimenticato.
4. Accessibilità form: 12 issue Chrome (label non collegate via `htmlFor`/`id`, input senza `id`/`name`). 0 errori, solo accessibilità. Fix meccanico batchabile su tutti i form, finestra polish pre-lancio.

## Sessione 10 — Motore sotto-soglia (SQL completo, in produzione, inerte)
- Decisioni Giorgia: soglia 2, check a T-12h, finestra 1h, C-auto come pavimento.
  Opzione A solo su lezioni ≥12h (nativo di book_lesson). Opzione B → fase Stripe.
- Tranche morta al rimborso: Opzione 1 (riattiva + proroga +30gg da now), NON tocca late_cancel_used.
- Regola confermata: CHECK SINGOLO a 12h (no ri-controllo se cala da 2 a 1 dopo).
- Migrazioni versionate + applicate + verificate:
  - 20260630094736_s10_subthreshold_foundation.sql (commit 440bc1e)
  - 20260630102720_s10_subthreshold_live.sql (commit 08a772d)
- Testato su Postgres 16 in sandbox prima del deploy.
- INERTE: cron NON schedulato. Funzioni esistono ma nessuno le chiama.
- Aperti: attivare pg_cron (con backfill subthreshold_checked sulle lezioni già imminenti),
  frontend (card decisione + mapping errori booking_closed/price_not_set/decision_*),
  push (VAPID, dopo test iPhone IT).

### Apprendimenti / campanelli (post-test opzione C)
- Maria Test (client_id c0432d65-9121-41d6-b882-23e46aca1c3d) NON ha credito euro:
  la tranche usata oggi era di test ed è stata rimossa a fine sessione. Per testare
  prenotazioni reali dal frontend serve accreditarla prima tramite l'admin.
- Prezzo reale di riferimento per i test: la lezione "Pilates Matwork" costa 16€
  (valore non tondo) — utile per verificare la specularità dei movimenti wallet.
- Campanello pre-settembre: il wallet euro di Maria a zero fa sospettare che molte
  clienti reali possano ritrovarsi col wallet euro vuoto dopo il passaggio al modello
  euro. Da verificare con Giorgia se le tranche esistenti sono state migrate al campo
  amount_remaining prima del cutover di settembre. Non bloccante ora, ma da chiudere
  prima del lancio.

## Sessione 11 — Blocco B (spostamento) + Blocco C (wallet euro profilo)
HEAD fine S11: `5dead34`. Commit: `7b8bc7b` (Blocco B), `5dead34` (Blocco C).

### Blocco B — Opzione A (spostamento) nella card sotto-soglia
- RPC `resolve_subthreshold_reschedule(p_decision_id, p_target_schedule_id)` → json,
  SECURITY DEFINER, chiamabile DIRETTA dal client (come il refund).
- Flusso interno: `refund_booking_full(originale)` → `is_cancelled=true` sull'originale
  → `book_lesson(target)`. ATOMICO: ogni fallimento di book_lesson è `raise exception`
  → rollback dell'intera transazione. Nessuno stato intermedio incoerente.
- Enforcement (≥12h, capienza, credito, prezzo) tutto dentro `book_lesson`. Il
  pre-filtro UI serve solo a UX (non offrire target che falliranno), non a sicurezza.
- Codici errore mappati (da book_lesson): full, booking_closed, already_booked,
  no_credits, schedule_cancelled, schedule_past, price_not_set + same_schedule.
- DECISIONI PRODOTTO (locked): filtro stessa `class_id` (no cross-disciplina a
  settembre); nessun prezzo nel selettore. Modello: A = scorciatoia stessa disciplina,
  C = valvola universale (+ default automatico alla scadenza).
- Filtro posti liberi (`current_bookings < max_spots`) NON esprimibile in PostgREST
  → fatto in JS dopo il fetch.
- Query target in page.tsx include `.eq('is_cancelled', false)`.
- GAP NOTO (non urgente): il fetch target non esclude lezioni dove la cliente è già
  iscritta (rete = errore `already_booked`).
- COPY FUTURO: quando targets è vuoto la card mostra solo "Annulla e riaccredita" —
  valutare riga "Nessuna lezione disponibile per lo spostamento".

### Blocco C — saldo wallet euro nel profilo
- BUG risolto: profilo mostrava `credits_total - credits_used` da client_packages —
  non "fermo" ma SBAGLIATO: book_lesson scala `amount_remaining`, non tocca mai
  credits_used. Il numero era scollegato dalla realtà.
- Sostituito con saldo euro = somma `amount_remaining` su tranche vive, STESSE
  condizioni di book_lesson (is_active, non scaduta, > 0). Aggiunto `.gt('amount_remaining', 0)`.
- VALUTA VERIFICATA: amount_remaining è in EURO interi con decimali (100 = 100€,
  addebito Matwork -16 non -1600) → nessun bug ×100. Formato it-IT con virgola OK (es. 84,50 €).
- `amount_initial` nel type/query ma non usato nel JSX → pulizia opzionale.
- Il profilo ora SMASCHERA i wallet euro vuoti invece di nasconderli → rende visibile
  il campanello "migrazione credito reale" prima del lancio.

### Migrazione credito reale (emerso in S11) — cantiere agosto
- NON inserimento manuale cliente per cliente (lento + pericoloso su campo denaro).
- Conversione una-tantum via SCRIPT (le lezioni residue legacy esistono ancora in
  client_packages: credits_total/credits_used).
- DECISIONE APERTA per Giorgia: formula lezioni→euro (valore storico pagato /
  prezzo corrente per disciplina / caso per caso su pacchetti misti).
- Da eseguire PRIMA di mettere il profilo davanti alle clienti reali (altrimenti €0,00
  corretto ma allarmante).

### Ricetta test riusabile (semina decisione pending)
- Credito: insert client_packages (package_id NOT NULL → riusa pacchetto esistente),
  amount_initial/amount_remaining.
- Schedule a now()+12h05 (book_lesson la accetta) → book_lesson → insert
  subthreshold_decisions (studio_id, schedule_id, booking_id, client_id, state='pending',
  bookings_at_check, detected_at, decision_deadline).
- Per Blocco B: aggiungere schedule target stessa class_id, is_cancelled=false ESPLICITO
  (altrimenti .eq('is_cancelled', false) non lo pesca), posti liberi.
- Marcatori pulizia: location 'TEST originale'/'TEST target', tranche con amount_initial=100.

### Manutenzione
- Project Guide CORRETTA: repo `meetoo_app` (underscore, non trattino — scoperto dal push),
  URL Supabase con `g` (lcyexugqinabjoinrsku), stack Next.js 16, fonte verità = CLAUDE.md.
- Master Doc pinnato contiene API key in chiaro (Supabase service_role + anon, Resend)
  → RIGENERARE + archiviare (finestra agosto). Il service_role bypassa l'RLS.
- Micro-pulizia futura: `grep credits_used` per stanare altri punti col conteggio legacy
  (probabile area admin).

## Sessione 12 — Attivazione pg_cron (step 1 di 2)
- S12 (2 luglio 2026) — Attivazione pg_cron, step 1 di 2.
- Audit read-only dei due sweep confermato: produzione == file S10
  (`20260630102720_s10_subthreshold_live.sql`), nessuna modifica a mano.
  detect: finestra `starts_at > now() AND <= now()+12h`, filtri
  `subthreshold_checked=false` e `is_cancelled=false`; soglie 0 (cancella +
  decisione `cancelled_empty`) / 1 (decisione `pending`, deadline +1h) / >=2
  (nessuna azione). deadline: agisce SOLO su `subthreshold_decisions` pending
  scadute, non riscansiona schedules.
- `subthreshold_decisions` verificata VUOTA. Nessuna pending scaduta → nessun
  rischio di refund automatico al primo giro di deadline.
- pg_cron 1.6.4 abilitato via dashboard (schema pg_catalog) e verificato
  dal DB. Schema cron interrogabile, `cron.job` = 0 righe. Nessun job ancora
  schedulato.
- BACKFILL NON eseguito: scelta deliberata. Con cron acceso su dati di test
  PRIMA che esistano prenotazioni reali, non c'è avvio-a-freddo-su-dati-caldi;
  vogliamo anzi che detect VEDA i dati di test. Il backfill torna rilevante
  SOLO se il free tier non tiene sveglio il progetto (vedi rischio sotto).
- schedules = solo dati di test, app non ancora in uso.
- Step 2 (prossima sessione, a incidente Supabase rientrato): esecuzione
  MANUALE singola di `sweep_subthreshold_detect()` e `sweep_subthreshold_deadline()`
  come ruolo postgres, per confermare che il ruolo li esegua nonostante le
  REVOKE (sono SECURITY DEFINER, owner postgres); poi i due `cron.schedule`
  (detect */10, deadline */5) in un blocco solo.

- RISCHIO NUOVO da verificare: free tier Supabase si mette in pausa su
  inattività. Un progetto in pausa NON esegue pg_cron. Da appurare
  empiricamente dopo lo scheduling via `cron.job_run_details`: buchi nelle
  ore di inattività = free tier insufficiente per un motore automatico
  T-12h/T-1h → decisione tier a pagamento prima di settembre. Se il tier
  non tiene sveglio, il backfill diventa necessario a ogni risveglio.
- CONTESTO OPERATIVO: attivazione fatta durante un incidente Supabase
  ("Project status change failures in multiple regions", running projects
  non impattati). CREATE EXTENSION non ha richiesto restart, quindi fuori
  dal raggio dell'incidente. Step 2 rimandato per non far girare logica di
  rimborso su infra dichiarata instabile.

### 2026-07-02 — Sessione 13 — Design landing pubblica: welcome animata + sistema logo (incremento 1)

- Welcome landing (app/page.tsx = root /, landing utente non-auth): ridisegnata con lockup brand animato. Cascata a battute — anelli convergono → wordmark sale → discipline → CTA. Easing unico cubic-bezier(0.16,1,0.3,1), durate 400–600ms, nessun bounce.
- Progressive enhancement (nuovo app/WelcomeChoreography.tsx): contenuto di default VISIBILE (no opacity:0 nel DOM); animazione = enhancement via useLayoutEffect al mount. sessionStorage 'mt_welcome_seen' → coreografia una volta per sessione, poi stato finale istantaneo. reduced-motion → solo dissolvenza. Keyframes in globals.css sotto [data-mt-animate="play"].
- Mark ad anelli (due cerchi, dalla "OO" di TOO): due <circle> inline separati per convergenza indipendente. Asset public/brand/meetoo-mark.svg.
- Wordmark: da PNG ricolorato → SVG VETTORIALE (public/brand/meetoo-wordmark.svg + app/WordmarkMeeToo.tsx inline, fill="currentColor" = token text-meetoo-accent-dark). Risolti insieme nitidezza (raster→vettore, ok su display 3×) e micro-scarto di colore su mobile.
- Multi-disciplina: rimossa "PILATES" dal lockup della landing; eyebrow "Studio Pilates & Yoga" sostituita dal descrittore PILATES · YOGA · MINDFULNESS (tracking 0.12em, 11px, entro la larghezza del wordmark). Tagline "Ritrova il tuo equilibrio…" → hidden md:block (solo desktop, resta nel DOM per SEO).
- CTA "Entra" → /registrati; link "Hai già un account? Accedi" → /login. h1 sr-only → "Mee Too — Pilates, Yoga, Mindfulness".
- Recuperato il file vettoriale originale del logo: public/brand/MEE TOO LOGO.svg (sorgente, solo "MEE TOO"). Rimosso PNG orfano meetoo-wordmark-dark.png.
- Commit: bd0e4b1 (welcome), aef361f (wordmark SVG + multi-disciplina), 17a5940 (rifiniture mobile).
- Learning: il preview SVG di VS Code è più severo del browser (fallisce su clipPath/matrix annidate) → la verità è solo nel browser. Anelli tenuti separati dal wordmark per animarli in modo indipendente. File con spazi nel nome (MEE TOO LOGO.svg) da sorvegliare in build Vercel (Linux).

### Backlog — aggiunte dalla Sessione 13

- **Incremento 2 — sistema logo su tutta l'app**. Ordine:
  1) favicon + icona PWA maskable (dagli anelli) in layout.tsx → vale per tutte le pagine.
  2) componente <Logo> riutilizzabile, 3 varianti (lockup completo / inline / solo-mark).
  3) applicazione per priorità: prima login + pagine pubbliche (impressione brand per le testers), poi header admin e area cliente.
  Decidere a monte la proporzione mark/wordmark (mark un filo piccolo). Usare gli SVG già in public/brand/.
- **Vista giornaliera palinsesto** (admin/istruttori): interno, non launch-blocking. Trigger: dopo S12 (pg_cron) + wallet frontend. Sessione a sé.
- **Cliente vede le altre prenotate**: bloccata su decisione privacy di Giorgia (nome+iniziale / opt-in / solo numero). Trigger: quando decide → accorpare alla verifica RLS packages. Se non decisa entro agosto → post-lancio.
- **Tipo prenotazione appuntamento 1:1 (nutrizionista)**: modello attuale solo classi di gruppo (max_spots). Trigger: quando Giorgia vuole vendere consulenze in app.
- **Decisione posizionamento brand**: la landing anticipa il multi-disciplina (logo senza PILATES); il logo master con PILATES esiste ancora → scelta "Mee Too" ombrello vs "Mee Too Pilates" da chiudere con Giorgia.
- **Nota doc**: la Project Guide cita Next.js 14, ma il progetto gira su Next.js 16.2.6 → allineare la guida.
- **Da verificare sul telefono reale**: margine sotto "Accedi" su mobile (mt-24; se troppo → mt-20/mt-16).

## S14 — incremento 2 (sistema logo), BLOCCO 1: favicon + PWA icons + manifest ✅

Commit f3fb486 su main (9 file, +107). Deploy Vercel Ready, validato in produzione.

Decisioni bloccate:
- Fonte canonica mark = componente <Mark> (circle JSX, currentColor, className per animazione), NON il file .svg [DA CREARE nel blocco successivo]
- Mark monocromatico via currentColor (no bicromia); bicromia+convergenza solo nella welcome
- Geometria favicon DEDICATA (diversa dal lockup): centri 1.35×r, stroke 0.35×r, fondo pieno #f5f0e8 — leggibilità 16-32px
- Due master separati in public/brand/: meetoo-favicon.svg (tab ~90% canvas), meetoo-maskable.svg (PWA safe-zone 80%)
- theme_color + background_color = #f5f0e8 (audit-based: top-viewport chiaro ovunque tranne admin-mobile)
- Raster single-source via scripts/generate-icons.mjs (sharp + png-to-ico), eseguito offline, raster committati statici. sharp NON in package.json

File aggiunti: app/icon.svg, app/apple-icon.png (180), app/favicon.ico (16/32/48, sostituisce default Next), public/icon-{192,512}.png (any), public/icon-maskable-{192,512}.png (maskable), app/manifest.ts, scripts/generate-icons.mjs

Validato in browser: favicon tab OK, manifest servito in prod OK, maskable in safe-zone OK, apple-icon home iPhone OK (alone inferiore = ombra iOS, non difetto file)

APERTO / prossimo blocco:
- Componente <Logo> a 3 varianti (mark/wordmark/lockup) che compone WordmarkMeeToo + <Mark>
- SCARTO STROKE ANELLI: nella welcome gli anelli sono ~metà del peso delle lettere MEE TOO. Fix ancorato al fianco-O della wordmark (~18u nel suo viewBox); valore reso dipende dalla proporzione mark-nel-lockup, da definire. Kickoff: proporzione mark → stroke canonico → <Mark> → <Logo>
- Mark responsive in lockstep con wordmark (un solo stroke per tutti i breakpoint)

PARCHEGGIATO:
- Service worker / installabilità PWA reale (manca; "Aggiungi a Home" iOS ok ma no prompt install) + campo screenshots nel manifest
- Pulizia public/: rimuovere file.svg, globe.svg, next.svg, vercel.svg (default create-next-app), commit separato

## S15 — Dev environment & CLI workflow (9 lug 2026)

**Obiettivo:** ridurre il lavoro manuale (copia/incolla chat→Code, SQL Editor a mano) dando a Code autonomia su un ambiente dev separato, con la produzione protetta dietro migration versionate.

**Assetto adottato:**
- Nuovo progetto Supabase **MeeToo_Dev** (free, ref `szxnyjosyiyqkgeqpzxh`, region Ireland) come ambiente dev usa-e-getta. Prod (`MeeToo_Pilates`, ref `lcyexugqinabjoinrsku`) resta intatta.
- Supabase CLI installata via **brew** (globale, non in package.json), v2.109.1. Login CLI fatto (token account-level tenuto lato Peps, MAI passato a Code).
- **Docker Desktop** installato (necessario per `db dump`/`db pull`). Sblocca in futuro anche il dev in locale (→ eliminazione hotspot/auto-pausa dal quotidiano).
- Confermato: **prod gira su Postgres 17** (`major_version=17` in config.toml è corretto).

**Baseline schema:**
- `supabase db dump --linked` da prod → `supabase/migrations/20260709103000_baseline_prod_schema.sql` (1749 righe: 17 tabelle, 10 funzioni, 35 policy, indici, constraint. Solo struttura, nessun dato/ruolo custom).
- **Opzione A** (flatten storico): baseline = fonte unica; le 6 migration pre-S10 spostate in `supabase/migrations-archive/` (fuori dalla catena CLI).
- `db push` sul **dev** riuscito: dev ora rispecchia prod (verificato in Table Editor). Warning `pg-delta` in fase di caching = rumore innocuo, schema applicato correttamente.
- Commit: `a7136fe` (config CLI) + `e908b0c` (baseline + archivio). Working tree pulito, 2 commit avanti su origin (non ancora pushati).

**Divisione ruoli confermata:** Code autonomo su dev; Peps fa login/auth e comandi che toccano prod; scritture prod solo via migration, mai via MCP/autonomia diretta.

**Open item (in agenda, gated):**
1. **Trigger signup mancante nel dev:** `handle_new_user` presente ma il trigger su `auth.users` (es. `on_auth_user_created`) non è nel dump (il pull esporta solo schema `public`). Da ricreare con migration + verifica sul dev. Senza, il signup non popola `profiles`.
2. **Riconciliazione cronologia migrazioni su PROD:** prod ha applicato i timestamp di giugno ma non il baseline. Serve `supabase migration repair` per marcare il baseline come già applicato su prod, così non venga rieseguito lì. Da fare con calma, un comando guidato, quando pronti. Tocca prod → hotspot + massima cautela.

## S16 — Trigger signup + seed tenant-radice sul dev (9 lug 2026)

**Obiettivo:** chiudere l'open item S16.1 (trigger signup mancante sul dev) e rendere la catena signup riproducibile in ogni ambiente ricostruito da zero.

**Workflow dev/prod attivato:**
- **MeeToo_Dev** (ref `szxnyjosyiyqkgeqpzxh`) rispecchia **prod** (`MeeToo_Pilates`, ref `lcyexugqinabjoinrsku`) via baseline versionato. Scritture su prod SOLO via migration. Code autonomo sul dev; Peps fa login/auth e comandi verso prod.

**Trigger `on_auth_user_created` ricreato sul dev:**
- Il baseline S15 (dump del solo schema `public`) NON includeva i trigger su `auth.users` → il signup non popolava `profiles`.
- Migration idempotente (`drop trigger if exists` + `create`) con nome funzione qualificato (`public.handle_new_user`). File: `supabase/migrations/20260709110000_recreate_on_auth_user_created_trigger.sql`.
- Prima di procedere: verificata la def di `public.handle_new_user` sul dev **IDENTICA a prod** (`pg_get_functiondef`), per escludere drift dal baseline.

**Seed tenant-radice versionato:**
- Creato `supabase/seed.sql` col tenant-radice (studio Mee Too), id hardcoded **IDENTICO a prod** (`58b3d7bb-ada6-4818-b80e-0e45acdafb43`). Insert idempotente (`on conflict (id) do nothing`), solo campi valorizzati (id, name, slug, email).
- Ragione: ogni ambiente ricostruito da zero (dev usa-e-getta, rehearsal di agosto) nasce col tenant giusto e il trigger popola `profiles.studio_id` via lookup `slug='meetoo'`. NON è comodità: è **coerenza dev/prod sul dato fondante** del sistema single-tenant.
- Applicato sul dev via `supabase db query --linked --file supabase/seed.sql` (NO `db reset`, per non azzerare lo stato del dev). Solo dev, nessun comando verso prod.

**Validazione catena signup end-to-end (dev):**
- `INSERT auth.users` → trigger → profilo creato con `studio_id = 58b3d7bb-…-fb43` (**NON null**), `role='client'`.
- Test in transazione con **ROLLBACK**: nessun artefatto residuo (auth.users 0 / profiles 0 dopo il rollback).
- `pg_trigger` conferma l'oggetto, ma il ground truth è il **profilo creato correttamente** con lo studio_id giusto.

**GATED / non fatto in S16:**
- **Riconciliazione cronologia migrazioni su prod** (`supabase migration repair`): comando guidato, richiede hotspot, da fare separatamente (già open item S15.2).

### Risk register / open items (aggiunto in S16)
- **`profiles.studio_id` è NULLABLE** (dev e prod). Combinato con l'`EXCEPTION WHEN OTHERS` dentro `handle_new_user` (inghiotte gli errori e fa `RETURN NEW`), se il seed `studios` mancasse in un ambiente il signup creerebbe profili **ORFANI con `studio_id=NULL`, silenziosamente**. Oggi tappato dal seed sul dev. **Trigger di resolution:** valutare `profiles.studio_id NOT NULL` durante la finestra di rehearsal di agosto (rende l'errore rumoroso invece che muto).

## S17 — Sistema `<Logo>` (DESIGN) (9 lug 2026)

**Creato il sistema `<Logo>` del brand Mee Too.** Committato `0db052c` su main. Due file nuovi:
- `app/Mark.tsx` — mark canonico (due `<circle>`, single source of truth), export **nominato** `Mark`.
- `app/Logo.tsx` — composizione mark + wordmark, export **nominato** `Logo` (compone `WordmarkMeeToo` default + `{ Mark }`).

**API FINALE di `<Logo>` (nient'altro):**
- `variant?: 'full' | 'mark' | 'compact'` (default `'full'`) — asse FORMATO.
- `descriptor?: string` — asse ORTOGONALE (prop, NON varianti hardcoded). Renderizzato SOLO da `variant='full'`; ignorato silenziosamente su `'mark'`/`'compact'`. **Una singola disciplina per volta** (decisione brand Giorgia), non liste. Layout a tracking fisso + centrato, pensato per lunghezza variabile (4→11 lettere).
- `label?: string` — nome accessibile.
- `className?: string` — sul root (colore, taglia, opt-in animazione).

**Taglia — sorgente unica:** guidata dalla CSS var `--mt-logo-w` sul consumer (fallback 240px). Mark, gap e descrittore derivano TUTTI da W via `calc()` → lockstep responsive con un solo valore, senza width per-breakpoint sul mark.

**Valori bakati** (in `TUNE` di Logo.tsx / default di `<Mark>`): stroke anelli **9**, `descTracking` **0.32em**, `descWeight` **600**, `descGap` **0.06**, `descFont` **0.046**, `fullMarkGap` **0.076**, `compactGap` **0.15**, `MARK_RATIO` **0.499** (strutturale).

**a11y unificata:** `<Logo>` è decorativo di default (root `aria-hidden`); con prop `label` → root `role="img"` + `aria-label`, contenuto interno decorativo. **Sana la divergenza** trovata in audit tra `meetoo-mark.svg` (aveva `role="img"`) e la copia inline della welcome (`aria-hidden`).

**Verificato in browser** (localhost) su tutte le variant + descrittori PILATES / YOGA / MINDFULNESS. Font **Inter confermato risolto** (next/font).

**NOTA STATO:** `<Logo>` NON è ancora consumato da nessuna pagina — la welcome usa ancora i `<circle>` inline. Applicazione a login / pagine pubbliche = prossima sessione (poi admin / client).

### DECISIONE CRITICA — stroke anelli = 9, NON ripristinare 18.234
- Lo stroke canonico degli anelli è **9** (filo fine). Questo **SUPERA DELIBERATAMENTE** la parità geometrica **18.234u** (fianco-O) ancorata in S14: corretta come geometria ma otticamente **troppo pesante e "appiccicata"**. Scelta a occhio dal designer, **browser = ground truth**.
- **NON ripristinare 18.234** "riparando" all'indietro verso la parità geometrica: è una regressione, non un fix.
- Il diametro esterno (**85.172**) e l'**interlock** restano invarianti perché **r è derivato dallo stroke**: `r = 42.586 - strokeWidth/2`.
- La prop `strokeWidth` resta esposta su `<Mark>` per contesti che richiedono un peso diverso (es. favicon — che ha comunque geometria dedicata separata, già shippata).

## S18 — Applicazione sistema `<Logo>` a welcome e auth (13 lug 2026)

**`<Logo>` smette di essere un componente sullo scaffale e diventa il brand reso.** Due commit su main: `a23c5d2` (welcome), `c3b5bda` (auth).

### Welcome (`a23c5d2`)
- Il lockup ad-hoc (svg inline con due `<circle>` + div wordmark) è sostituito da `<Logo variant="full">`, taglia **240px mobile / 300px da `md`** via `--mt-logo-w`. Rimosso l'import ormai inutile di `WordmarkMeeToo` dalla pagina.
- **Coreografia ricablata sugli hook del componente:** battuta 1 → `.mt-mark-ring-left/right` (i `<circle>` del `<Mark>`), battuta 2 → `.mt-logo-wordmark`. Hook nuovi aggiunti in `Logo.tsx` sui container della variant `'full'`: `mt-logo-wordmark` + `mt-logo-descriptor` (solo classi, nessuna prop nuova, API invariata).
- **Perché le regole CSS di questi hook dichiarano da sé `animation-timing-function` e `animation-fill-mode`:** gli elementi vivono dentro `<Logo>`/`<Mark>` e NON portano la classe `.mt-anim`, che è ciò che prima forniva easing e fill-mode a tutti. Chi tocca queste regole non le deduplichi "spostando tutto su `.mt-anim`": il componente non ha quella classe.
- **Override `prefers-reduced-motion` esteso esplicitamente ai nuovi hook.** Il blocco reduced-motion selezionava solo `.mt-anim`: senza l'estensione, anelli e wordmark avrebbero continuato a **traslare anche in reduced-motion** — esattamente il bug che quel blocco esiste per prevenire.
- Nomi dei `@keyframes` (`mt-ring-left/right`, `mt-rise`, `mt-fade`), delay e durate: **invariati**. `.mt-copy`/`.mt-cta`/`.mt-login` intatte. `WelcomeChoreography.tsx` e `Mark.tsx` non toccati.

### DECISIONE BRAND — tripletta discipline ELIMINATA dalla welcome
Il `<p>` "PILATES · YOGA · MINDFULNESS" sotto il wordmark è stato **rimosso, non spostato**. Coerenza con la decisione Giorgia di S17: il descrittore è **una disciplina singola per volta**, e compare **solo nelle sezioni dedicate** — non come lista nel lockup di apertura. Le keyword non si perdono per SEO/GEO: restano nell'`h1` sr-only della welcome (che resta comunque da rivedere per la chiarezza-entità GEO, vedi "Decisioni di design").

### Auth (`c3b5bda`)
- Login e registrati: il blocco brand testuale (eyebrow `<p>` "Studio Pilates & Yoga" + `<h1>` "MEE TOO") è sostituito da `<Logo variant="full">` a **180px**. L'eyebrow è **eliminata**, non riposizionata.
- **`h1` sr-only per pagina** — "Accedi a Mee Too" / "Registrati su Mee Too": il `<Logo>` è decorativo (`aria-hidden` di default, path muto), quindi il nome accessibile lo porta l'intestazione. Il titolo della card resta `<h2>` → gerarchia h1→h2 pulita su ogni schermata.
- **Stato success di registrati ora brandizzato**: prima non aveva alcun brand e apriva con un `<h2>` orfano (nessun `h1` in pagina). Ora ha `h1` sr-only + lockup sopra la card di conferma.
- **Gerarchia taglie deliberata: welcome 240/300 > auth 180.** La welcome è la prima impressione, le auth sono già dentro il funnel: il logo scala giù.
- Nessuna modifica a form, logica submit, gestione errori, redirect. Nessuna animazione sulle auth (niente `WelcomeChoreography`): il logo è statico.

### TRADE-OFF NOTO — NON "RIPARARE"
Sulla welcome c'è un **flash di ~100ms**: il contenuto è visibile in posizione finale, poi l'animazione lo riporta a zero e lo rigioca. È il **costo strutturale del progressive enhancement scelto in S13** (contenuto visibile di default nel DOM, play al mount via `useLayoutEffect`). L'alternativa — nascondere tutto finché non parte il JS — dà **schermo vuoto su rete lenta**: peggio. Il comportamento è **identico a prima di S18**: non è una regressione introdotta dal `<Logo>`.

### Validazioni
- **Browser locale**: coreografia campionata frame per frame (anelli in convergenza (primo frame campionato ±10.3px; keyframe da ±13px) → 0 in ~0.7s, opacity 0.21→1; wordmark rise da `translateY 11px` a partire da ~0.5s, chiude ~1.05s; easing `cubic-bezier(0.16,1,0.3,1)` su entrambi). Reduced-motion confermato: entrambi passano a `mt-fade` con `transform: none`. Stato success di registrati ispezionato via DevTools. Zero errori console su tutte le schermate.
- **Produzione Vercel**: verificata — gli hook (`mt-mark-ring-*`, `mt-logo-wordmark`) sono presenti nell'HTML servito.

### Kickoff S19 — header admin e area cliente su `<Logo>`
Perimetro già mappato:
1. **Sidebar admin** (`AdminNav.tsx`): eyebrow "Pannello Admin" + `h1` "MEE TOO", **bianco su fondo scuro** → **primo test del mark in negativo**.
2. **Top bar mobile admin** (stesso file): candidata a `variant="mark"` da solo — a quella taglia il wordmark è illeggibile.
3. **Header dashboard cliente**: eyebrow + `h1`.

È il **primo consumo reale della variant `'compact'`** → serve una validazione ottica dedicata (in `'compact'` il mark sborda un filo sopra le lettere, scelta di design commentata in Logo.tsx (S17)).

## S19 — `<Logo>` su AdminNav e dashboard cliente (13 lug 2026)

Due commit su main: **AdminNav** (`a848be8` — sidebar `'full'` + top bar mobile `'mark'`) e **dashboard cliente** (`9745862` — header `'compact'`). **Primo test del mark in NEGATIVO** (bianco su `bg-meetoo-accent-dark`): **validato**, lo stroke 9 resta leggibile a tutte le taglie in uso.

### AdminNav — sidebar
- `<Logo variant="full">`, `text-white`, `--mt-logo-w` **120px mobile / 132px da `md`**.
- **DECISIONE DESIGN — il kickoff prevedeva `'compact'`, ROVESCIATA in browser.** Nel `'compact'` il wordmark parte **~57px indentato** rispetto al bordo sinistro (è il mark a occupare quella colonna), finendo **fuori asse** rispetto al ritmo verticale di eyebrow e voci nav, tutte allineate a `px-6`. Il `'full'` riporta il wordmark **a filo sinistro** e replica il lockup già visto su welcome/auth. **Browser = ground truth**, come in S14 e S17.
- Eyebrow "Pannello Admin" spostata **SOTTO** il logo, `mt-5` (**20px**): lo spazio *fuori* dal lockup deve **superare il gap interno mark–wordmark** (~10px), altrimenti l'eyebrow si legge come **terza riga del logo** invece che come contesto funzionale.

### AdminNav — top bar mobile
- `<Logo variant="mark">` da solo, `--mt-logo-w:56px` (mark reso **~28px**). A quella taglia il wordmark sarebbe illeggibile. Lo `<span>` `activeLabel` a destra resta invariato.

### SANATO — doppio `h1` nelle pagine admin
L'`h1` "MEE TOO" della sidebar è **rimosso e NON sostituito** (nemmeno da uno sr-only): ogni pagina admin ha **già il proprio `h1`**. Prima ce n'erano **due per pagina** — la sidebar è cornice, non contenuto.

### Dashboard cliente (`app/dashboard/page.tsx`)
- **Primo consumo reale di `variant='compact'`**, nel suo contesto giusto: riga orizzontale con il bottone logout a destra. `text-meetoo-accent-dark`, `--mt-logo-w` **96px mobile / 112px da `sm`**.
- Eyebrow "Studio Pilates & Yoga" **ELIMINATA**, non riposizionata (coerenza con la decisione brand S18).
- **`h1` sr-only "La tua area Mee Too"** come primo figlio del `<main>`: il `<Logo>` è decorativo (path muto, `aria-hidden` di default) → il nome accessibile della pagina lo porta l'intestazione.
- Header da `items-start` a **`items-center`**: baricentro ottico tra logo e bottone.

### Gerarchia taglie — CONSOLIDATA
**welcome 240/300 > auth 180 > admin sidebar 120/132 > dashboard cliente 96/112 > top bar mobile 56.** Il logo **scala giù man mano che si entra nel prodotto**: massimo alla prima impressione, minimo dentro la navigazione quotidiana.

### Validazioni
Browser locale desktop + DevTools mobile 390px: top bar, drawer aperto **senza collisione logo/X**, focus management invariato.

### Risk register / open items (aggiunti in S19)
- **CRITICO — `.env.local` locale punta a PRODUZIONE** (`lcyexugqinabjoinrsku`), **non** a MeeToo_Dev (`szxnyjosyiyqkgeqpzxh`). Rilevato in console durante S19. **Da correggere PRIMA di qualsiasi sessione con scritture dati**: finché resta così, ogni test manuale in locale **tocca dati veri**.
- **Due errori 400** su chiamate Supabase in `/admin/clienti` (rilevati con l'env puntato a prod). Da triagiare **DOPO** lo switch dell'env: potrebbero dipendere dal mismatch di ambiente.

### Kickoff S20
1. **Fix `.env.local` → MeeToo_Dev** + riavvio dev server + verifica login.
2. **Triage dei due 400** su `/admin/clienti` a env corretto.
3. Se puliti: si apre il fronte **wallet frontend** (saldo + tranche + scadenze sul profilo cliente) — richiede **hotspot** + resume del progetto dev.

## S20 — 14 luglio 2026 · Env fix, triage 400, dev popolato, prezzo lezione

### Fatto
1. **FIX CRITICO — `.env.local` → MeeToo_Dev.** Il file (fermo al 17/6)
   puntava a produzione: ogni test locale scriveva su dati veri. Riscritto
   via heredoc con URL/anon/service_role di dev, verificato a runtime
   (Request URL = szxnyjosyiyqkgeqpzxh). Nota: la service_role di PROD
   viveva anche in questo file locale — rafforza l'urgenza della
   rigenerazione chiavi di agosto.
2. **Utenti dev creati via flusso reale** (registrazione app, non dashboard):
   - Maria Test client: `d79404a4-fa3c-4139-87aa-de2dc207e04c` (≠ id prod)
   - `mat_peps@hotmail.it` admin (promosso via UPDATE su profiles)
   - Trigger `handle_new_user` VERIFICATO su dev: studio_id valorizzato,
     zero orfani.
3. **Triage 400 su /admin/clienti: CHIUSO.** A env corretto, zero errori —
   erano figli del mismatch ambiente. Riserva: dev ha 1 cliente, se erano
   data-dependent non riproducibili qui; si riapre solo se ricompaiono.
4. **Wallet frontend saldo+tranche+scadenze: GIÀ ESISTENTE e ora VALIDATO**
   con dati (2 tranche, saldo 208€, ordinamento per scadenza ok). Backlog
   era stale. Error codes IT già mappati (DecisionCard, palinsesto).
   Restava solo il prezzo.
5. **feat: costo lezione su card palinsesto** — select estesa
   (price_override + classes.price), prezzo effettivo
   `price_override ?? classes.price`, nascosto se null/≤0 (backend gestisce
   price_not_set). Validati entrambi i rami in browser (16€ base /
   20€ override).
6. **Seed di test su dev** (SQL manuale, non in seed.sql): 1 pacchetto,
   2 tranche per Maria Test, 1 classe Pilates Matwork 16€, 3 schedules
   (1 con override 20€).

### Note
- `date_trunc('day', now())` in SQL è UTC; UI renderizza Europe/Rome (+2).
  Irrilevante per test, promemoria per creazione lezioni reali.

### Kickoff S21
1. **Storico movimenti wallet** sul profilo cliente (`wallet_transactions`,
   oggi non consumata da nessun file frontend) — richiede seed movimenti
   su dev.
2. Poi in coda: verifica pg_cron su dev (`cron.job_run_details`) — status
   scheduling ancora non confermato da S12.

## S21 — 14 luglio 2026 · Storico movimenti wallet + pg_cron attivato su dev

### Fatto
1. **Seed 12 movimenti wallet su dev** per Maria Test (SQL manuale, NON in
   seed.sql). **SCOPERTA:** le tranche seminate in S20 erano nate con 112€
   di consumo pregresso **senza righe a ledger** (residuo 32 su iniziale
   160) → l'estratto conto non poteva quadrare col saldo. Sanato con 7
   debit retrodatati da 16€ (giu–lug). **Quadratura verificata: somma
   ledger = saldo tranche = 192€.**
   **PRINCIPIO:** il ledger deve raccontare il saldo, anche nei dati di
   test — un estratto conto che non quadra è un bug percepito.
2. **feat(profilo): sezione "Movimenti"** (`d5970b7`) tra "I miei
   pacchetti" e "Storico prenotazioni" in `app/profilo/page.tsx`. Server
   component puro (zero 'use client'), ultimi 10 da `wallet_transactions`
   (RLS `client_id = auth.uid()` già in piedi, nessuna policy nuova).
3. **pg_cron su dev: ATTIVATO.** `cron.job` era **VUOTO** — le
   `cron.schedule` di S12 non erano **mai state eseguite** (rimandate per
   l'incident Supabase e mai riprese). **Non era auto-pause del free tier**
   (i job non erano mai esistiti, quindi il tier non era mai stato messo
   alla prova). La domanda S12 — la pausa congela i job tra le sessioni? —
   resta APERTA: si legge domattina in `cron.job_run_details` (buco
   notturno = tier insufficiente). Test manuale delle due sweep prima
   di schedulare (0/0, nessun errore), poi:
   `sweep-subthreshold-detect` **\*/10**, `sweep-subthreshold-deadline`
   **\*/5**, entrambi `active`. Prime run confermate via
   `cron.job_run_details`.

### DECISIONI DESIGN — sezione Movimenti
- **Niente verde/rosso semantico.** La palette è a 4 toni caldi: un semaforo
  ci entrerebbe come corpo estraneo. La gerarchia entrate/uscite è resa dal
  **peso** (`font-semibold` entrate / `font-light` uscite), non dal colore.
- **Il segno è comandato da `amount >= 0`, NON dal `type`.** Conseguenza
  voluta: un `refund` (positivo) mostra **+**. Il type dice *perché*,
  l'importo dice *da che parte va il denaro*.
- **Convenzione di segno verificata sul baseline**, non assunta: le funzioni
  di prenotazione scrivono i `debit` **già negativi**.
- Segno meno **tipografico U+2212** (non hyphen) + `tabular-nums` per
  l'allineamento in colonna delle cifre.

### Validazione
- Desktop: 12 movimenti reali a DB, `limit 10` taglia correttamente i 2 più
  vecchi; refund **+20,00 €** reso in semibold.
- **Empty state** provato via login **admin** su `/profilo` (URL diretto):
  la pagina non ha role-gating, l'RLS filtra per uid → **doppia conferma
  dell'isolamento dati** oltre allo stato vuoto.
- Mobile 390px: layout ok.

### Risk register / open items (aggiornati in S21)
- **pg_cron su PRODUZIONE ancora da schedulare** (su dev è fatto). Da fare
  nel **rito di agosto**, insieme a `migration repair` e rigenerazione
  chiavi.
- **`/profilo` senza role-gating esplicito lato pagina** — innocuo (l'RLS
  copre, verificato), ma un admin ci atterra su un profilo vuoto anziché
  essere rediretto → backlog polish.
- **Raggruppamento movimenti per `booking_id`**: un debit split su più
  tranche produce più righe a ledger per la stessa prenotazione → in futuro
  aggregarle in una riga sola. Backlog polish.
- **DA VERIFICARE — il rischio "migrazioni S8 non versionate" (S9, punto 3)
  potrebbe essere STALE:** il baseline `20260709103000_baseline_prod_schema.sql`
  è un dump completo di prod e dovrebbe **già contenere** `credit_amount`,
  `classes.price`, `schedules.price_override`, `client_packages.amount_*`.
  Check in apertura S22 (grep sul baseline): se confermato, il rischio si
  chiude senza lavoro.

### Kickoff S22
1. **Vista giornaliera palinsesto** per admin/istruttori — il trigger a
   backlog (S13) è **soddisfatto**: pg_cron e wallet frontend sono completi.
2. **In apertura:** (a) `cron.job_run_details` su dev — verificare la
   continuità notturna dei job (domanda S12, buco notturno = tier
   insufficiente); (b) verifica staleness del rischio S8 (grep sul
   baseline).

## S22 — 15 luglio 2026 · Agenda giornaliera role-aware + continuità pg_cron verificata

### Apertura
- **(a) Continuità notturna pg_cron VERIFICATA** via `cron.job_run_details`
  su dev: serie **14/07 19:00 → 15/07 14:00 UTC senza buchi**, 12 run/ora
  per `deadline` (*/5) e 6/ora per `detect` (*/10), **zero falliti**. La
  domanda aperta da S12 — la pausa da inattività congela i job tra le
  sessioni? — è **chiusa in positivo**: il free tier ha tenuto sveglio il
  progetto per l'intera notte. **Caveat a registro:** NON è stata testata
  la pausa da inattività **prolungata** (~7gg) — irrilevante per prod (avrà
  traffico reale che tiene sveglio il progetto). **pg_cron su PROD resta da
  schedulare nel rito di agosto.**
- **(b) Rischio "migrazioni S8 non versionate" (S9, punto 3) ARCHIVIATO come
  stale.** Verificato a grep che il baseline
  `20260709103000_baseline_prod_schema.sql` contiene già `credit_amount`,
  `classes.price`, `schedules.price_override`,
  `client_packages.amount_initial`/`amount_remaining` e
  `wallet_transactions` col CHECK completo. Il dump di prod di S15 aveva già
  assorbito lo schema euro → nessun lavoro di recupero, rischio chiuso.

### Feature `/agenda` (`2e95af2`)
- **Layout server di gating** (`app/agenda/layout.tsx`): legge `profiles.role`,
  ammette `admin` e `instructor`, altrimenti `redirect('/dashboard')`
  (anonimo → `/login`). Specchia `app/admin/layout.tsx`.
- **Vista giornaliera** (`app/agenda/page.tsx`, client component): giorno
  selezionato (default oggi, tz locale) con navigazione **← Oggi →**; query
  `schedules` sul range `[00:00, 24:00)` locale convertito in ISO, filtro
  `studio_id`, ordine `starts_at`, con embed classi/istruttrice/bookings.
- **Conteggio confermati calcolato dalle `bookings`** (status `confirmed`),
  **NON dal counter `current_bookings`** — l'agenda è la vista operativa di
  verità. Le `cancelled` non si mostrano mai.
- **Liste confermati e waitlist ordinate per `booked_at`** crescente prima
  della numerazione; waitlist resa visivamente distinta (blocco tratteggiato).
- **Filtro `instructor_id = uid` per le istruttrici** (l'admin vede tutte le
  lezioni); enforcement lato query, non solo UI.
- `destination.ts` instrada `instructor` → `/agenda` (admin → `/admin`,
  default → `/dashboard`). Voce **"Agenda"** aggiunta in `AdminNav`. Link
  **"← Home" solo per admin** (verso `/admin/dashboard`); per l'istruttrice
  il pulsante non compare.
- **Validata in browser su entrambi i ruoli**, mobile 390px ok.

### SCOPERTA DI SESSIONE — account istruttrice inaccessibili
- Il CRUD admin istruttori **crea già veri account auth** (server action con
  service role, password temporanea casuale, `email_confirm`), ma il flusso
  **"password dimenticata" NON esiste nell'app** → gli account istruttrice
  sono **inaccessibili**: nessuno conosce la password temporanea e non c'è
  modo di resettarla. Da qui il **kickoff S23** (reset password).

### Seed dev
- Creata **Giulia Istruttrice** (`giulia.istruttrice@test.it`, `role`
  `instructor`, assegnataria della Pilates Matwork) per validare `/agenda`
  col filtro istruttrice. Password riscritta via `update` su `auth.users`
  con `crypt`/`gen_salt` — **gesto lecito SOLO su dev, mai in produzione.**

### Backlog aggiunti
- **Render degli status `attended`/`no_show` in agenda**: da decidere
  insieme alla futura UI presenze (oggi l'agenda mostra solo
  `confirmed`/`waitlist`).
- **Test istruttrice con flusso reale di onboarding** quando esisterà il
  reset password (S23) — oggi validata solo con seed manuale.

### Kickoff S23
1. **Flusso "password dimenticata"** (reset via email): route dedicata +
   pagina di update password + email. Sblocca l'onboarding istruttrici
   (account già creati ma inaccessibili) e serve alle clienti al lancio.
   Priorità alta pre-settembre.

## S23 — 18 luglio 2026 · Flusso "password dimenticata" (build + validazione app-side)

Due commit su main: `ab74243` (feature), `56cb1a9` (config.toml allowlist, NON ancora applicata al remoto).

### Costruito
- **`/password-dimenticata`** (nel gruppo `(auth)`): form email → `resetPasswordForEmail` con `redirectTo: {origin}/auth/callback?next=/reimposta-password`. Server page + form client separato (`useSearchParams` richiede Suspense per il prerender). Stato success brandizzato.
- **`/reimposta-password`** (client page): 3 stati — `checking` / `missing` (link non valido → CTA "richiedi nuovo link") / `ok` (form nuova password + conferma). `updateUser({password})` → redirect via `destinationForUser`.
- **`/auth/callback`**: parametro `next` onorato solo per path interni (`/` sì, `//` no — guardia open redirect). Exchange fallito con `next=/reimposta-password` → `/password-dimenticata?error=link` (messaggio "link scaduto, richiedine uno nuovo") invece del generico `/login?error=auth`.
- **Login**: link "Password dimenticata?" sotto il campo password.

### DECISIONI ARCHITETTURA — non "riparare"
- **`/reimposta-password` vive FUORI dal gruppo `(auth)` di proposito**: chi arriva dal link di recovery HA una sessione, e il layout `(auth)` redirige chi ha sessione → dentro il gruppo la pagina sarebbe irraggiungibile. Non spostarla "per coerenza".
- **Anti user-enumeration**: la risposta della richiesta reset è identica esista o no l'account. Unico errore mostrato: rate limit (~60s tra richieste).
- **Copy**: l'avviso "il link va aperto sullo stesso dispositivo della richiesta" è nel success state — è il vincolo PKCE (code verifier nel browser richiedente), non una scelta UX.

### Validazione (browser su dev, desktop + mobile 390px)
- Tutti i rami provati con utente di test reale: richiesta reset → success; callback senza code → messaggio link scaduto; guardia open redirect (`next=//evil.com` → rifiutato); form con sessione → password non coincidenti / uguale alla vecchia (errori IT corretti) / cambio reale → redirect dashboard; **vecchia password rifiutata al login, nuova password entra**. Gerarchia (auth) confermata: da loggato `/password-dimenticata` redirige alla dashboard.
- Utente di test su dev: creato via admin API con un plus-address Gmail di Mattia (tag `meetoodev`; profilo con studio_id corretto dal trigger). Identificarlo a runtime con query sull'email, non da id hardcodato; credenziali resettabili via admin API.

### GATE APERTI (bloccano il test E2E email reale, NON il codice)
1. ~~Allowlist redirect~~ **RIDIMENSIONATO (18/7, post-S23)**: il "redirect riscritto a root" osservato in S23 era un artefatto della sonda — la REST admin `generate_link` vuole `redirect_to` **al top level del body**, non annidato in `options` (annidato = ignorato → fallback al Site URL). Col body giusto il redirect è preservato. Dal sorgente di Supabase Auth (`IsRedirectURLValid`): un redirect con **stesso hostname+scheme del Site URL è SEMPRE valido**, allowlist o no → localhost non è mai stato bloccato, e su PROD basta che il Site URL sia il dominio Vercel (verificarlo nel rito di agosto). L'allowlist in dashboard serve solo per host DIVERSI dal Site URL (es. preview deploy). Le wildcard `/**` restano in config.toml e in dashboard dev: innocue e utili.
2. **Deliverability email built-in Supabase = dipende dal provider (verificato 18/7)**: a **Gmail non arriva MAI** (attesa ore, spam incluso); a **Hotmail/Outlook arriva in ~1 min**. Conseguenza per S24 invariata: Resend come **SMTP custom di Auth** (reset + conferma signup), perché molte clienti avranno Gmail.
3. ~~Test E2E email reale~~ **CHIUSO (18/7)**: Mattia ha completato il giro vero su dev con mat_peps@hotmail.it — richiesta dal browser → email → click sul link → atterraggio su "Nuova password". Callback PKCE e redirect funzionano end-to-end. Resta il test onboarding istruttrice col flusso reale (backlog S22), ora sbloccato.

### Apprendimenti tecnici
- Il client PKCE (`createBrowserClient`) **ignora i token hash del flusso implicito** (link generati da `generate_link` admin): la pagina mostra correttamente "link non valido". Il percorso reale è solo email → verify → `?code=` → callback.
- `type='email'` degli input: `form_input`/click del browser-pane a volte non innescano il submit React al primo colpo — pattern "primo click a vuoto"; per i test è affidabile `form.requestSubmit()`. Nessun impatto sul comportamento con utenti reali (Enter/tap funzionano).
- ROADMAP.md (v1, 14/7) indica per S23 "form pacchetti + scrollIntoView": stale, il form pacchetti è chiuso da S9. La fonte viva della sequenza sessioni è questo file. Il fix `scrollIntoView` (risk register S9.1) resta a backlog.

### Backlog aggiunto (post-S23, dal test di Mattia)
- **Logout per l'istruttrice**: su `/agenda` non esiste un bottone Esci (l'admin ha "← Home", l'istruttrice niente). Oggi l'unica via è passare da `/dashboard` (che non ha gate di ruolo) e usare ESCI lì, o pulire i cookie. Fix piccolo, da accorpare al fix `scrollIntoView` del form pacchetti (risk register S9.1) in una micro-sessione polish UI pre-lancio.

## S24 — 20 luglio 2026 · Email con Resend: transazionali + SMTP custom Auth (CHIUSA su dev)

Tre commit su main: `b66eb58` (transazionali), `72f87dc` (logo email), + docs.

### Costruito — transazionali (Resend API, lato app)
- **`lib/email/send.ts`** — wrapper best-effort: key da `RESEND_API_KEY`, mittente
  da `EMAIL_FROM` (fallback sandbox `onboarding@resend.dev`). Un'email che
  fallisce NON blocca mai il flusso chiamante: nessun throw, solo log. Key
  assente → invio saltato con warn (stato attuale di produzione, deliberato).
- **`lib/email/templates.ts`** — template HTML a tabelle con stili inline
  (i client di posta non caricano CSS esterni né SVG). Palette 4 toni, date
  SEMPRE con `timeZone: 'Europe/Rome'` esplicita (i server girano in UTC).
  `<meta charset="utf-8">` nel layout: senza, accenti e € diventano mojibake.
- **Benvenuto**: server action fire-and-forget dopo `signUp` riuscito in
  registrati (al signup non c'è sessione → l'action non può verificare il
  chiamante; contenuto fisso, rischio accettato e annotato).
- **Conferma prenotazione**: server action dopo `book_lesson` riuscito nel
  palinsesto. Il client passa SOLO lo scheduleId: il server verifica sotto RLS
  che esista la prenotazione confermata dell'utente autenticato e rilegge
  lezione/istruttrice/prezzo (`price_override ?? classes.price`, stessa logica
  della RPC). Riepilogo: lezione, giorno, ora, istruttrice, sala, addebito,
  promemoria disdetta 24h.

### Logo nelle email — PNG del lockup ufficiale
- I client di posta non supportano SVG → `public/brand/email-logo.png`, lockup
  'full' @2x con la geometria ESATTA di Logo.tsx (MARK_RATIO 0.499, stroke 9,
  gap 0.076). Sfondo #f5f0e8 BAKATO nel PNG: leggibile anche in dark mode.
- Generatore riproducibile `scripts/generate-email-logo.sh` (Chrome headless,
  pattern S14: eseguito offline, PNG committato statico).
- URL immagine ASSOLUTO verso produzione (`EMAIL_ASSETS_URL`, fallback dominio
  Vercel) — mai l'origin locale: l'email la legge il client del destinatario.
  Alt-text brandizzato ("MEE TOO" tracking largo) se le immagini sono bloccate.

### SMTP custom Auth (gate 2) — CONFIGURATO su MeeToo_Dev e PROVATO
- Dashboard → Project Settings → Authentication → SMTP: host `smtp.resend.com`,
  port 465, user `resend`, password = API key Resend, sender "Mee Too".
- **Validazione E2E: l'email di reset password ARRIVA a Gmail** (mittente
  "Mee Too") — chiuso il problema S23 "built-in Supabase a Gmail mai".

### Validazione E2E completa (dev, flussi reali dall'app)
- Signup reale → profilo con studio_id corretto dal trigger + benvenuto arrivato.
- Prenotazione reale dal palinsesto (lezione seed "TEST S24", 21/7 18:00,
  Matwork 16€): debit −16 a ledger, residuo tranche 100→84 (quadratura ok),
  conferma arrivata con riepilogo completo.
- Reset password → email via SMTP custom arrivata a Gmail. Tutte e 3 le email
  verificate da Mattia nella sua inbox Gmail (l'indirizzo account Resend).

### Scoperte / decisioni di sessione
- **Sul dev `enable_confirmations` è OFF**: il signup auto-conferma e apre la
  sessione (niente email di conferma). Il copy del success di registrati
  ("controlla la tua email per confermare") è quindi impreciso sul dev.
  Verificare il setting su PROD nel rito di agosto e allineare il copy.
- **Sandbox Resend = solo email dell'account**: per clienti vere serve dominio
  verificato (decisione Giorgia, prerequisito lancio). Il test onboarding
  istruttrice (backlog S22) resta bloccato da questo: serve un indirizzo
  consegnabile per l'istruttrice.
- **Rete**: oggi Supabase dev era raggiungibile senza hotspot dichiarato.
  La regola hotspot resta (non è chiaro se la rete fosse già hotspot o se il
  blocco TIM sia intermittente): verificare sempre con un curl prima di
  assumere il blocco.
- Utente di test client su dev con l'email Gmail di Mattia (identificarlo a
  runtime per email, credenziali note a Mattia / resettabili via admin API).
  Restano a DB: tranche di test (residuo 84€) e lezione "TEST S24" prenotata.

### GATE produzione (rito di agosto, insieme a pg_cron prod + migration repair + chiavi)
1. `RESEND_API_KEY` (+ eventuale `EMAIL_FROM`, `EMAIL_ASSETS_URL`) nelle env
   Vercel — oggi in prod le email vengono saltate in silenzio.
2. SMTP custom sul progetto PROD (stessi valori del dev).
3. Dominio verificato su Resend prima del lancio (→ aggiornare `EMAIL_FROM`).
