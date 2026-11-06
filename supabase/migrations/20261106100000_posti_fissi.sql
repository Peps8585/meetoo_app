-- Posti fissi, promemoria e lista d'attesa (S33, 6/11/2026).
--
-- Le clienti "fisse" hanno ogni settimana lo stesso posto senza prenotarsi.
-- Il posto e' TENUTO (status 'held': conta nei posti occupati, non scala
-- niente) su tutte le lezioni fino alla scadenza del pacchetto; quando la
-- cliente rinnova si allunga da solo. Una settimana prima diventa una
-- prenotazione vera e si scala come una prenotazione normale. Prima della
-- scadenza delle 24 ore arriva un promemoria con "Ci sono" / "Questa volta no".
-- Le jolly possono mettersi in lista d'attesa sulle lezioni piene: quando un
-- posto si libera ricevono un avviso e lo prende chi conferma per prima.
-- Nessuna entra da sola (decisione di Mattia, 6/11/2026).
--
-- book_lesson e cancel_booking restano identiche per chi le chiama: il loro
-- corpo passa in book_lesson_for / cancel_booking_for, che prendono la
-- cliente come parametro e servono anche al giro automatico (service role).

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabelle e campi
-- ---------------------------------------------------------------------------

alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status = any (array['confirmed','cancelled','waitlist','attended','no_show','held']));

create table public.fixed_slots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id),
  client_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id),
  weekday smallint not null check (weekday between 1 and 7),  -- ISO: 1 = lunedi'
  start_time time not null,                                    -- ora italiana
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (client_id, class_id, weekday, start_time)
);

alter table public.fixed_slots enable row level security;

create policy fixed_slots_admin on public.fixed_slots for all to authenticated
  using (get_user_role() = 'admin' and studio_id = get_user_studio_id())
  with check (get_user_role() = 'admin' and studio_id = get_user_studio_id());

create policy fixed_slots_own_read on public.fixed_slots for select to authenticated
  using (client_id = auth.uid());

alter table public.bookings
  add column fixed_slot_id uuid references public.fixed_slots(id) on delete set null,
  -- link del promemoria: "Ci sono" / "Questa volta no" senza entrare nell'app
  add column action_token text unique default encode(extensions.gen_random_bytes(16), 'hex'),
  add column reminder_sent_at timestamptz,
  add column reminder_channel text,                 -- 'push' | 'email' | 'nessuno'
  add column response text check (response in ('ci_sono','non_vengo')),
  add column responded_at timestamptz,
  -- posto fisso che non si e' potuto confermare (pacchetto finito)
  add column hold_issue text,                       -- 'no_credits' | 'released_no_credits'
  add column hold_issue_notified_at timestamptz,
  -- lista d'attesa: ultimo avviso "si e' liberato un posto"
  add column waitlist_notified_at timestamptz;

-- ultimo posto liberato: chi e' in lista riceve un avviso
alter table public.schedules add column spot_freed_at timestamptz;

create index idx_bookings_fixed_slot on public.bookings (fixed_slot_id) where fixed_slot_id is not null;
create index idx_bookings_status_schedule on public.bookings (status, schedule_id);

-- ---------------------------------------------------------------------------
-- 2. Addebito (stesso algoritmo di sempre: FIFO sulle tranche che scadono prima)
-- ---------------------------------------------------------------------------

create or replace function public._booking_price(p_schedule_id uuid)
returns numeric
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(s.price_override, c.price)
  from schedules s join classes c on c.id = s.class_id
  where s.id = p_schedule_id
$$;

create or replace function public._client_balance(p_client uuid)
returns numeric
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(sum(amount_remaining), 0)
  from client_packages
  where client_id = p_client and is_active = true
    and (expires_at is null or expires_at > now())
    and amount_remaining > 0
$$;

