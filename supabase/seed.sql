-- Seed: tenant-radice (studio Mee Too)
-- id hardcoded IDENTICO a produzione, cosi' ogni ambiente ricostruito da zero
-- (dev usa-e-getta, rehearsal di agosto) nasce col tenant giusto e il trigger
-- handle_new_user (lookup slug='meetoo') popola profiles.studio_id.
-- Idempotente: on conflict (id) do nothing.
insert into public.studios (id, name, slug, email)
values ('58b3d7bb-ada6-4818-b80e-0e45acdafb43', 'Mee Too Pilates',
        'meetoo', 'info@meetoopilates.it')
on conflict (id) do nothing;
