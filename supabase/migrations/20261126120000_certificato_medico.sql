-- Certificato medico nel profilo della cliente (Mattia e Giorgia, prova del 26/11/2026).
--
-- E' un dato sulla salute: spazio privato, lo vedono solo la cliente e le admin del suo
-- studio (non le insegnanti, non le altre clienti). Si apre con link firmati e a tempo.
-- La cliente lo carica con il consenso (data salvata) e scrive la scadenza.
-- Percorso del file: <id cliente>/certificato-<ora>.<estensione>

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificati', 'certificati', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "certificati_propria_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'certificati' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "certificati_propria_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'certificati' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "certificati_lettura" on storage.objects for select to authenticated
  using (
    bucket_id = 'certificati' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        public.get_user_role() = 'admin'
        and exists (
          select 1 from public.profiles p
          where p.id::text = (storage.foldername(name))[1]
            and p.studio_id = public.get_user_studio_id()
        )
      )
    )
  );

alter table public.profiles
  add column if not exists certificato_path text,
  add column if not exists certificato_scadenza date,
  add column if not exists certificato_caricato_at timestamptz,
  add column if not exists certificato_consenso_at timestamptz;

commit;
