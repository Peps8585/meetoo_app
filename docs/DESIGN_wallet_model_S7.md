# Mee Too — Design Modello Target: Wallet in Euro
**Sessione 7 — documento di design (NO CODE, da revisionare prima di toccare Claude Code)**
Basato sull'audit DB del 25/06/2026 (schema, RPC, RLS, indici verificati riga per riga).

---

## 1. Scopo

Trasformare il motore di prenotazione da **conta-lezioni** (1 prenotazione = 1 credito, disciplina e prezzo ignorati) a **wallet in euro** (ogni prenotazione scala il prezzo della disciplina dal saldo). Questo documento definisce *cosa* costruire, non lo scrive ancora.

Tutte le decisioni qui sotto sono già confermate, **tranne i 4 punti marcati `DA DECIDERE`** in §8: quelli vanno chiusi prima del build.

---

## 2. Principi del modello

- **Saldo in euro.** Il credito è denominato in euro, fungibile su qualsiasi disciplina/workshop.
- **Prezzo per disciplina.** Ogni tipo di lezione ha un prezzo in euro; il workshop può sovrascriverlo per singola istanza.
- **Tranche con scadenza.** Ogni ricarica crea una tranche datata. Scadenza **dura**, variabile per taglia (5→2 mesi, 10→3, 15→5, 20→6). Riusa `validity_days`.
- **Consumo FIFO per scadenza.** Si scala sempre dalla tranche che muore prima, per non sprecare credito in scadenza.
- **Ledger append-only.** `wallet_transactions` è il giornale immutabile dei movimenti (audit). Lo scrive solo il motore (RPC `SECURITY DEFINER`), mai il client né l'admin a mano.
- **Confezioni-marketing.** I "pacchetti" diventano SKU di ricarica con nomi familiari ("Reformer 10"); lo sconto-volume è **credito bonus**, non un prezzo-lezione diverso.

---

## 3. Delta schema (tabella per tabella)

Convenzione: `+` aggiungere, `~` ridefinire semantica, `DEPRECATE` smettere di usare ma tenere in transizione.

### `classes` — tipi di lezione
- `+ price numeric NOT NULL DEFAULT 0` → prezzo €/lezione della disciplina.
  *Backfill con i prezzi reali, poi valutare se togliere il DEFAULT.*

### `schedules` — palinsesto
- `+ price_override numeric NULL` → prezzo specifico per workshop/evento speciale.
  Prezzo effettivo della prenotazione = `coalesce(schedules.price_override, classes.price)`.

### `packages` — confezioni di ricarica (ex pacchetti)
- `+ credit_amount numeric NOT NULL` → euro di credito **erogato** (base + bonus).
- `price` (già esiste) → quanto la cliente **paga**. Il bonus è `credit_amount - price`.
- `validity_days` (già esiste) → durata della tranche generata.
- `DEPRECATE credits (int)` → era il conteggio lezioni; non più usato.

### `client_packages` — **tranche di credito** (semantica ridefinita)
- `+ amount_initial numeric NOT NULL` → euro erogati alla creazione della tranche.
- `+ amount_remaining numeric NOT NULL` → euro residui (saldo operativo, lockato in prenotazione).
- `+ late_cancel_used boolean NOT NULL DEFAULT false` → bonus "1 cancellazione tardiva" (vedi §8.b).
- `expires_at`, `purchased_at`, `price_paid`, `package_id`, `is_active` (già esistono) → invariati.
- `DEPRECATE credits_total, credits_used (int)` → conteggi vecchi, non più usati.

### `wallet_transactions` — ledger
- `+ client_package_id uuid NULL` FK → `client_packages(id)` → a quale tranche appartiene il movimento.
- `+ booking_id uuid NULL` FK → `bookings(id)` → a quale prenotazione (per addebiti/rimborsi precisi).
- `amount numeric` (già esiste) → **positivo = credito in, negativo = credito out**.
- `type text` (già esiste) → tassonomia chiusa: `topup`, `bonus`, `booking_debit`, `cancel_refund`, `gift`, `adjustment`.
  *(Il workshop è un `booking_debit` come ogni prenotazione — non serve un type dedicato.)*

### `bookings`
- `client_package_id` → **LEGACY**. Con lo split-debit (§8.a) una prenotazione può toccare più tranche, quindi l'aggancio vero vive nelle righe `wallet_transactions`. Resta nullable in transizione, si smette di popolarlo.
- **Indice unico → parziale** (fix bug, §7).

---

## 4. Risoluzione prezzo e calibrazione del bonus

**Prezzo effettivo prenotazione:** `coalesce(schedules.price_override, classes.price)`.

**Come tarare `classes.price` e il bonus per replicare gli sconti attuali** (metodo, numeri reali da fare con Giorgia):

