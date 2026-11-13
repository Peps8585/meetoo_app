-- Bacheca degli eventi dello studio (S35, 13/11/2026).
-- Giorgia (o noi) crea un post con foto, titolo, data e descrizione. Compare
-- nella home delle clienti e in /eventi, e sparisce da solo quando la data e'
-- passata. Ogni evento ha una pagina pubblica (/evento/<id>) da condividere:
-- la legge il server con la service role, quindi qui non servono regole per
-- chi non ha un account.
--
-- Le foto stanno nello spazio pubblico 'eventi' (sono locandine, non dati
-- personali): percorso <studio_id>/<nome file>, eventi.foto tiene il percorso.

begin;

create table public.eventi (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  titolo text not null check (length(btrim(titolo)) between 1 and 120),
  descrizione text not null default '' check (length(descrizione) <= 2000),
  inizio timestamptz not null,
  fine timestamptz check (fine is null or fine > inizio),
  foto text,
  pubblicato boolean not null default true,
  -- quando e' partito l'avviso a tutte (notifica, email, WhatsApp): uno solo per evento
  avviso_at timestamptz,
  avviso_esito jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index eventi_studio_inizio on public.eventi (studio_id, inizio);

alter table public.eventi enable row level security;

-- le clienti (e le insegnanti) vedono gli eventi pubblicati del loro studio
create policy "eventi_lettura" on public.eventi for select to authenticated
  using (studio_id = public.get_user_studio_id() and (pubblicato or public.get_user_role() = 'admin'));

-- lo studio li crea, li cambia e li toglie
create policy "eventi_studio" on public.eventi for all to authenticated
  using (public.get_user_role() = 'admin' and studio_id = public.get_user_studio_id())
  with check (public.get_user_role() = 'admin' and studio_id = public.get_user_studio_id());

grant select, insert, update, delete on public.eventi to authenticated;
grant all on public.eventi to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eventi', 'eventi', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "eventi_foto_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'eventi' and public.get_user_role() = 'admin'
    and (storage.foldername(name))[1] = public.get_user_studio_id()::text
  );

create policy "eventi_foto_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'eventi' and public.get_user_role() = 'admin'
    and (storage.foldername(name))[1] = public.get_user_studio_id()::text
  );

commit;
