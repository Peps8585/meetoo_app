-- Pacchetti acquistabili dall'app (Mattia 26/11/2026).
--
-- La cliente vede i pacchetti con i prezzi e paga con la carta (Stripe, lo stesso
-- conto delle gift card). A pagamento riuscito il pacchetto le compare nel profilo
-- da solo, come quando lo carica lo studio.
-- Decisioni di Mattia: marca da bollo di 2 euro aggiunta al prezzo sopra 77,47 euro;
-- ricevute e fatture restano su Aruba Fatture (allo studio arriva l'avviso con i
-- dati); il pagamento in studio resta.
-- L'acquisto si apre solo con crediti accesi e prenotazioni dall'app aperte:
-- prima di allora il pacchetto non avrebbe dove scalare.

begin;

create table if not exists public.package_orders (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id),
  client_id uuid not null references public.profiles(id),
  package_id uuid not null references public.packages(id),
  package_name text not null,
  price numeric(10,2) not null,
  stamp_duty numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  client_package_id uuid references public.client_packages(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists package_orders_client_idx on public.package_orders (client_id, created_at desc);

alter table public.package_orders enable row level security;

-- la cliente legge i suoi ordini, le admin quelli del loro studio; nessuno scrive dal browser
drop policy if exists package_orders_select on public.package_orders;
create policy package_orders_select on public.package_orders
  for select to authenticated
  using (
    client_id = auth.uid()
    or (get_user_role() = 'admin'
        and studio_id = (select p.studio_id from profiles p where p.id = auth.uid()))
  );

revoke insert, update, delete on public.package_orders from anon, authenticated;

-- Accredita un ordine pagato: lo chiama solo il server (pagina di ritorno o avviso
-- di Stripe), dopo aver riletto il pagamento da Stripe. Chi arriva secondo non fa
-- niente: e' il passaggio pending -> paid a fare da lucchetto.
create or replace function public.accredita_ordine_pacchetto(p_order uuid, p_payment_intent text)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_ord package_orders%rowtype;
  v_pkg packages%rowtype;
  v_id uuid;
begin
  update package_orders
     set status = 'paid', paid_at = now(), stripe_payment_intent = p_payment_intent
   where id = p_order and status = 'pending'
  returning * into v_ord;
  if not found then return null; end if;

  select * into v_pkg from packages where id = v_ord.package_id;

  insert into client_packages
    (studio_id, client_id, package_id, credits_total, credits_used, price_paid,
     purchased_at, expires_at, is_active, amount_initial, amount_remaining)
  values
    (v_ord.studio_id, v_ord.client_id, v_ord.package_id, v_pkg.credits, 0, v_ord.price,
     now(),
     case when v_pkg.validity_days is not null then now() + make_interval(days => v_pkg.validity_days) end,
     true, v_pkg.credit_amount, v_pkg.credit_amount)
  returning id into v_id;

  insert into wallet_transactions (studio_id, client_id, amount, type, description, client_package_id)
  values (v_ord.studio_id, v_ord.client_id, v_pkg.credit_amount, 'credit',
          'Pacchetto ' || v_pkg.name || ' acquistato dall''app', v_id);

  update package_orders set client_package_id = v_id where id = p_order;
  return v_id;
end;
$$;

revoke all on function public.accredita_ordine_pacchetto(uuid, text) from public, anon, authenticated;
grant execute on function public.accredita_ordine_pacchetto(uuid, text) to service_role;

commit;
