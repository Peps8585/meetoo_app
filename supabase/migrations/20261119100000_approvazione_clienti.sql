-- Le clienti nuove aspettano la conferma dello studio (richiesta di Mattia del 19/11/2026).
--
-- Chi si registra dall'app puo' guardare, ma non prenotare ne' mettersi in
-- lista d'attesa finche' Giorgia non la conferma dall'admin: lo studio deve
-- sapere chi e' la persona. Le clienti che ci sono gia' restano confermate.
--
-- profiles.approvata_at: quando lo studio l'ha confermata (null = in attesa).
-- Si scrive solo dal server o da approva_cliente(), mai dall'app della cliente.

begin;

alter table public.profiles add column if not exists approvata_at timestamptz;

-- chi c'e' gia' (clienti, insegnanti, admin) e' confermata da sempre
update public.profiles set approvata_at = coalesce(created_at, now()) where approvata_at is null;

-- la colonna si aggiunge ai campi protetti del 13/11
create or replace function public.profili_campi_protetti()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      new.role := 'client';
      new.is_active := true;
      new.approvata_at := null;
    end if;
    return new;
  end if;
  if current_user in ('authenticated', 'anon')
     and (new.role is distinct from old.role
          or new.studio_id is distinct from old.studio_id
          or new.is_active is distinct from old.is_active
          or new.approvata_at is distinct from old.approvata_at)
  then
    raise exception 'campo_protetto' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Una cliente non confermata non si iscrive da sola a una lezione. Vale per
-- prenotazione e lista d'attesa (sono tutte e due righe in bookings); se e'
-- lo studio a iscriverla (auth.uid() diverso dalla cliente) passa.
create or replace function public.bookings_solo_confermate()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is not null and new.client_id = auth.uid()
     and exists (select 1 from profiles
                 where id = new.client_id and role = 'client' and approvata_at is null)
  then
    raise exception 'not_approved';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_solo_confermate on public.bookings;
create trigger bookings_solo_confermate
  before insert on public.bookings
  for each row execute function public.bookings_solo_confermate();

-- Lo studio conferma (p_si = true) o non accetta (p_si = false) una cliente.
-- Non accettata: il profilo si disattiva e resta senza conferma.
create or replace function public.approva_cliente(p_client uuid, p_si boolean)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_studio uuid;
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  select studio_id into v_studio from profiles where id = auth.uid();
  if not exists (select 1 from profiles where id = p_client and studio_id = v_studio and role = 'client') then
    raise exception 'client_not_found';
  end if;
  if p_si then
    update profiles set approvata_at = now(), is_active = true where id = p_client;
  else
    update profiles set is_active = false where id = p_client;
  end if;
end;
$$;

revoke all on function public.approva_cliente(uuid, boolean) from public, anon;
grant execute on function public.approva_cliente(uuid, boolean) to authenticated;

commit;
