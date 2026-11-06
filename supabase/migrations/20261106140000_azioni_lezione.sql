-- Azioni dello studio su una lezione (S33, 6/11/2026), sul modello delle
-- opzioni di App Palestre che Giorgia usa oggi.
--
-- Regola confermata da Mattia: quando e' lo STUDIO a togliere una cliente o ad
-- annullare la lezione, la lezione torna sempre intera (rimborso pieno, a
-- qualunque ora: refund_booking_full, la stessa del sotto-soglia).
-- Le regole delle clienti (24 ore, cancellazione tardiva gratis) non cambiano.

begin;

-- chi ha fatto la prenotazione: 'app' (la cliente), 'studio', 'fisso' (il giro dei posti fissi)
alter table public.bookings
  add column booked_by text not null default 'app' check (booked_by in ('app', 'studio', 'fisso')),
  -- presenza segnata dallo studio o dall'insegnante (lo stato della prenotazione resta com'e')
  add column presenza text check (presenza in ('presente', 'assente')),
  add column presenza_segnata_at timestamptz;

update public.bookings set booked_by = 'fisso' where fixed_slot_id is not null;

-- i posti tenuti e confermati dal giro dei posti fissi risultano 'fisso'
create or replace function public._booked_by_fisso()
returns trigger
language plpgsql set search_path to 'public'
as $$
begin
  if new.fixed_slot_id is not null then new.booked_by := 'fisso'; end if;
  return new;
end;
$$;

create trigger bookings_booked_by_fisso before insert on public.bookings
  for each row execute function public._booked_by_fisso();

-- iscrizioni bloccate: nessuna nuova prenotazione dalle clienti, chi e' dentro resta
alter table public.schedules add column bookings_locked boolean not null default false;

-- ---------------------------------------------------------------------------
-- Prenotare: lo studio puo' aggiungere anche a iscrizioni chiuse o bloccate
-- ---------------------------------------------------------------------------

create or replace function public.book_lesson_for(p_client uuid, p_schedule_id uuid, p_da_studio boolean)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_studio uuid; v_max int; v_current int;
  v_cancelled boolean; v_starts timestamptz; v_locked boolean;
  v_price numeric; v_booking_id uuid;
  v_min_booking_lead interval := interval '12 hours';
begin
  if p_client is null then raise exception 'not_authenticated'; end if;

  -- blocca la riga lezione: serializza prenotazioni concorrenti
  select studio_id, max_spots, coalesce(current_bookings,0), is_cancelled, starts_at, bookings_locked
    into v_studio, v_max, v_current, v_cancelled, v_starts, v_locked
  from schedules where id = p_schedule_id for update;

  if not found then raise exception 'schedule_not_found'; end if;
  if v_cancelled then raise exception 'schedule_cancelled'; end if;
  if v_starts <= now() then raise exception 'schedule_past'; end if;
  if not p_da_studio then
    if v_starts - now() < v_min_booking_lead then raise exception 'booking_closed'; end if;
    if v_locked then raise exception 'booking_locked'; end if;
  end if;
  if v_current >= v_max then raise exception 'full'; end if;

  -- anche un posto fisso tenuto vale come gia' prenotato
  if exists (select 1 from bookings
    where schedule_id = p_schedule_id and client_id = p_client
      and status in ('confirmed','held')) then
    raise exception 'already_booked';
  end if;

  v_price := _booking_price(p_schedule_id);
  if v_price is null then raise exception 'price_not_set'; end if;
  if _client_balance(p_client) < v_price then raise exception 'no_credits'; end if;

  insert into bookings (studio_id, client_id, schedule_id, status, booked_by)
  values (v_studio, p_client, p_schedule_id, 'confirmed', case when p_da_studio then 'studio' else 'app' end)
  returning id into v_booking_id;

  perform _debit_booking(p_client, v_studio, v_booking_id, v_price);

  update schedules
    set current_bookings = coalesce(current_bookings,0) + 1
  where id = p_schedule_id;

  -- se era in lista d'attesa, ne esce
  delete from bookings
  where schedule_id = p_schedule_id and client_id = p_client and status = 'waitlist';

  return v_booking_id;
end;
$$;

-- la versione a due parametri resta quella chiamata dall'app e dai giri
drop function if exists public.book_lesson_for(uuid, uuid);
create or replace function public.book_lesson_for(p_client uuid, p_schedule_id uuid)
returns uuid
language sql security definer set search_path to 'public'
as $$ select book_lesson_for(p_client, p_schedule_id, false) $$;

-- lista d'attesa: anche qui le iscrizioni bloccate valgono
create or replace function public.join_waitlist(p_schedule_id uuid)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client uuid := auth.uid();
  v_studio uuid; v_max int; v_current int; v_cancelled boolean; v_starts timestamptz; v_locked boolean;
  v_price numeric; v_id uuid;