`classes.price` = la tariffa **più cara** (lezione singola / taglia più piccola). I bundle più grandi danno **credito bonus** così l'effettivo per-lezione scende ai livelli attuali.

*Esempio illustrativo (numeri inventati):*
- Reformer, tariffa base = **€18/lezione** → `classes.price = 18`.
- Bundle "Reformer 5": paga €90, riceve €90 di credito → bonus €0 (5 × €18). Effettivo €18.
- Bundle "Reformer 10" oggi costa €150 (€15/lez). Per fare 10 lezioni da €18 servono €180 → bundle: paga **€150**, riceve **€180** di credito (bonus €30). Effettivo €15. ✓
- Stessa logica per 15 e 20: bonus crescente = sconto crescente.

Effetto collaterale accettato (decisione §modello): se spende il credito su una disciplina più economica fa *più* lezioni; su un workshop costoso, meno.

---

## 5. Logica RPC riscritte (pseudocodice — NON è il codice finale)

### `book_lesson(p_schedule_id)`
```
auth: v_client = auth.uid(); se null -> 'not_authenticated'

-- [PRESERVATO] lock anti-race
SELECT ... FROM schedules WHERE id = p_schedule_id FOR UPDATE
  -> checks: found / not cancelled / not past / not full / not already_booked  (come oggi)

-- [NUOVO] prezzo
v_price = coalesce(schedule.price_override, class.price)   -- join classes via schedule.class_id

-- [NUOVO] tranche vive, lockate, in ordine di scadenza
SELECT ... FROM client_packages
  WHERE client_id = v_client AND is_active
    AND (expires_at IS NULL OR expires_at > now())
    AND amount_remaining > 0
  ORDER BY expires_at ASC NULLS LAST
  FOR UPDATE
v_balance = somma(amount_remaining)
se v_balance < v_price -> 'insufficient_credit'

-- inserimento prenotazione
INSERT INTO bookings(...) status='confirmed' -> v_booking_id

-- [NUOVO] addebito FIFO (split-debit, vedi §8.a)
v_residuo = v_price
PER ogni tranche (scadenza crescente) finché v_residuo > 0:
    v_quota = min(tranche.amount_remaining, v_residuo)
    UPDATE client_packages SET amount_remaining = amount_remaining - v_quota WHERE id = tranche.id
    INSERT INTO wallet_transactions(client_id, studio_id, client_package_id=tranche.id,
                                    booking_id=v_booking_id, amount = -v_quota, type='booking_debit')
    v_residuo -= v_quota

-- [PRESERVATO] contatore posti
UPDATE schedules SET current_bookings = current_bookings + 1 WHERE id = p_schedule_id
RETURN v_booking_id
```

### `cancel_booking(p_booking_id)`
```
auth + [PRESERVATO] FOR UPDATE booking + checks (found / owner / status='confirmed')
[PRESERVATO] FOR UPDATE schedule -> v_starts

-- eleggibilità rimborso
v_refund = false
se (v_starts - now() >= interval '24 hours') -> v_refund = true              -- regola standard 24h
altrimenti se esiste tranche viva con late_cancel_used = false -> v_refund = true; v_use_bonus = true   -- §8.b

UPDATE bookings SET status='cancelled', cancelled_at = now() WHERE id = p_booking_id

se v_refund:
    -- rimborso ESATTO: ripercorri le righe di addebito di questa prenotazione
    PER ogni riga wallet_transactions WHERE booking_id = p_booking_id AND type='booking_debit':
        se la sua tranche è ancora viva:
            UPDATE client_packages SET amount_remaining = amount_remaining + (-riga.amount) WHERE id = riga.client_package_id
            INSERT INTO wallet_transactions(... client_package_id = riga.client_package_id,
                                            booking_id = p_booking_id, amount = -riga.amount, type='cancel_refund')
        -- [EDGE] se la tranche è scaduta nel frattempo: quella quota NON si rimborsa (vedi §8.c)
    se v_use_bonus: UPDATE client_packages SET late_cancel_used = true WHERE id = <tranche soonest viva>

-- [PRESERVATO] il posto si libera SEMPRE, anche senza rimborso
UPDATE schedules SET current_bookings = greatest(0, current_bookings - 1) WHERE id = v_schedule_id
RETURN json {cancelled:true, refunded:v_refund, used_bonus:v_use_bonus}
```

**Da preservare invariato** (scelte già buone): lock `FOR UPDATE` su schedule, finestra 24h, posto sempre liberato, `SECURITY DEFINER` + `search_path` fissato.

---

## 6. RLS — verifiche e aggiunte

- **VERIFICA CRITICA prima del build:** che la RLS sia *attiva* su `wallet_transactions`:
  ```sql
  SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'wallet_transactions';
  ```
  Se `relrowsecurity = true` + nessuna policy di scrittura → i write sono già negati di default, solo le RPC `DEFINER` scrivono = ledger blindato. **Se è `false`, la tabella è aperta: va abilitata la RLS subito.**
