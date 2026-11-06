-- Foto profilo delle clienti (S33, 6/11/2026). Facoltativa.
-- La vede solo lo studio (admin e insegnanti dello stesso studio) e la cliente
-- stessa: lo spazio e' privato, le foto si aprono solo con link firmati e a
-- tempo creati dall'app. Decisione di Mattia: niente foto visibili alle altre
-- clienti, cosi' non servono consensi in piu' (basta una riga nell'informativa).
--
-- Percorso del file: <id cliente>/foto-<ora>.jpg ; profiles.avatar_url tiene il
-- percorso, non un indirizzo.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars_propria_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_propria_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_propria_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- la cliente vede la sua; admin e insegnanti quelle delle clienti del loro studio
create policy "avatars_lettura" on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        public.get_user_role() in ('admin', 'instructor')
        and exists (
          select 1 from public.profiles p
          where p.id::text = (storage.foldername(name))[1]
            and p.studio_id = public.get_user_studio_id()
        )
      )
    )
  );

commit;
