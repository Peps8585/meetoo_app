-- Messaggi tra lo studio e le clienti (S35, 13/11/2026).
-- Ogni cliente ha un solo filo con lo studio, come una chat. Lo studio puo'
-- scrivere a tutte, alle iscritte di una lezione o a una cliente: in tutti i
-- casi il messaggio finisce nel filo di ciascuna, e lei puo' rispondere
-- dall'app (decisione di Mattia del 12/11). Le risposte le vede solo lo studio.
--
-- messaggi_invii: un invio dello studio (a chi, quando), per sapere chi ha letto.
-- messaggi: le righe dei fili. letto_at = quando l'altra parte l'ha letto.
--
-- In piu': il consenso agli avvisi su WhatsApp (profiles.whatsapp_eventi) e il
-- registro dei WhatsApp partiti dall'app (whatsapp_invii).

begin;

create table public.messaggi_invii (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  autore_id uuid references public.profiles(id) on delete set null,
  destinatari text not null check (destinatari in ('tutte', 'lezione', 'cliente')),
  schedule_id uuid references public.schedules(id) on delete set null,
  testo text not null,
  created_at timestamptz not null default now()
);

create table public.messaggi (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  da text not null check (da in ('studio', 'cliente')),
  autore_id uuid references public.profiles(id) on delete set null,
  invio_id uuid references public.messaggi_invii(id) on delete cascade,
  testo text not null check (length(btrim(testo)) between 1 and 2000),
  letto_at timestamptz,
  created_at timestamptz not null default now()
);

create index messaggi_filo on public.messaggi (client_id, created_at);
create index messaggi_studio_da_leggere on public.messaggi (studio_id, created_at) where da = 'cliente' and letto_at is null;
create index messaggi_invio on public.messaggi (invio_id);

alter table public.messaggi_invii enable row level security;
alter table public.messaggi enable row level security;

-- la cliente legge il suo filo; lo studio (solo admin) tutti i fili del suo studio.
-- Si scrive e si segna letto solo dalle funzioni qui sotto.
create policy "messaggi_lettura" on public.messaggi for select to authenticated
  using (
    client_id = auth.uid()
    or (public.get_user_role() = 'admin' and studio_id = public.get_user_studio_id())
  );

create policy "messaggi_invii_lettura" on public.messaggi_invii for select to authenticated
  using (public.get_user_role() = 'admin' and studio_id = public.get_user_studio_id());

grant select on public.messaggi, public.messaggi_invii to authenticated;
grant all on public.messaggi, public.messaggi_invii to service_role;

-- ---------------------------------------------------------------------------
-- Lo studio scrive. Ritorna l'invio e a chi e' andato, per mandare le notifiche.
-- ---------------------------------------------------------------------------
create or replace function public.studio_invia_messaggio(
  p_testo text,
  p_destinatari text,
  p_schedule_id uuid default null,
  p_client uuid default null
)
returns table (o_invio uuid, o_client uuid)
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_studio uuid := get_user_studio_id();
  v_invio uuid;
  v_testo text := btrim(coalesce(p_testo, ''));
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  if length(v_testo) = 0 then raise exception 'testo_vuoto'; end if;
  if length(v_testo) > 2000 then raise exception 'testo_lungo'; end if;
  if p_destinatari not in ('tutte', 'lezione', 'cliente') then raise exception 'destinatari_non_validi'; end if;
  if p_destinatari = 'lezione' and not exists (
    select 1 from schedules s where s.id = p_schedule_id and s.studio_id = v_studio
  ) then raise exception 'schedule_not_found'; end if;
  if p_destinatari = 'cliente' and not exists (
    select 1 from profiles p where p.id = p_client and p.studio_id = v_studio and p.role = 'client'
  ) then raise exception 'client_not_found'; end if;

  insert into messaggi_invii (studio_id, autore_id, destinatari, schedule_id, testo)
  values (v_studio, auth.uid(), p_destinatari, case when p_destinatari = 'lezione' then p_schedule_id end, v_testo)
  returning id into v_invio;

  return query
  with dest as (
    select p.id
    from profiles p
    where p.studio_id = v_studio and p.role = 'client' and coalesce(p.is_active, true)
      and (
        p_destinatari = 'tutte'
        or (p_destinatari = 'cliente' and p.id = p_client)
        or (p_destinatari = 'lezione' and exists (
          select 1 from bookings b
          where b.schedule_id = p_schedule_id and b.client_id = p.id and b.status in ('confirmed', 'held')
        ))
      )
  ), ins as (
    insert into messaggi (studio_id, client_id, da, autore_id, invio_id, testo)
    select v_studio, d.id, 'studio', auth.uid(), v_invio, v_testo from dest d
    returning messaggi.client_id
  )
  select v_invio, ins.client_id from ins;
end;
$$;

-- ---------------------------------------------------------------------------
-- La cliente risponde nel suo filo. Ritorna lo studio, per avvisarlo.
-- ---------------------------------------------------------------------------
create or replace function public.messaggio_rispondi(p_testo text)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_studio uuid; v_role text; v_id uuid;
  v_testo text := btrim(coalesce(p_testo, ''));