create or replace function public._debit_booking(p_client uuid, p_studio uuid, p_booking_id uuid, p_price numeric)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_residuo numeric := p_price; v_quota numeric; r_tranche record;
begin
  for r_tranche in
    select id, amount_remaining
    from client_packages
    where client_id = p_client and is_active = true
      and (expires_at is null or expires_at > now())
      and amount_remaining > 0
    order by expires_at asc nulls last
    for update
  loop
    exit when v_residuo <= 0;
    v_quota := least(r_tranche.amount_remaining, v_residuo);

    update client_packages
      set amount_remaining = amount_remaining - v_quota
    where id = r_tranche.id;

    insert into wallet_transactions
      (studio_id, client_id, amount, type, description,
       client_package_id, booking_id, created_at)
    values
      (p_studio, p_client, -v_quota, 'debit', 'Addebito prenotazione',
       r_tranche.id, p_booking_id, now());

    v_residuo := v_residuo - v_quota;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Prenotare
-- ---------------------------------------------------------------------------

create or replace function public.book_lesson_for(p_client uuid, p_schedule_id uuid)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_studio uuid; v_max int; v_current int;
  v_cancelled boolean; v_starts timestamptz;
  v_price numeric; v_booking_id uuid;
  v_min_booking_lead interval := interval '12 hours';
begin
  if p_client is null then raise exception 'not_authenticated'; end if;

  -- blocca la riga lezione: serializza prenotazioni concorrenti
  select studio_id, max_spots, coalesce(current_bookings,0), is_cancelled, starts_at
    into v_studio, v_max, v_current, v_cancelled, v_starts
  from schedules where id = p_schedule_id for update;

  if not found then raise exception 'schedule_not_found'; end if;
  if v_cancelled then raise exception 'schedule_cancelled'; end if;
  if v_starts <= now() then raise exception 'schedule_past'; end if;
  if v_starts - now() < v_min_booking_lead then raise exception 'booking_closed'; end if;
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

  insert into bookings (studio_id, client_id, schedule_id, status)
  values (v_studio, p_client, p_schedule_id, 'confirmed')
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

