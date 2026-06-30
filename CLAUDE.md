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

## Stack

- Next.js 16.2.6 (App Router), TypeScript, Tailwind v4, shadcn/ui
- Backend: Supabase (postgres + auth + storage)
- Deploy: Vercel (progetto `meetoo-app-ntls`, branch main)
- Multi-tenant via `studio_id`
- Repo: github.com/Peps8585/meetoo_app

## Decisioni di design

- **`wallet_transactions` ≠ crediti-lezioni**: la tabella `wallet_transactions` è il wallet monetario (gift card, shop — feature non ancora costruita). Il credito-lezioni è gestito interamente da `client_packages.credits_used` via le RPC `book_lesson`/`cancel_booking`. Le due cose sono separate per design. Non integrare `wallet_transactions` nelle RPC di prenotazione senza una decisione esplicita.

## Dipendenze chiave

- `@supabase/supabase-js`: 2.106.0
- `@supabase/ssr`: 0.10.3 (peer dep: supabase-js ^2.105.3 — compatibile)
- `next`: 16.2.6

## Stato attuale (aggiornato: 19 giugno 2026 — sessione 4)

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
