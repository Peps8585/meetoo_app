-- Gift card: cosa si regala, le copertine tra cui scegliere, i regali comprati.
--
-- Primo pezzo del progetto gift card (30/10/2026): il lato di chi regala.
-- Pensato per piu' studi fin da subito (studio_id ovunque), perche' lo stesso
-- prodotto andra' proposto ad altre attivita'.
--
-- Accesso: le pagine pubbliche (/regala, /regalo/[codice]) leggono e scrivono
-- dal server con la service role, mai dal browser. Per questo RLS e' attiva e
-- l'unica policy e' per l'admin dello studio: anon e clienti non vedono nulla
-- direttamente, nemmeno i regali degli altri.

begin;

-- Cosa si puo' regalare. Separato da `packages` di proposito: un pacchetto e'
-- una ricarica del wallet, un regalo e' un prodotto in vetrina con foto e
-- testo. Al riscatto (passo 2) il regalo diventera' una tranche: `package_id`
-- dice quale.
create table public.gift_products (
  id uuid primary key default extensions.uuid_generate_v4(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  discipline text not null,               -- "Pilates Reformer & Chair"
  discipline_slug text not null,          -- "pilates-reformer", per il palinsesto
  title text not null,                    -- "5 lezioni"
  description text,
  lessons integer not null check (lessons > 0),
  price numeric(10,2) not null check (price > 0),
  includes_stamp_duty boolean not null default false,  -- 2 euro di bollo compresi nel prezzo
  savings_note text,                      -- "risparmi 5 euro"
  detail_image text,                      -- dettaglio sfumato nel tasto
  package_id uuid references public.packages(id) on delete set null,
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index gift_products_studio_idx on public.gift_products (studio_id, is_active, sort);

-- Le copertine tra cui sceglie chi regala: foto decise dallo studio.
create table public.gift_covers (
  id uuid primary key default extensions.uuid_generate_v4(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  image_url text not null,
  label text,
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index gift_covers_studio_idx on public.gift_covers (studio_id, is_active, sort);

-- I regali comprati. Prodotto e copertina sono copiati al momento
-- dell'acquisto: se lo studio cambia prezzo o foto, il regalo gia' fatto resta
-- com'era.
create table public.gift_cards (
  id uuid primary key default extensions.uuid_generate_v4(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  code text not null unique,
  product_id uuid references public.gift_products(id) on delete set null,
  discipline text not null,
  discipline_slug text not null,
  product_title text not null,
  lessons integer not null,
  price numeric(10,2) not null,
  includes_stamp_duty boolean not null default false,
  cover_url text not null,
  occasion text,
  from_name text not null,
  to_name text not null,
  message text check (char_length(message) <= 300),
  -- 'email': lo mandiamo noi; 'self': lo consegna chi regala (WhatsApp, stampa)
  delivery text not null check (delivery in ('email', 'self')),
  recipient_email text,
  send_at timestamptz,                    -- null = appena pagato
  buyer_email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'delivered', 'redeemed', 'void')),
  valid_months integer not null default 6,
  valid_until timestamptz,                -- fissata alla consegna, non all'acquisto
  stripe_session_id text unique,
  stripe_payment_intent text,
  paid_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  redeemed_at timestamptz,
  redeemed_client_package_id uuid references public.client_packages(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gift_cards_email_needs_recipient
    check (delivery <> 'email' or recipient_email is not null)
);
create index gift_cards_studio_idx on public.gift_cards (studio_id, status, created_at desc);
-- per l'invio dei regali programmati
create index gift_cards_to_send_idx on public.gift_cards (send_at) where status = 'paid';

alter table public.gift_products enable row level security;
alter table public.gift_covers enable row level security;
alter table public.gift_cards enable row level security;

create policy "Admin dello studio gestisce i regali in vendita" on public.gift_products
  using (studio_id = public.get_user_studio_id() and public.get_user_role() = 'admin')
  with check (studio_id = public.get_user_studio_id() and public.get_user_role() = 'admin');

create policy "Admin dello studio gestisce le copertine" on public.gift_covers
  using (studio_id = public.get_user_studio_id() and public.get_user_role() = 'admin')
  with check (studio_id = public.get_user_studio_id() and public.get_user_role() = 'admin');

-- I regali comprati l'admin li legge e basta: soldi e stati li muove solo il
-- server (pagamento Stripe, consegna, riscatto).
create policy "Admin dello studio vede i regali comprati" on public.gift_cards
  for select using (studio_id = public.get_user_studio_id() and public.get_user_role() = 'admin');

commit;