create or replace function public.book_lesson(p_schedule_id uuid)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return book_lesson_for(auth.uid(), p_schedule_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Lista d'attesa
-- ---------------------------------------------------------------------------

-- Un posto si e' liberato: se c'e' qualcuna in lista si segna l'ora, e il
-- giro manda l'avviso "si e' liberato un posto, lo vuoi?". Nessuna entra da
-- sola: il posto lo prende chi conferma per prima, prenotando come sempre.
create or replace function public._spot_freed(p_schedule_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update schedules set spot_freed_at = now()
  where id = p_schedule_id
    and starts_at - now() >= interval '12 hours'
    and exists (select 1 from bookings where schedule_id = p_schedule_id and status = 'waitlist');
end;
$$;

create or replace function public.join_waitlist(p_schedule_id uuid)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client uuid := auth.uid();
  v_studio uuid; v_max int; v_current int; v_cancelled boolean; v_starts timestamptz;
  v_price numeric; v_id uuid;
begin
  if v_client is null then raise exception 'not_authenticated'; end if;

  select studio_id, max_spots, coalesce(current_bookings,0), is_cancelled, starts_at
    into v_studio, v_max, v_current, v_cancelled, v_starts
  from schedules where id = p_schedule_id for update;

  if not found then raise exception 'schedule_not_found'; end if;
  if v_cancelled then raise exception 'schedule_cancelled'; end if;
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
-- 5. Cancellare (regola delle 24 ore e cancellazione tardiva gratis invariate)
-- ---------------------------------------------------------------------------

create or replace function public.cancel_booking_for(p_client uuid, p_booking_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_owner uuid; v_status text; v_schedule_id uuid; v_studio uuid;
  v_starts timestamptz;
  v_refunded boolean := false;
  v_use_bonus boolean := false;
  v_bonus_tranche uuid;
  r_debit record;
  v_tranche_alive boolean;
  v_any_refunded boolean := false;
begin
  if p_client is null then raise exception 'not_authenticated'; end if;

  select client_id, status, schedule_id, studio_id
    into v_owner, v_status, v_schedule_id, v_studio
  from bookings where id = p_booking_id for update;

  if not found then raise exception 'booking_not_found'; end if;
  if v_owner <> p_client then raise exception 'not_owner'; end if;

  -- uscire dalla lista d'attesa: niente soldi, niente posti
  if v_status = 'waitlist' then
    update bookings set status = 'cancelled', cancelled_at = now() where id = p_booking_id;
    return json_build_object('cancelled', true, 'refunded', false, 'used_bonus', false);
  end if;

  if v_status not in ('confirmed','held') then raise exception 'not_active'; end if;

  select starts_at into v_starts
  from schedules where id = v_schedule_id for update;

  -- posto fisso tenuto e non ancora scalato: si libera e basta
  if v_status = 'held' then
    update bookings set status = 'cancelled', cancelled_at = now() where id = p_booking_id;
    update schedules
      set current_bookings = greatest(0, coalesce(current_bookings,0) - 1)
    where id = v_schedule_id;
    perform _spot_freed(v_schedule_id);
    return json_build_object('cancelled', true, 'refunded', false, 'used_bonus', false);
  end if;

  if v_starts - now() >= interval '24 hours' then
    v_refunded := true;
  else
    select id into v_bonus_tranche
    from client_packages
    where client_id = p_client and is_active = true
      and (expires_at is null or expires_at > now())
      and amount_remaining >= 0
    order by expires_at asc nulls last
    limit 1 for update;

    if v_bonus_tranche is not null then
      if (select late_cancel_used from client_packages where id = v_bonus_tranche) = false then
        v_refunded := true;
        v_use_bonus := true;
      end if;
    end if;
  end if;

  update bookings
    set status = 'cancelled', cancelled_at = now() where id = p_booking_id;

  if v_refunded then
    for r_debit in
      select client_package_id, amount
      from wallet_transactions
      where booking_id = p_booking_id and type = 'debit'
    loop
      select (is_active = true and (expires_at is null or expires_at > now()))
        into v_tranche_alive
      from client_packages where id = r_debit.client_package_id for update;

      if coalesce(v_tranche_alive, false) then
        update client_packages
          set amount_remaining = amount_remaining + (-r_debit.amount)
        where id = r_debit.client_package_id;

        insert into wallet_transactions
          (studio_id, client_id, amount, type, description,
           client_package_id, booking_id, created_at)
        values
          (v_studio, p_client, -r_debit.amount, 'refund', 'Rimborso cancellazione',
           r_debit.client_package_id, p_booking_id, now());

        v_any_refunded := true;
      end if;
    end loop;

    if v_use_bonus and v_any_refunded then
      update client_packages
        set late_cancel_used = true where id = v_bonus_tranche;
    end if;
  end if;

  update schedules
    set current_bookings = greatest(0, coalesce(current_bookings,0) - 1)
  where id = v_schedule_id;

  perform _spot_freed(v_schedule_id);

  return json_build_object(
    'cancelled', true,
    'refunded', v_any_refunded,
    'used_bonus', (v_use_bonus and v_any_refunded)
  );
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return cancel_booking_for(auth.uid(), p_booking_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Posti fissi
-- ---------------------------------------------------------------------------

-- Lezioni future che corrispondono a un posto fisso (giorno, ora italiana, disciplina).
create or replace function public._fixed_slot_schedules(p_slot_id uuid)
returns setof public.schedules
language sql stable security definer set search_path to 'public'
as $$
  select s.*
  from schedules s
  join fixed_slots f on f.id = p_slot_id
  where s.studio_id = f.studio_id
    and s.class_id = f.class_id
    and not coalesce(s.is_cancelled, false)
    and s.starts_at > now() + interval '12 hours'
    and extract(isodow from s.starts_at at time zone 'Europe/Rome') = f.weekday
    and (s.starts_at at time zone 'Europe/Rome')::time = f.start_time
  order by s.starts_at
$$;

-- Tiene il posto sulle lezioni future del posto fisso, fino alla scadenza del
-- pacchetto della cliente (senza pacchetto attivo non tiene niente). Salta le
-- lezioni dove la cliente ha gia' una prenotazione (anche cancellata: "Questa
-- volta no" non si ricrea) e quelle gia' piene. Restituisce le date piene.
create or replace function public._hold_fixed_slot(p_slot_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_slot fixed_slots; r_sch record; v_held int := 0; v_full text[] := '{}';
  v_max int; v_current int; v_until timestamptz;
begin
  select * into v_slot from fixed_slots where id = p_slot_id;
  if not found or not v_slot.is_active then
    return json_build_object('held', 0, 'full', '[]'::json, 'until', null);
  end if;

  select case when bool_or(expires_at is null) then timestamptz 'infinity' else max(expires_at) end
    into v_until
  from client_packages
  where client_id = v_slot.client_id and is_active = true
    and (expires_at is null or expires_at > now());

  if v_until is null then
    return json_build_object('held', 0, 'full', '[]'::json, 'until', null);
  end if;

  for r_sch in select * from _fixed_slot_schedules(p_slot_id) where starts_at <= v_until loop
    if exists (select 1 from bookings where schedule_id = r_sch.id and client_id = v_slot.client_id) then
      continue;
    end if;

    select max_spots, coalesce(current_bookings,0) into v_max, v_current
    from schedules where id = r_sch.id for update;

    if v_current >= v_max then
      v_full := v_full || to_char(r_sch.starts_at at time zone 'Europe/Rome', 'YYYY-MM-DD');
      continue;
    end if;

    insert into bookings (studio_id, client_id, schedule_id, status, fixed_slot_id)
    values (v_slot.studio_id, v_slot.client_id, r_sch.id, 'held', v_slot.id);

    update schedules set current_bookings = coalesce(current_bookings,0) + 1 where id = r_sch.id;
    v_held := v_held + 1;
  end loop;

  return json_build_object('held', v_held, 'full', to_json(v_full),
    'until', case when v_until = 'infinity' then null else v_until end);
end;
$$;

-- Posto fisso tenuto -> prenotazione vera (si scala). Senza credito resta
-- tenuto e si segna il problema: il giro avvisa cliente e studio e riprova.
create or replace function public._confirm_hold(p_booking_id uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_b bookings; v_price numeric;
begin
  select * into v_b from bookings where id = p_booking_id for update;
  if not found or v_b.status <> 'held' then return 'skip'; end if;

  v_price := _booking_price(v_b.schedule_id);
  if v_price is null then return 'price_not_set'; end if;

  if _client_balance(v_b.client_id) < v_price then
    if v_b.hold_issue is distinct from 'no_credits' then
      update bookings set hold_issue = 'no_credits', hold_issue_notified_at = null where id = p_booking_id;
    end if;
    return 'no_credits';
  end if;

  perform _debit_booking(v_b.client_id, v_b.studio_id, p_booking_id, v_price);
  update bookings set status = 'confirmed', hold_issue = null, booked_at = now() where id = p_booking_id;
  return 'confirmed';
end;
$$;

-- Quando parte il promemoria: 12 ore prima della scadenza delle 24 ore, mai di
-- notte. Se cade tra le 21 e le 8 (ora italiana) arriva alle 20 della sera prima.
create or replace function public.reminder_due_at(p_starts timestamptz)
returns timestamptz
language plpgsql stable set search_path to 'public'
as $$
declare
  v_local timestamp := (p_starts - interval '36 hours') at time zone 'Europe/Rome';
begin
  if v_local::time >= time '21:00' then
    v_local := v_local::date + time '20:00';
  elsif v_local::time < time '08:00' then
    v_local := (v_local::date - 1) + time '20:00';
  end if;
  return v_local at time zone 'Europe/Rome';
end;
$$;

-- Il giro dei posti fissi (lo chiama /api/posti-fissi/giro ogni 10 minuti):
-- 1. tiene il posto sulle lezioni nuove del palinsesto
-- 2. a una settimana dalla lezione il posto tenuto diventa prenotazione
-- 3. se all'ora del promemoria il pacchetto e' ancora finito, il posto si libera
create or replace function public.posti_fissi_giro()
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  r record; v_res text; v_held int := 0; v_confirmed int := 0; v_released int := 0;
begin
  for r in select id from fixed_slots where is_active loop
    v_held := v_held + coalesce((_hold_fixed_slot(r.id)->>'held')::int, 0);
  end loop;

  for r in
    select b.id from bookings b join schedules s on s.id = b.schedule_id
    where b.status = 'held' and s.starts_at > now() and s.starts_at <= now() + interval '7 days'
    order by s.starts_at
  loop
    v_res := _confirm_hold(r.id);
    if v_res = 'confirmed' then v_confirmed := v_confirmed + 1; end if;
  end loop;

  for r in
    select b.id, b.schedule_id from bookings b join schedules s on s.id = b.schedule_id
    where b.status = 'held' and b.hold_issue = 'no_credits'
      and now() >= reminder_due_at(s.starts_at)
    for update of b
  loop
    update bookings
      set status = 'cancelled', cancelled_at = now(),
          hold_issue = 'released_no_credits', hold_issue_notified_at = null
    where id = r.id;
    update schedules set current_bookings = greatest(0, coalesce(current_bookings,0) - 1) where id = r.schedule_id;
    perform _spot_freed(r.schedule_id);
    v_released := v_released + 1;
  end loop;

  return json_build_object('tenuti', v_held, 'confermati', v_confirmed, 'liberati', v_released);
end;
$$;

-- Avvisi da mandare. Ognuna "prende in carico" le righe segnandole nello
-- stesso update, cosi' due giri sovrapposti non mandano lo stesso avviso due
-- volte. L'app poi manda notifica o email e scrive il canale usato.

-- Promemoria delle fisse: dall'ora giusta fino alla scadenza delle 24 ore.
create or replace function public.posti_fissi_promemoria()
returns table (booking_id uuid, client_id uuid, studio_id uuid, action_token text, starts_at timestamptz, class_name text)
language sql security definer set search_path to 'public'
as $$
  update bookings b
    set reminder_sent_at = now()
  from schedules s join classes c on c.id = s.class_id
  where s.id = b.schedule_id
    and b.status = 'confirmed' and b.fixed_slot_id is not null
    and b.reminder_sent_at is null and b.response is null
    and now() >= reminder_due_at(s.starts_at)
    and s.starts_at - now() > interval '24 hours'
    and not coalesce(s.is_cancelled, false)
  returning b.id, b.client_id, b.studio_id, b.action_token, s.starts_at, c.name
$$;

-- Pacchetto finito: il posto fisso non si e' potuto scalare, o e' stato liberato.
create or replace function public.posti_fissi_avvisi_pacchetto()
returns table (booking_id uuid, client_id uuid, studio_id uuid, issue text, starts_at timestamptz, class_name text)
language sql security definer set search_path to 'public'
as $$
  update bookings b
    set hold_issue_notified_at = now()
  from schedules s join classes c on c.id = s.class_id
  where s.id = b.schedule_id
    and b.hold_issue is not null and b.hold_issue_notified_at is null
    and s.starts_at > now()
  returning b.id, b.client_id, b.studio_id, b.hold_issue, s.starts_at, c.name
$$;

-- Posto liberato: chi e' in lista e non e' ancora stata avvisata di questo posto.
create or replace function public.posti_fissi_avvisi_lista()
returns table (booking_id uuid, client_id uuid, studio_id uuid, action_token text, starts_at timestamptz, class_name text)
language sql security definer set search_path to 'public'
as $$
  update bookings b
    set waitlist_notified_at = now()
  from schedules s join classes c on c.id = s.class_id
  where s.id = b.schedule_id
    and b.status = 'waitlist'
    and s.spot_freed_at is not null
    and (b.waitlist_notified_at is null or b.waitlist_notified_at < s.spot_freed_at)
    and coalesce(s.current_bookings, 0) < s.max_spots
    and s.starts_at - now() >= interval '12 hours'
    and not coalesce(s.is_cancelled, false)
  returning b.id, b.client_id, b.studio_id, b.action_token, s.starts_at, c.name
$$;

-- Per lo studio: aggiungere e togliere un posto fisso.
create or replace function public.fixed_slot_add(p_client uuid, p_class uuid, p_weekday int, p_time time)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_studio uuid := get_user_studio_id(); v_id uuid; v_res json;
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  if not exists (select 1 from profiles where id = p_client and studio_id = v_studio and role = 'client') then
    raise exception 'client_not_found';
  end if;
  if not exists (select 1 from classes where id = p_class and studio_id = v_studio) then
    raise exception 'class_not_found';
  end if;

  insert into fixed_slots (studio_id, client_id, class_id, weekday, start_time)
  values (v_studio, p_client, p_class, p_weekday, p_time)
  on conflict (client_id, class_id, weekday, start_time) do update set is_active = true
  returning id into v_id;

  v_res := _hold_fixed_slot(v_id);
  -- le lezioni entro la settimana diventano subito prenotazioni
  perform _confirm_hold(b.id)
  from bookings b join schedules s on s.id = b.schedule_id
  where b.fixed_slot_id = v_id and b.status = 'held' and s.starts_at <= now() + interval '7 days';

  return json_build_object('id', v_id, 'held', v_res->'held', 'full', v_res->'full', 'until', v_res->'until');
end;
$$;

-- Togliere un posto fisso libera i posti tenuti. Le lezioni gia' scalate
-- (entro la settimana) restano: la cliente puo' cancellarle come sempre.
create or replace function public.fixed_slot_remove(p_slot_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_slot fixed_slots; r record; v_freed int := 0;
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  select * into v_slot from fixed_slots where id = p_slot_id for update;
  if not found or v_slot.studio_id <> get_user_studio_id() then raise exception 'slot_not_found'; end if;

  update fixed_slots set is_active = false where id = p_slot_id;

  for r in select id, schedule_id from bookings where fixed_slot_id = p_slot_id and status = 'held' for update loop
    update bookings set status = 'cancelled', cancelled_at = now() where id = r.id;
    update schedules set current_bookings = greatest(0, coalesce(current_bookings,0) - 1) where id = r.schedule_id;
    perform _spot_freed(r.schedule_id);
    v_freed := v_freed + 1;
  end loop;

  return json_build_object('freed', v_freed);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6b. Nomi delle insegnanti per le clienti
-- ---------------------------------------------------------------------------

-- Una cliente legge solo il proprio profilo (RLS su profiles), quindi nel
-- palinsesto il nome dell'insegnante non le arrivava mai. Qui solo nome e
-- cognome delle insegnanti del suo studio: telefono, indirizzo e il resto
-- del profilo restano chiusi.
create or replace function public.nomi_insegnanti()
returns table (id uuid, first_name text, last_name text)
language sql stable security definer set search_path to 'public'
as $$
  select p.id, p.first_name, p.last_name
  from profiles p
  where p.studio_id = get_user_studio_id() and p.role = 'instructor'
$$;

revoke all on function public.nomi_insegnanti() from public, anon;
grant execute on function public.nomi_insegnanti() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Permessi: le funzioni "_for" e quelle interne solo dal server
-- ---------------------------------------------------------------------------

revoke all on function public.book_lesson_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_booking_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public._booking_price(uuid) from public, anon, authenticated;
revoke all on function public._client_balance(uuid) from public, anon, authenticated;
revoke all on function public._debit_booking(uuid, uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public._spot_freed(uuid) from public, anon, authenticated;
revoke all on function public._fixed_slot_schedules(uuid) from public, anon, authenticated;
revoke all on function public._hold_fixed_slot(uuid) from public, anon, authenticated;
revoke all on function public._confirm_hold(uuid) from public, anon, authenticated;
revoke all on function public.posti_fissi_giro() from public, anon, authenticated;
revoke all on function public.posti_fissi_promemoria() from public, anon, authenticated;
revoke all on function public.posti_fissi_avvisi_pacchetto() from public, anon, authenticated;
revoke all on function public.posti_fissi_avvisi_lista() from public, anon, authenticated;
revoke all on function public.join_waitlist(uuid) from public, anon;
revoke all on function public.fixed_slot_add(uuid, uuid, int, time) from public, anon;
revoke all on function public.fixed_slot_remove(uuid) from public, anon;

grant execute on function public.book_lesson_for(uuid, uuid) to service_role;
grant execute on function public.cancel_booking_for(uuid, uuid) to service_role;
grant execute on function public.posti_fissi_giro() to service_role;
grant execute on function public.posti_fissi_promemoria() to service_role;
grant execute on function public.posti_fissi_avvisi_pacchetto() to service_role;
grant execute on function public.posti_fissi_avvisi_lista() to service_role;
grant execute on function public.join_waitlist(uuid) to authenticated;
grant execute on function public.fixed_slot_add(uuid, uuid, int, time) to authenticated;
grant execute on function public.fixed_slot_remove(uuid) to authenticated;

commit;
