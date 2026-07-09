-- ============================================================================
-- MEE TOO — Sessione 10 — Migrazione VERSIONATA
-- Fondamenta sotto-soglia: subthreshold_decisions + push_subscriptions
--                          + refund_booking_full()
--
-- Naming Supabase: rinominare in <YYYYMMDDHHMMSS>_s10_subthreshold_foundation.sql
-- (o usare `supabase migration new s10_subthreshold_foundation` e incollare).
--
-- TESTATO su PostgreSQL 16: applicazione pulita + rimborso tranche morta
-- (riattiva, proroga +30g, NON tocca late_cancel_used) + idempotenza.
--
-- NON incluso (blocco successivo): sweep cron, RPC transizione A/C,
-- sender push, abilitazione pg_cron/pg_net.
-- ============================================================================


-- 1) Tabella decisioni sotto-soglia (centrata sullo schedule) --------------
create table if not exists public.subthreshold_decisions (
  id                 uuid primary key default uuid_generate_v4(),
  studio_id          uuid not null,
  schedule_id        uuid not null unique
                       references public.schedules(id) on delete cascade,
  booking_id         uuid
                       references public.bookings(id) on delete set null,
  client_id          uuid
                       references public.profiles(id) on delete set null,
  state              text not null
                       check (state in ('pending','resolved_rescheduled',
                                        'resolved_refunded','cancelled_empty')),
  bookings_at_check  int  not null check (bookings_at_check >= 0),
  detected_at        timestamptz not null default now(),
  decision_deadline  timestamptz,
  notified_at        timestamptz,
  resolved_at        timestamptz,
  auto_applied       boolean not null default false
);

comment on table public.subthreshold_decisions is
  'Stato macchina cron sotto-soglia. UNIQUE(schedule_id) = idempotenza del cron.';

-- sweep scadenza: righe pending oltre deadline
create index if not exists idx_subthr_pending_deadline
  on public.subthreshold_decisions (decision_deadline)
  where state = 'pending';

-- card in-app: decisioni pendenti della cliente
create index if not exists idx_subthr_client_pending
  on public.subthreshold_decisions (client_id)
  where state = 'pending';

-- 2) Tabella push subscriptions (una riga per dispositivo) ------------------
create table if not exists public.push_subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  studio_id       uuid not null,
  client_id       uuid not null references public.profiles(id) on delete cascade,
  endpoint        text not null unique,
  key_p256dh      text not null,
  key_auth        text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists idx_push_client_active
  on public.push_subscriptions (client_id)
  where is_active = true;

-- 3) RLS -------------------------------------------------------------------
alter table public.subthreshold_decisions enable row level security;
alter table public.push_subscriptions      enable row level security;

-- decisioni: la cliente legge solo le proprie (la card in-app).
-- Scritture: solo via funzioni SECURITY DEFINER o ruolo di servizio (cron).
-- Visibilità admin/studio: RIMANDATA (serve confermare il vocabolario role).
drop policy if exists subthr_select_own on public.subthreshold_decisions;
create policy subthr_select_own on public.subthreshold_decisions
  for select to authenticated
  using (client_id = auth.uid());

-- push: la cliente gestisce solo le proprie subscription.
drop policy if exists push_select_own on public.push_subscriptions;
create policy push_select_own on public.push_subscriptions
  for select to authenticated using (client_id = auth.uid());

drop policy if exists push_insert_own on public.push_subscriptions;
create policy push_insert_own on public.push_subscriptions
  for insert to authenticated with check (client_id = auth.uid());

drop policy if exists push_update_own on public.push_subscriptions;
create policy push_update_own on public.push_subscriptions
  for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions
  for delete to authenticated using (client_id = auth.uid());

-- 4) Funzione rimborso pieno (isolata, forward-compatible) -----------------
-- Annulla la prenotazione + rimborsa TUTTO, senza penale e senza consumare
-- late_cancel_used. Pensata per cancellazione INIZIATA DALLO STUDIO.
-- NIENTE auth.uid(): chiamabile dal cron (ruolo di servizio) e da RPC definer.
-- L'autorizzazione e' responsabilita' del CHIAMANTE.
-- Ramo "tranche morta" = Opzione 1: riattiva + proroga a now()+30g (mai accorcia).
-- Contratto: NON tocca schedules.is_cancelled (lo fa il driver di stato).
create or replace function public.refund_booking_full(p_booking_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status text; v_schedule_id uuid; v_studio uuid; v_client uuid;
  r_debit record; v_alive boolean;
  v_any_refunded boolean := false;
  v_reactivated  boolean := false;
begin
  select status, schedule_id, studio_id, client_id
    into v_status, v_schedule_id, v_studio, v_client
  from bookings where id = p_booking_id for update;

  if not found then raise exception 'booking_not_found'; end if;

  -- idempotenza: se non e' piu' confirmed, non faccio nulla (no doppio rimborso)
  if v_status <> 'confirmed' then
    return json_build_object('cancelled', false, 'refunded', false,
      'reactivated_tranche', false, 'note', 'already_not_confirmed');
  end if;

  update bookings set status = 'cancelled', cancelled_at = now()
  where id = p_booking_id;

  for r_debit in
    select client_package_id, amount
    from wallet_transactions
    where booking_id = p_booking_id and type = 'debit'
  loop
    if r_debit.client_package_id is null then continue; end if;

    select (is_active = true and (expires_at is null or expires_at > now()))
      into v_alive
    from client_packages where id = r_debit.client_package_id for update;

    if coalesce(v_alive, false) then
      update client_packages
        set amount_remaining = amount_remaining + (-r_debit.amount)
      where id = r_debit.client_package_id;
    else
      -- Opzione 1: tranche morta -> riattiva + proroga, poi rimborsa
      update client_packages
        set is_active = true,
            expires_at = greatest(coalesce(expires_at, now()),
                                  now() + interval '30 days'),
            amount_remaining = amount_remaining + (-r_debit.amount)
      where id = r_debit.client_package_id;
      v_reactivated := true;
    end if;

    insert into wallet_transactions
      (studio_id, client_id, amount, type, description,
       client_package_id, booking_id, created_at)
    values
      (v_studio, v_client, -r_debit.amount, 'refund',
       'Rimborso pieno annullamento studio (sotto-soglia)',
       r_debit.client_package_id, p_booking_id, now());

    v_any_refunded := true;
  end loop;

  update schedules
    set current_bookings = greatest(0, coalesce(current_bookings,0) - 1)
  where id = v_schedule_id;

  return json_build_object('cancelled', true, 'refunded', v_any_refunded,
                           'reactivated_tranche', v_reactivated);
end;
$function$;

-- blindatura: SECURITY DEFINER senza auth-check NON deve essere chiamabile
-- direttamente dal client. Solo internamente / ruolo di servizio.
revoke all on function public.refund_booking_full(uuid) from public;
revoke all on function public.refund_booking_full(uuid) from anon;
revoke all on function public.refund_booking_full(uuid) from authenticated;
