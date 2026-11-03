-- Contatti dello studio con etichette (3/11/2026).
-- Primo uso: le gift card. Chi compra entra con "Gift card · ha regalato", chi
-- riceve il regalo (all'attivazione in studio) con "Gift card · ha ricevuto".
-- Non sono account dell'app: sono persone da ricordare e, se hanno dato il
-- consenso, da ricontattare. Il consenso alle novita' e' separato e datato.
-- Accesso solo dal server (service role) e dall'admin dello studio in lettura.

begin;

create table public.contatti (
  id uuid primary key default extensions.uuid_generate_v4(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  nome text,
  email text,
  telefono text,
  etichette text[] not null default '{}',
  consenso_novita boolean not null default false,
  consenso_at timestamptz,
  origine text,                         -- da dove e' arrivato la prima volta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- la stessa persona non si ripete: per email, o per telefono se l'email non c'e'
create unique index contatti_email_idx on public.contatti (studio_id, lower(email)) where email is not null;
create unique index contatti_telefono_idx on public.contatti (studio_id, telefono) where email is null and telefono is not null;
create index contatti_etichette_idx on public.contatti using gin (etichette);

-- lo storico di ogni contatto: cosa ha fatto e quando
create table public.contatti_eventi (
  id uuid primary key default extensions.uuid_generate_v4(),
  contatto_id uuid not null references public.contatti(id) on delete cascade,
  tipo text not null,                   -- 'gift_regalato', 'gift_ricevuto'
  descrizione text not null,
  gift_card_id uuid references public.gift_cards(id) on delete set null,
  created_at timestamptz not null default now()
);
create index contatti_eventi_contatto_idx on public.contatti_eventi (contatto_id, created_at desc);

-- il consenso alle novita' chiesto nel pagamento e all'attivazione
alter table public.gift_cards
  add column buyer_consenso_novita boolean not null default false,
  add column holder_consenso_novita boolean not null default false;

alter table public.contatti enable row level security;
alter table public.contatti_eventi enable row level security;

create policy "Admin dello studio vede i contatti" on public.contatti
  for select using (studio_id = public.get_user_studio_id() and public.get_user_role() = 'admin');
create policy "Admin dello studio vede lo storico dei contatti" on public.contatti_eventi
  for select using (exists (
    select 1 from public.contatti c
    where c.id = contatto_id and c.studio_id = public.get_user_studio_id() and public.get_user_role() = 'admin'
  ));

commit;