begin
  if v_client is null then raise exception 'not_authenticated'; end if;

  select studio_id, max_spots, coalesce(current_bookings,0), is_cancelled, starts_at, bookings_locked
    into v_studio, v_max, v_current, v_cancelled, v_starts, v_locked
  from schedules where id = p_schedule_id for update;

  if not found then raise exception 'schedule_not_found'; end if;
  if v_cancelled then raise exception 'schedule_cancelled'; end if;
  if v_locked then raise exception 'booking_locked'; end if;
  if v_starts - now() < interval '12 hours' then raise exception 'booking_closed'; end if;
  if v_current < v_max then raise exception 'not_full'; end if;

  if exists (select 1 from bookings where schedule_id = p_schedule_id and client_id = v_client
             and status in ('confirmed','held','waitlist')) then
    raise exception 'already_booked';
  end if;

  v_price := _booking_price(p_schedule_id);
  if v_price is null then raise exception 'price_not_set'; end if;
  if _client_balance(v_client) < v_price then raise exception 'no_credits'; end if;

  insert into bookings (studio_id, client_id, schedule_id, status)
  values (v_studio, v_client, p_schedule_id, 'waitlist')
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Controllo comune: chi chiama e' admin dello studio della lezione
-- ---------------------------------------------------------------------------

create or replace function public._studio_admin_di(p_schedule_id uuid)
returns void
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  if not exists (select 1 from schedules where id = p_schedule_id and studio_id = get_user_studio_id()) then
    raise exception 'schedule_not_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gestione prenotazioni
-- ---------------------------------------------------------------------------

-- Lo studio aggiunge una cliente: si scala dal suo pacchetto come se si fosse
-- prenotata da sola, anche se le iscrizioni sono chiuse o bloccate.
create or replace function public.studio_aggiungi_cliente(p_schedule_id uuid, p_client uuid)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform _studio_admin_di(p_schedule_id);
  if not exists (select 1 from profiles where id = p_client and studio_id = get_user_studio_id() and role = 'client') then
    raise exception 'client_not_found';
  end if;
  return book_lesson_for(p_client, p_schedule_id, true);
end;
$$;