begin
  select p.studio_id, p.role into v_studio, v_role from profiles p where p.id = auth.uid();
  if v_studio is null or v_role <> 'client' then raise exception 'not_client'; end if;
  if length(v_testo) = 0 then raise exception 'testo_vuoto'; end if;
  if length(v_testo) > 2000 then raise exception 'testo_lungo'; end if;
  -- non piu' di 20 messaggi in un'ora: una chat, non un canale
  if (select count(*) from messaggi m
      where m.client_id = auth.uid() and m.da = 'cliente' and m.created_at > now() - interval '1 hour') >= 20
  then raise exception 'troppi_messaggi'; end if;

  insert into messaggi (studio_id, client_id, da, autore_id, testo)
  values (v_studio, auth.uid(), 'cliente', auth.uid(), v_testo)
  returning id into v_id;
  return v_id;
end;
$$;

-- La cliente ha aperto il filo: i messaggi dello studio risultano letti.
create or replace function public.messaggi_segna_letti()
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare v_n integer;
begin
  update messaggi set letto_at = now()
  where client_id = auth.uid() and da = 'studio' and letto_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Lo studio ha aperto il filo di una cliente: le sue risposte risultano lette.
create or replace function public.studio_segna_letti(p_client uuid)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare v_n integer;
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  update messaggi set letto_at = now()
  where client_id = p_client and studio_id = get_user_studio_id() and da = 'cliente' and letto_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- I fili per la pagina Messaggi dello studio: ultimo messaggio e risposte da leggere.
create or replace function public.studio_fili_messaggi()
returns table (
  client_id uuid, first_name text, last_name text, avatar_url text,
  ultimo_testo text, ultimo_da text, ultimo_at timestamptz, da_leggere integer
)
language sql stable security definer set search_path to 'public'
as $$
  select p.id, p.first_name, p.last_name, p.avatar_url, u.testo, u.da, u.created_at,
         (select count(*)::int from messaggi m
          where m.client_id = p.id and m.da = 'cliente' and m.letto_at is null)
  from profiles p
  join lateral (
    select m.testo, m.da, m.created_at from messaggi m
    where m.client_id = p.id order by m.created_at desc limit 1
  ) u on true
  where get_user_role() = 'admin' and p.studio_id = get_user_studio_id()
  order by u.created_at desc;
$$;

-- Gli invii dello studio con quante l'hanno ricevuto e quante l'hanno letto.
create or replace function public.studio_invii_messaggi(p_limite integer default 30)
returns table (
  invio_id uuid, destinatari text, schedule_id uuid, testo text, created_at timestamptz,
  mandati integer, letti integer
)
language sql stable security definer set search_path to 'public'
as $$
  select i.id, i.destinatari, i.schedule_id, i.testo, i.created_at,
         count(m.id)::int, count(m.letto_at)::int
  from messaggi_invii i
  left join messaggi m on m.invio_id = i.id
  where get_user_role() = 'admin' and i.studio_id = get_user_studio_id()
  group by i.id
  order by i.created_at desc
  limit greatest(1, least(coalesce(p_limite, 30), 200));
$$;

revoke all on function public.studio_invia_messaggio(text, text, uuid, uuid) from public, anon;
revoke all on function public.messaggio_rispondi(text) from public, anon;
revoke all on function public.messaggi_segna_letti() from public, anon;
revoke all on function public.studio_segna_letti(uuid) from public, anon;
revoke all on function public.studio_fili_messaggi() from public, anon;
revoke all on function public.studio_invii_messaggi(integer) from public, anon;
grant execute on function public.studio_invia_messaggio(text, text, uuid, uuid) to authenticated;
grant execute on function public.messaggio_rispondi(text) to authenticated;
grant execute on function public.messaggi_segna_letti() to authenticated;
grant execute on function public.studio_segna_letti(uuid) to authenticated;
grant execute on function public.studio_fili_messaggi() to authenticated;
grant execute on function public.studio_invii_messaggi(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- WhatsApp: consenso della cliente e registro degli invii partiti dall'app
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists whatsapp_eventi boolean not null default false,
  add column if not exists whatsapp_eventi_at timestamptz;

comment on column public.profiles.whatsapp_eventi is
  'La cliente vuole ricevere su WhatsApp gli avvisi degli eventi dello studio (consenso, casella nell''app).';

create table public.whatsapp_invii (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  evento_id uuid references public.eventi(id) on delete set null,
  schedule_id uuid references public.schedules(id) on delete set null,
  modello text not null,
  telefono text not null,
  esito text not null check (esito in ('inviato', 'errore', 'prova')),
  wa_id text,
  errore text,
  created_at timestamptz not null default now()
);

create index whatsapp_invii_studio on public.whatsapp_invii (studio_id, created_at desc);

alter table public.whatsapp_invii enable row level security;

create policy "whatsapp_invii_lettura" on public.whatsapp_invii for select to authenticated
  using (public.get_user_role() = 'admin' and studio_id = public.get_user_studio_id());

grant select on public.whatsapp_invii to authenticated;
grant all on public.whatsapp_invii to service_role;

commit;
