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