- `classes.price` e `schedules.price_override` sono colonne su tabelle già coperte dalle policy esistenti (SELECT studio / gestione admin). **Nessuna nuova policy** per il prezzo in sé.
- Le tranche (`client_packages`) hanno già le RESTRICTIVE che bloccano la scrittura diretta del client → le nuove RPC ci scrivono via `DEFINER`. Invariato.
- *(La SELECT pubblica `anon` su `classes`/`schedules`/`instructors` è lavoro del **funnel pubblico**, tracciato a parte — non in questo motore.)*

---

## 7. Fix indice unico (bug già presente oggi)

`bookings_client_id_schedule_id_key` è UNIQUE **pieno** su `(client_id, schedule_id)`. La cancellazione è soft (la riga resta), quindi **prenota→cancella→riprenota lo stesso slot fallisce**. Fix:
```sql
DROP INDEX bookings_client_id_schedule_id_key;            -- (o drop del constraint corrispondente)
CREATE UNIQUE INDEX bookings_active_uniq
  ON bookings (client_id, schedule_id) WHERE status = 'confirmed';
```
Così solo le prenotazioni attive bloccano lo slot; i record cancellati restano come storico (utile per ledger e statistiche).

---

## 8. PUNTI DA DECIDERE prima del build

**a) Split-debit vs tranche-intera.** Se la tranche più vicina a scadere non copre il prezzo:
- *Split-debit (raccomandato):* scala da più tranche, niente credito sprecato. RPC più complessa (loop + più righe ledger).
- *Tranche-intera:* salta alle tranche capienti, ma lascia residui piccoli mai spendibili.
→ **Raccomando split-debit** (è un wallet in euro, non deve sprecare). Il pseudocodice in §5 lo assume.

**b) Reset del bonus "1 cancellazione tardiva".** Oggi è "1 per cartellino/pacchetto". Con lo split-debit l'1:1 prenotazione↔pacchetto salta. Interpretazione proposta:
- 1 bonus per **tranche** (`late_cancel_used` sulla tranche). Cancellazione <24h ammessa se esiste una tranche viva col flag `false`; all'uso si marca la tranche con scadenza più vicina.
- Si "ricarica" naturalmente comprando un nuovo bundle (nuova tranche).
→ Confermami se "1 per ricarica" ti va bene come traduzione di "1 per cartellino".

**c) Rimborso su tranche scaduta.** Se cancelli (con diritto a rimborso) una lezione pagata da una tranche nel frattempo scaduta, quella quota va in una tranche morta → di fatto persa. Raro. Proposta: **non si rimborsa la quota su tranche scaduta** (scadenza dura, coerente). Alternativa: rimborso in una nuova micro-tranche con scadenza breve. → Raccomando la prima (semplice e coerente).

**d) Valvola "converti in gift prima della scadenza".** Indebolisce la leva commerciale della scadenza. → La tengo **fuori dal motore**, decisione commerciale separata.

---

## 9. Fuori scope (backlog, passaggi dedicati)
- **Posto fisso** (prenotazione ricorrente + contesa posti) → design dedicato.
- **Notifica push pre-scadenza** con upsell → layer sopra il motore.
- **Gift card** e **workshop UX** → entrano nel wallet, ma dopo il core.
- **Funnel pubblico** (SELECT anon + VIEW istruttori) → sessione sua.
- **Migrazione dati al cutover:** i saldi reali oggi sono su **cartellini di carta** (nessun export). Si inseriscono a mano come tranche iniziali al go-live. Niente migrazione automatica dai vecchi conteggi.

---

## 10. Ordine di build consigliato (incrementale)
1. Migration schema (colonne nuove, additive, nulla di distruttivo).
2. Backfill `classes.price` + definizione `credit_amount`/`validity_days` dei bundle (con Giorgia).
3. Riscrittura RPC `book_lesson` / `cancel_booking` + test SQL (enforcement + E2E) come per l'hardening.
4. Fix indice unico parziale.
5. Frontend: profilo (saldo + tranche + scadenze), acquisto bundle, prenotazione che mostra il costo.
6. Solo allora: test con clienti / cutover.

---

## 11. Invariante di test (da verificare in E2E)
Per ogni tranche viva:
```
amount_remaining == amount_initial
                    + somma(wallet_transactions.amount WHERE client_package_id = tranche)
```
(i `booking_debit` sono negativi, i `cancel_refund` positivi). Se l'uguaglianza regge dopo una sequenza prenota/cancella/riprenota, il motore è coerente.

---
*Fine documento. Da validare punto per punto; i 4 `DA DECIDERE` di §8 vanno chiusi prima dello Step 1.*
