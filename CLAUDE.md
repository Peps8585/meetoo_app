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

## Stato attuale (aggiornato: 17 giugno 2026)

### Fatto
- Migrate alle nuove API key Supabase: `sb_publishable_*` (anon) e `sb_secret_*` (service role) create e sostituite in `.env.local` e nelle env Vercel. Redeploy su `meetoo-app-ntls` completato.
- **Publishable key verificata end-to-end**: login su sito deployato funziona dopo fix typo URL Vercel.
- **Secret key verificata**: `GET /auth/v1/admin/users` → HTTP 200, restituisce 3 utenti del progetto. Accettata come service_role.

### Da fare (azioni su dashboard web — solo Mattia)
- **Disabilitare le legacy key `eyJ...`** su Supabase dashboard (ora che entrambe le nuove key sono confermate)
- **Rigenerare la key Resend** e aggiornare `RESEND_API_KEY` in `.env.local` e Vercel → redeploy

### Blocco attuale: "Failed to fetch" al login → ROOT CAUSE TROVATA

**Sintomo**: il login su `meetoo-app-ntls.vercel.app/login` restituisce "Failed to fetch".

**Root cause (trovata sessione 17 giu)**: **typo nell'URL Supabase baked nel bundle Vercel**.

| | Valore |
|---|---|
| Corretto (da `.env.local`) | `lcyexu**gq**inabjoinrsku.supabase.co` |
| Errato (baked nel bundle Vercel) | `lcyexu**qq**inabjoinrsku.supabase.co` |

Il progetto `lcyexuqqinabjoinrsku` non esiste → connection timeout → `fetch()` lancia eccezione → "Failed to fetch". CORS, versione libreria e formato key erano tutti corretti.

**Fix**: aggiornare la variabile `NEXT_PUBLIC_SUPABASE_URL` su Vercel con il valore corretto, poi fare redeploy.

## Roadmap

1. **[IN CORSO]** Risolvi blocco login (`Failed to fetch`) → verifica anche creazione istruttore (Server Action con service role key)
2. **[Sicurezza]** Mattia disabilita legacy key su Supabase + rigenera key Resend → aggiorna env + redeploy
3. **[FATTO]** ~~Versiona nel repo RPC e schema DB~~ → `supabase/migrations/` creata con snapshot 14 tabelle + 4 RPC complete
4. **[IN CORSO]** RLS hardening: migration `20260617000000_rls_hardening.sql` scritta — in attesa di review e applicazione da Mattia nel SQL Editor
5. **[Test E2E]** prenota → scala credito → cancella → rimborso, dall'app su hotspot
6. **[Auth]** Fix auth callback (magic link / reset password) e bottone "Scopri le lezioni" in homepage
7. **[Pulizia]** Elimina 2 vecchi progetti Vercel (meetoo-app, meetoo-app-v1); risolvi 3 warning ESLint/Tailwind + 1 warning build
8. **[Demo]** Demo con Giorgia (riattivare free tier Supabase se in pausa)
9. **[Fatturazione]** Integrazione Fatture in Cloud API

Backlog successivo: contenuti+Stripe, CRM/email Resend, polish PWA, beta launch 1 settembre.

## Log sessioni

### 2026-06-17 — Sessione 1
- Creato CLAUDE.md con stato, regole, roadmap e log
- Analizzato "Failed to fetch" al login: versioni librerie ok (supabase-js 2.106.0 + ssr 0.10.3 compatibili), codice corretto, CORS ok (testato con curl)
- Ispezionato JS bundle deployato su Vercel: trovato typo `gq` → `qq` nell'URL Supabase nella variabile `NEXT_PUBLIC_SUPABASE_URL`
- **Root cause**: l'URL nel bundle punta a un progetto Supabase inesistente → timeout → "Failed to fetch"
- Fix applicato: Mattia ha corretto `NEXT_PUBLIC_SUPABASE_URL` su Vercel → redeploy → login ok
- **Secret key verificata**: `GET /auth/v1/admin/users` → HTTP 200, 3 utenti, accettata come service_role
- **Task 1 CHIUSO** — entrambe le key funzionano end-to-end
- **Roadmap punto 3 CHIUSO**: `supabase/migrations/` creata — 14 tabelle (snapshot) + 4 RPC con corpi reali
- RLS hardening: scritta `20260617000000_rls_hardening.sql` (policy RESTRICTIVE su bookings e client_packages) — **in attesa di applicazione da Mattia**
