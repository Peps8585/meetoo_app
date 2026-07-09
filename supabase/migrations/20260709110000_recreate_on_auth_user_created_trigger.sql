-- Ricrea SOLO il trigger on_auth_user_created su auth.users.
-- La funzione public.handle_new_user e' gia' versionata dal baseline
-- (20260709103000_baseline_prod_schema.sql) e verificata identica a prod.
-- Il baseline (dump schema public) non include i trigger su auth.users,
-- quindi il trigger va ricreato esplicitamente. Idempotente.

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
