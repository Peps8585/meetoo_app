-- Ruolo, studio e stato attivo del profilo non si cambiano dall'app (13/11/2026).
--
-- La regola "Utente aggiorna il proprio profilo" lascia a ogni persona
-- collegata la modifica della propria riga, senza distinguere le colonne: una
-- cliente poteva scriversi role = 'admin' con una chiamata dal browser e
-- vedere i dati di tutte. Verificato il 13/11/2026 su prova e produzione:
-- nessun trigger, permesso UPDATE su role e studio_id per 'authenticated'.
--
-- Da qui in poi quelle tre colonne cambiano solo dal server (service role) o
-- dalle funzioni del database. Nome, telefono, foto e consensi restano liberi.

begin;

create or replace function public.profili_campi_protetti()
returns trigger
language plpgsql
as $$
begin
  -- chi arriva dall'app con la propria sessione e' 'authenticated' (o 'anon');
  -- il server con la service role e le funzioni security definer non lo sono
  if tg_op = 'INSERT' then
    -- la riga la crea il trigger della registrazione; se qualcuno la inserisce
    -- dall'app (la regola di inserimento e' aperta) nasce comunque cliente
    if current_user in ('authenticated', 'anon') then
      new.role := 'client';
      new.is_active := true;
    end if;
    return new;
  end if;
  if current_user in ('authenticated', 'anon')
     and (new.role is distinct from old.role
          or new.studio_id is distinct from old.studio_id
          or new.is_active is distinct from old.is_active)
  then
    raise exception 'campo_protetto' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profili_campi_protetti on public.profiles;
create trigger profili_campi_protetti
  before insert or update on public.profiles
  for each row execute function public.profili_campi_protetti();

commit;
