-- Gift card: la chiave del giro dei regali programmati (2/11/2026).
-- La genera il database e la tiene nel Vault, cifrata. pg_cron la usa per
-- chiamare /api/regali/invia-programmati; l'app la rilegge con la service role
-- tramite gift_cron_secret(). Cosi' non va copiata a mano su Vercel.
-- Il job pg_cron e' a parte: punta all'indirizzo pubblico dell'app, diverso per
-- prova e produzione.

begin;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'gift_cron_secret', 'Chiave del giro dei regali programmati');

create or replace function public.gift_cron_secret()
returns text
language sql
security definer
set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'gift_cron_secret' $$;

revoke all on function public.gift_cron_secret() from public, anon, authenticated;
grant execute on function public.gift_cron_secret() to service_role;

commit;