-- Lo studio toglie una cliente: la lezione le torna intera. Un posto fisso
-- tenuto o la lista d'attesa si liberano e basta.
create or replace function public.studio_togli_prenotazione(p_booking_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_b bookings; v_res json;
begin
  select * into v_b from bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  perform _studio_admin_di(v_b.schedule_id);

  if v_b.status = 'confirmed' then
    v_res := refund_booking_full(p_booking_id);
  elsif v_b.status = 'held' then
    update bookings set status = 'cancelled', cancelled_at = now() where id = p_booking_id;
    update schedules set current_bookings = greatest(0, coalesce(current_bookings,0) - 1) where id = v_b.schedule_id;
    v_res := json_build_object('cancelled', true, 'refunded', false);
  elsif v_b.status = 'waitlist' then
    update bookings set status = 'cancelled', cancelled_at = now() where id = p_booking_id;
    return json_build_object('cancelled', true, 'refunded', false);
  else
    raise exception 'not_active';
  end if;

  perform _spot_freed(v_b.schedule_id);
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- Annullare la lezione: tutte le iscritte riavranno la lezione intera
-- ---------------------------------------------------------------------------

create or replace function public.studio_annulla_lezione(p_schedule_id uuid)
returns table (client_id uuid, era text, rimborsata boolean)
language plpgsql security definer set search_path to 'public'
as $$
declare
  r record; v_res json;
begin
  perform _studio_admin_di(p_schedule_id);
  perform 1 from schedules where id = p_schedule_id for update;

  for r in
    select b.id, b.client_id, b.status from bookings b
    where b.schedule_id = p_schedule_id and b.status in ('confirmed', 'held', 'waitlist')
    for update
  loop
    if r.status = 'confirmed' then
      v_res := refund_booking_full(r.id);
      client_id := r.client_id; era := 'confirmed'; rimborsata := coalesce((v_res->>'refunded')::boolean, false);
    else
      update bookings set status = 'cancelled', cancelled_at = now() where id = r.id;
      client_id := r.client_id; era := r.status; rimborsata := false;
    end if;
    return next;
  end loop;

  update schedules set is_cancelled = true, current_bookings = 0, spot_freed_at = null where id = p_schedule_id;
end;
$$;

-- Cancellare del tutto si puo' solo se non c'e' mai stata nessuna prenotazione
-- attiva: cosi' non sparisce nessun pagamento.
create or replace function public.studio_elimina_lezione(p_schedule_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform _studio_admin_di(p_schedule_id);
  if exists (select 1 from bookings where schedule_id = p_schedule_id and status <> 'cancelled') then
    raise exception 'has_bookings';
  end if;
  if exists (select 1 from wallet_transactions w join bookings b on b.id = w.booking_id where b.schedule_id = p_schedule_id) then
    raise exception 'has_payments';
  end if;
  delete from bookings where schedule_id = p_schedule_id;
  delete from schedules where id = p_schedule_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Modificare e duplicare
-- ---------------------------------------------------------------------------

create or replace function public.studio_modifica_lezione(
  p_schedule_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_instructor uuid, p_max_spots int, p_notes text
)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_s schedules; v_ora_cambiata boolean;
begin
  perform _studio_admin_di(p_schedule_id);
  select * into v_s from schedules where id = p_schedule_id for update;

  if p_ends_at <= p_starts_at then raise exception 'orario_non_valido'; end if;
  if p_max_spots < coalesce(v_s.current_bookings, 0) then raise exception 'posti_sotto_iscritte'; end if;
  if p_instructor is not null and not exists (
    select 1 from profiles where id = p_instructor and studio_id = get_user_studio_id() and role = 'instructor'
  ) then raise exception 'instructor_not_found'; end if;

  v_ora_cambiata := v_s.starts_at <> p_starts_at;

  update schedules
    set starts_at = p_starts_at, ends_at = p_ends_at, instructor_id = p_instructor,
        max_spots = p_max_spots, notes = nullif(trim(p_notes), '')
  where id = p_schedule_id;

  -- piu' posti: chi e' in lista viene avvisata
  if p_max_spots > coalesce(v_s.max_spots, 0) then perform _spot_freed(p_schedule_id); end if;

  return json_build_object('ora_cambiata', v_ora_cambiata);
end;
$$;

create or replace function public.studio_duplica_lezione(p_schedule_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_s schedules; v_id uuid;
begin
  perform _studio_admin_di(p_schedule_id);
  select * into v_s from schedules where id = p_schedule_id;
  insert into schedules (studio_id, class_id, instructor_id, starts_at, ends_at, max_spots, current_bookings,
                         location, notes, price_override)
  values (v_s.studio_id, v_s.class_id, v_s.instructor_id, p_starts_at, p_starts_at + (v_s.ends_at - v_s.starts_at),
          v_s.max_spots, 0, v_s.location, v_s.notes, v_s.price_override)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.studio_blocca_iscrizioni(p_schedule_id uuid, p_bloccate boolean)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform _studio_admin_di(p_schedule_id);
  update schedules set bookings_locked = p_bloccate where id = p_schedule_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Presenze: le segna lo studio o l'insegnante della lezione
-- ---------------------------------------------------------------------------

create or replace function public.segna_presenza(p_booking_id uuid, p_presenza text)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_schedule uuid; v_instructor uuid; v_studio uuid;
begin
  if p_presenza is not null and p_presenza not in ('presente', 'assente') then raise exception 'presenza_non_valida'; end if;
  select b.schedule_id, s.instructor_id, s.studio_id into v_schedule, v_instructor, v_studio
  from bookings b join schedules s on s.id = b.schedule_id
  where b.id = p_booking_id and b.status in ('confirmed', 'held');
  if not found then raise exception 'booking_not_found'; end if;
  if v_studio <> get_user_studio_id()
     or not (get_user_role() = 'admin' or (get_user_role() = 'instructor' and v_instructor = auth.uid())) then
    raise exception 'not_allowed';
  end if;
  update bookings set presenza = p_presenza, presenza_segnata_at = now() where id = p_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permessi
-- ---------------------------------------------------------------------------

revoke all on function public.book_lesson_for(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.book_lesson_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.book_lesson_for(uuid, uuid, boolean) to service_role;
grant execute on function public.book_lesson_for(uuid, uuid) to service_role;
revoke all on function public._studio_admin_di(uuid) from public, anon, authenticated;

revoke all on function public.studio_aggiungi_cliente(uuid, uuid) from public, anon;
revoke all on function public.studio_togli_prenotazione(uuid) from public, anon;
revoke all on function public.studio_annulla_lezione(uuid) from public, anon;
revoke all on function public.studio_elimina_lezione(uuid) from public, anon;
revoke all on function public.studio_modifica_lezione(uuid, timestamptz, timestamptz, uuid, int, text) from public, anon;
revoke all on function public.studio_duplica_lezione(uuid, timestamptz) from public, anon;
revoke all on function public.studio_blocca_iscrizioni(uuid, boolean) from public, anon;
revoke all on function public.segna_presenza(uuid, text) from public, anon;

grant execute on function public.studio_aggiungi_cliente(uuid, uuid) to authenticated;
grant execute on function public.studio_togli_prenotazione(uuid) to authenticated;
grant execute on function public.studio_annulla_lezione(uuid) to authenticated;
grant execute on function public.studio_elimina_lezione(uuid) to authenticated;
grant execute on function public.studio_modifica_lezione(uuid, timestamptz, timestamptz, uuid, int, text) to authenticated;
grant execute on function public.studio_duplica_lezione(uuid, timestamptz) to authenticated;
grant execute on function public.studio_blocca_iscrizioni(uuid, boolean) to authenticated;
grant execute on function public.segna_presenza(uuid, text) to authenticated;

commit;
