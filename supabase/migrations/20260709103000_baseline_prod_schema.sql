


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."book_lesson"("p_schedule_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_client uuid := auth.uid();
  v_studio uuid; v_max int; v_current int;
  v_cancelled boolean; v_starts timestamptz;
  v_class_id uuid; v_price numeric;
  v_balance numeric; v_booking_id uuid;
  v_residuo numeric; v_quota numeric;
  r_tranche record;
  v_min_booking_lead interval := interval '12 hours';   -- [NUOVO] finestra minima iscrizione
begin
  if v_client is null then raise exception 'not_authenticated'; end if;

  -- [PRESERVATO] blocca la riga lezione: serializza prenotazioni concorrenti
  select studio_id, class_id, max_spots, coalesce(current_bookings,0),
         is_cancelled, starts_at
    into v_studio, v_class_id, v_max, v_current, v_cancelled, v_starts
  from schedules where id = p_schedule_id for update;

  if not found then raise exception 'schedule_not_found'; end if;
  if v_cancelled then raise exception 'schedule_cancelled'; end if;
  if v_starts <= now() then raise exception 'schedule_past'; end if;

  -- [NUOVO] iscrizione chiusa se manca meno della finestra minima all'inizio
  if v_starts - now() < v_min_booking_lead then
    raise exception 'booking_closed';
  end if;

  if v_current >= v_max then raise exception 'full'; end if;

  if exists (select 1 from bookings
    where schedule_id = p_schedule_id and client_id = v_client
      and status = 'confirmed') then
    raise exception 'already_booked';
  end if;

  -- [NUOVO] prezzo effettivo: override del workshop, altrimenti prezzo disciplina
  select coalesce(s.price_override, c.price)
    into v_price
  from schedules s
  join classes c on c.id = s.class_id
  where s.id = p_schedule_id;

  if v_price is null then raise exception 'price_not_set'; end if;

  -- [NUOVO] saldo totale delle tranche vive
  select coalesce(sum(amount_remaining), 0)
    into v_balance
  from client_packages
  where client_id = v_client and is_active = true
    and (expires_at is null or expires_at > now())
    and amount_remaining > 0;

  if v_balance < v_price then raise exception 'no_credits'; end if;

  -- [PRESERVATO] inserimento prenotazione (client_package_id ora LEGACY -> NULL)
  insert into bookings (studio_id, client_id, schedule_id, status)
  values (v_studio, v_client, p_schedule_id, 'confirmed')
  returning id into v_booking_id;

  -- [NUOVO] addebito split-debit FIFO: scala dalle tranche che scadono prima
  v_residuo := v_price;
  for r_tranche in
    select id, amount_remaining
    from client_packages
    where client_id = v_client and is_active = true
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
      (v_studio, v_client, -v_quota, 'debit', 'Addebito prenotazione',
       r_tranche.id, v_booking_id, now());

    v_residuo := v_residuo - v_quota;
  end loop;

  -- [PRESERVATO] contatore posti
  update schedules
    set current_bookings = coalesce(current_bookings,0) + 1
  where id = p_schedule_id;

  return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."book_lesson"("p_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_client uuid := auth.uid();
  v_owner uuid; v_status text; v_schedule_id uuid; v_studio uuid;
  v_starts timestamptz;
  v_refunded boolean := false;
  v_use_bonus boolean := false;
  v_bonus_tranche uuid;
  r_debit record;
  v_tranche_alive boolean;
  v_any_refunded boolean := false;
begin
  if v_client is null then raise exception 'not_authenticated'; end if;

  select client_id, status, schedule_id, studio_id
    into v_owner, v_status, v_schedule_id, v_studio
  from bookings where id = p_booking_id for update;

  if not found then raise exception 'booking_not_found'; end if;
  if v_owner <> v_client then raise exception 'not_owner'; end if;
  if v_status <> 'confirmed' then raise exception 'not_active'; end if;

  select starts_at into v_starts
  from schedules where id = v_schedule_id for update;

  if v_starts - now() >= interval '24 hours' then
    v_refunded := true;
  else
    select id into v_bonus_tranche
    from client_packages
    where client_id = v_client and is_active = true
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
          (v_studio, v_client, -r_debit.amount, 'refund', 'Rimborso cancellazione',
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

  return json_build_object(
    'cancelled', true,
    'refunded', v_any_refunded,            -- << MODIFICA: rimborso reale, non eleggibilità
    'used_bonus', (v_use_bonus and v_any_refunded)
  );
end;
$$;


ALTER FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_studio_id"() RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT studio_id FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_studio_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_studio_id UUID;
BEGIN
  SELECT id INTO v_studio_id 
  FROM public.studios 
  WHERE slug = 'meetoo' 
  LIMIT 1;

  INSERT INTO public.profiles (id, studio_id, role)
  VALUES (NEW.id, v_studio_id, 'client');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Errore handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_booking_full"("p_booking_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_status text; v_schedule_id uuid; v_studio uuid; v_client uuid;
  r_debit record; v_alive boolean;
  v_any_refunded boolean := false;
  v_reactivated  boolean := false;
begin
  select status, schedule_id, studio_id, client_id
    into v_status, v_schedule_id, v_studio, v_client
  from bookings where id = p_booking_id for update;

  if not found then raise exception 'booking_not_found'; end if;

  -- idempotenza: se non e' piu' confirmed, non faccio nulla (no doppio rimborso)
  if v_status <> 'confirmed' then
    return json_build_object('cancelled', false, 'refunded', false,
      'reactivated_tranche', false, 'note', 'already_not_confirmed');
  end if;

  update bookings set status = 'cancelled', cancelled_at = now()
  where id = p_booking_id;

  for r_debit in
    select client_package_id, amount
    from wallet_transactions
    where booking_id = p_booking_id and type = 'debit'
  loop
    if r_debit.client_package_id is null then continue; end if;

    select (is_active = true and (expires_at is null or expires_at > now()))
      into v_alive
    from client_packages where id = r_debit.client_package_id for update;

    if coalesce(v_alive, false) then
      update client_packages
        set amount_remaining = amount_remaining + (-r_debit.amount)
      where id = r_debit.client_package_id;
    else
      -- Opzione 1: tranche morta -> riattiva + proroga, poi rimborsa
      update client_packages
        set is_active = true,
            expires_at = greatest(coalesce(expires_at, now()),
                                  now() + interval '30 days'),
            amount_remaining = amount_remaining + (-r_debit.amount)
      where id = r_debit.client_package_id;
      v_reactivated := true;
    end if;

    insert into wallet_transactions
      (studio_id, client_id, amount, type, description,
       client_package_id, booking_id, created_at)
    values
      (v_studio, v_client, -r_debit.amount, 'refund',
       'Rimborso pieno annullamento studio (sotto-soglia)',
       r_debit.client_package_id, p_booking_id, now());

    v_any_refunded := true;
  end loop;

  update schedules
    set current_bookings = greatest(0, coalesce(current_bookings,0) - 1)
  where id = v_schedule_id;

  return json_build_object('cancelled', true, 'refunded', v_any_refunded,
                           'reactivated_tranche', v_reactivated);
end;
$$;


ALTER FUNCTION "public"."refund_booking_full"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_subthreshold_refund"("p_decision_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_client uuid := auth.uid();
  v_owner uuid; v_state text; v_schedule_id uuid; v_booking_id uuid;
begin
  if v_client is null then raise exception 'not_authenticated'; end if;
  select client_id, state, schedule_id, booking_id
    into v_owner, v_state, v_schedule_id, v_booking_id
  from subthreshold_decisions where id = p_decision_id for update;
  if not found then raise exception 'decision_not_found'; end if;
  if v_owner <> v_client then raise exception 'not_owner'; end if;
  if v_state <> 'pending' then raise exception 'decision_not_pending'; end if;

  perform refund_booking_full(v_booking_id);
  update schedules set is_cancelled = true where id = v_schedule_id;
  update subthreshold_decisions
    set state = 'resolved_refunded', auto_applied = false, resolved_at = now()
  where id = p_decision_id;
  return json_build_object('resolved', true, 'choice', 'refund');
end;
$$;


ALTER FUNCTION "public"."resolve_subthreshold_refund"("p_decision_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_subthreshold_reschedule"("p_decision_id" "uuid", "p_target_schedule_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_client uuid := auth.uid();
  v_owner uuid; v_state text; v_orig_schedule_id uuid; v_orig_booking_id uuid;
  v_new_booking_id uuid;
begin
  if v_client is null then raise exception 'not_authenticated'; end if;
  select client_id, state, schedule_id, booking_id
    into v_owner, v_state, v_orig_schedule_id, v_orig_booking_id
  from subthreshold_decisions where id = p_decision_id for update;
  if not found then raise exception 'decision_not_found'; end if;
  if v_owner <> v_client then raise exception 'not_owner'; end if;
  if v_state <> 'pending' then raise exception 'decision_not_pending'; end if;
  if p_target_schedule_id = v_orig_schedule_id then raise exception 'same_schedule'; end if;

  perform refund_booking_full(v_orig_booking_id);
  update schedules set is_cancelled = true where id = v_orig_schedule_id;

  v_new_booking_id := book_lesson(p_target_schedule_id);  -- legge auth.uid()

  update subthreshold_decisions
    set state = 'resolved_rescheduled', resolved_at = now()
  where id = p_decision_id;
  return json_build_object('resolved', true, 'choice', 'reschedule',
                           'new_booking_id', v_new_booking_id);
end;
$$;


ALTER FUNCTION "public"."resolve_subthreshold_reschedule"("p_decision_id" "uuid", "p_target_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sweep_subthreshold_deadline"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r_dec record; v_processed int := 0;
begin
  for r_dec in
    select id, schedule_id, booking_id from subthreshold_decisions
    where state = 'pending' and decision_deadline is not null
      and decision_deadline <= now()
    for update skip locked
  loop
    perform refund_booking_full(r_dec.booking_id);  -- idempotente
    update schedules set is_cancelled = true where id = r_dec.schedule_id;
    update subthreshold_decisions
      set state = 'resolved_refunded', auto_applied = true, resolved_at = now()
    where id = r_dec.id;
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;


ALTER FUNCTION "public"."sweep_subthreshold_deadline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sweep_subthreshold_detect"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r_sched record; v_count int; v_booking_id uuid; v_client_id uuid;
  v_processed int := 0;
begin
  for r_sched in
    select id, studio_id from schedules
    where subthreshold_checked = false and is_cancelled = false
      and starts_at > now() and starts_at <= now() + interval '12 hours'
    for update skip locked
  loop
    select count(*) into v_count
    from bookings where schedule_id = r_sched.id and status = 'confirmed';

    if v_count = 0 then
      insert into subthreshold_decisions
        (studio_id, schedule_id, booking_id, client_id, state,
         bookings_at_check, detected_at, resolved_at, auto_applied)
      values (r_sched.studio_id, r_sched.id, null, null, 'cancelled_empty',
              0, now(), now(), true)
      on conflict (schedule_id) do nothing;
      update schedules set is_cancelled = true where id = r_sched.id;

    elsif v_count = 1 then
      select id, client_id into v_booking_id, v_client_id
      from bookings where schedule_id = r_sched.id and status = 'confirmed';
      insert into subthreshold_decisions
        (studio_id, schedule_id, booking_id, client_id, state,
         bookings_at_check, detected_at, decision_deadline)
      values (r_sched.studio_id, r_sched.id, v_booking_id, v_client_id, 'pending',
              1, now(), now() + interval '1 hour')
      on conflict (schedule_id) do nothing;
    -- v_count >= 2: confermata, nessuna riga
    end if;

    update schedules set subthreshold_checked = true where id = r_sched.id;
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;


ALTER FUNCTION "public"."sweep_subthreshold_detect"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "client_package_id" "uuid",
    "status" "text" DEFAULT 'confirmed'::"text",
    "booked_at" timestamp with time zone DEFAULT "now"(),
    "cancelled_at" timestamp with time zone,
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['confirmed'::"text", 'cancelled'::"text", 'waitlist'::"text", 'attended'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "color" "text" DEFAULT '#a8876a'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "price" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "author_id" "uuid",
    "note_text" "text" NOT NULL,
    "studio_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_packages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "credits_total" integer NOT NULL,
    "credits_used" integer DEFAULT 0,
    "price_paid" numeric(10,2),
    "purchased_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "amount_initial" numeric DEFAULT 0 NOT NULL,
    "amount_remaining" numeric DEFAULT 0 NOT NULL,
    "late_cancel_used" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."client_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "title" "text" NOT NULL,
    "type" "text",
    "url" "text",
    "duration_seconds" integer,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_items_type_check" CHECK (("type" = ANY (ARRAY['pdf'::"text", 'video'::"text", 'audio'::"text", 'link'::"text"])))
);


ALTER TABLE "public"."content_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_campaigns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text",
    "segment" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "sent_at" timestamp with time zone,
    "recipients_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'sent'::"text"])))
);


ALTER TABLE "public"."email_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_registrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'registered'::"text",
    "amount_paid" numeric(10,2) DEFAULT 0,
    "registered_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_registrations_status_check" CHECK (("status" = ANY (ARRAY['registered'::"text", 'cancelled'::"text", 'attended'::"text"])))
);


ALTER TABLE "public"."event_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "location" "text",
    "max_spots" integer,
    "price" numeric(10,2) DEFAULT 0,
    "cover_url" "text",
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "client_package_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "vat_amount" numeric(10,2) DEFAULT 0,
    "invoice_number" "text",
    "fatture_in_cloud_id" "text",
    "sdi_status" "text" DEFAULT 'draft'::"text",
    "pdf_url" "text",
    "issued_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "invoices_sdi_status_check" CHECK (("sdi_status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "credits" integer NOT NULL,
    "validity_days" integer,
    "price" numeric(10,2) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "credit_amount" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) DEFAULT 0,
    "is_free" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "cover_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "studio_id" "uuid",
    "role" "text" DEFAULT 'client'::"text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "date_of_birth" "date",
    "avatar_url" "text",
    "medical_notes" "text",
    "fiscal_code" "text",
    "address" "text",
    "city" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['client'::"text", 'instructor'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "key_p256dh" "text" NOT NULL,
    "key_auth" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_success_at" timestamp with time zone
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "instructor_id" "uuid",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "max_spots" integer DEFAULT 10 NOT NULL,
    "current_bookings" integer DEFAULT 0,
    "location" "text",
    "notes" "text",
    "is_cancelled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "price_override" numeric,
    "subthreshold_checked" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."studios" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "city" "text",
    "vat_number" "text",
    "fiscal_code" "text",
    "logo_url" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."studios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subthreshold_decisions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "client_id" "uuid",
    "state" "text" NOT NULL,
    "bookings_at_check" integer NOT NULL,
    "detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decision_deadline" timestamp with time zone,
    "notified_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "auto_applied" boolean DEFAULT false NOT NULL,
    CONSTRAINT "subthreshold_decisions_bookings_at_check_check" CHECK (("bookings_at_check" >= 0)),
    CONSTRAINT "subthreshold_decisions_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'resolved_rescheduled'::"text", 'resolved_refunded'::"text", 'cancelled_empty'::"text"])))
);


ALTER TABLE "public"."subthreshold_decisions" OWNER TO "postgres";


COMMENT ON TABLE "public"."subthreshold_decisions" IS 'Stato macchina cron sotto-soglia. UNIQUE(schedule_id) = idempotenza del cron.';



CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "type" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_package_id" "uuid",
    "booking_id" "uuid",
    CONSTRAINT "wallet_transactions_type_check" CHECK (("type" = ANY (ARRAY['credit'::"text", 'debit'::"text", 'refund'::"text"])))
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_packages"
    ADD CONSTRAINT "client_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_client_id_key" UNIQUE ("event_id", "client_id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."studios"
    ADD CONSTRAINT "studios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."studios"
    ADD CONSTRAINT "studios_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."subthreshold_decisions"
    ADD CONSTRAINT "subthreshold_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subthreshold_decisions"
    ADD CONSTRAINT "subthreshold_decisions_schedule_id_key" UNIQUE ("schedule_id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "bookings_active_uniq" ON "public"."bookings" USING "btree" ("client_id", "schedule_id") WHERE ("status" = 'confirmed'::"text");



CREATE INDEX "idx_push_client_active" ON "public"."push_subscriptions" USING "btree" ("client_id") WHERE ("is_active" = true);



CREATE INDEX "idx_sched_subthreshold_pending" ON "public"."schedules" USING "btree" ("starts_at") WHERE (("subthreshold_checked" = false) AND ("is_cancelled" = false));



CREATE INDEX "idx_subthr_client_pending" ON "public"."subthreshold_decisions" USING "btree" ("client_id") WHERE ("state" = 'pending'::"text");



CREATE INDEX "idx_subthr_pending_deadline" ON "public"."subthreshold_decisions" USING "btree" ("decision_deadline") WHERE ("state" = 'pending'::"text");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "public"."client_packages"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."client_packages"
    ADD CONSTRAINT "client_packages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."client_packages"
    ADD CONSTRAINT "client_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id");



ALTER TABLE ONLY "public"."client_packages"
    ADD CONSTRAINT "client_packages_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "public"."client_packages"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."subthreshold_decisions"
    ADD CONSTRAINT "subthreshold_decisions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subthreshold_decisions"
    ADD CONSTRAINT "subthreshold_decisions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subthreshold_decisions"
    ADD CONSTRAINT "subthreshold_decisions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "public"."client_packages"("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



CREATE POLICY "Admin e instructor possono leggere note" ON "public"."client_notes" FOR SELECT USING ((("studio_id" = "public"."get_user_studio_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"]))));



CREATE POLICY "Admin e instructor possono scrivere note" ON "public"."client_notes" FOR INSERT WITH CHECK ((("studio_id" = "public"."get_user_studio_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"]))));



CREATE POLICY "Cliente cancella la propria prenotazione" ON "public"."bookings" FOR UPDATE USING ((("client_id" = "auth"."uid"()) OR ("public"."get_user_role"() = 'admin'::"text")));



CREATE POLICY "Cliente prenota" ON "public"."bookings" FOR INSERT WITH CHECK (("client_id" = "auth"."uid"()));



CREATE POLICY "Cliente vede i propri pacchetti" ON "public"."client_packages" FOR SELECT USING ((("client_id" = "auth"."uid"()) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"]))));



CREATE POLICY "Cliente vede il proprio wallet" ON "public"."wallet_transactions" FOR SELECT USING ((("client_id" = "auth"."uid"()) OR ("public"."get_user_role"() = 'admin'::"text")));



CREATE POLICY "Cliente vede le proprie fatture" ON "public"."invoices" FOR SELECT USING ((("client_id" = "auth"."uid"()) OR ("public"."get_user_role"() = 'admin'::"text")));



CREATE POLICY "Cliente vede le proprie prenotazioni" ON "public"."bookings" FOR SELECT USING ((("client_id" = "auth"."uid"()) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"]))));



CREATE POLICY "Contenuti visibili agli utenti dello studio" ON "public"."content_items" FOR SELECT USING (("studio_id" = "public"."get_user_studio_id"()));



CREATE POLICY "Eventi visibili agli utenti dello studio" ON "public"."events" FOR SELECT USING (("studio_id" = "public"."get_user_studio_id"()));



CREATE POLICY "Inserimento profilo al signup" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Iscrizioni eventi: cliente vede le proprie" ON "public"."event_registrations" FOR SELECT USING ((("client_id" = "auth"."uid"()) OR ("public"."get_user_role"() = 'admin'::"text")));



CREATE POLICY "Lezioni visibili agli utenti dello studio" ON "public"."classes" FOR SELECT USING (("studio_id" = "public"."get_user_studio_id"()));



CREATE POLICY "Pacchetti visibili agli utenti dello studio" ON "public"."packages" FOR SELECT USING (("studio_id" = "public"."get_user_studio_id"()));



CREATE POLICY "Palinsesto visibile agli utenti dello studio" ON "public"."schedules" FOR SELECT USING (("studio_id" = "public"."get_user_studio_id"()));



CREATE POLICY "Prodotti visibili agli utenti dello studio" ON "public"."products" FOR SELECT USING (("studio_id" = "public"."get_user_studio_id"()));



CREATE POLICY "Solo admin gestisce client_packages" ON "public"."client_packages" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "Solo admin gestisce fatture" ON "public"."invoices" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "Solo admin gestisce il palinsesto" ON "public"."schedules" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "Solo admin gestisce le classi" ON "public"."classes" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "Solo admin gestisce pacchetti" ON "public"."packages" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "Studio visibile agli utenti dello studio" ON "public"."studios" FOR SELECT USING (("id" = "public"."get_user_studio_id"()));



CREATE POLICY "Utente aggiorna il proprio profilo" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Utente vede il proprio profilo" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"]))));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_restrict_delete" ON "public"."bookings" AS RESTRICTIVE FOR DELETE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"])));



CREATE POLICY "bookings_restrict_insert" ON "public"."bookings" AS RESTRICTIVE FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"])));



CREATE POLICY "bookings_restrict_update" ON "public"."bookings" AS RESTRICTIVE FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"])));



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_packages_restrict_delete" ON "public"."client_packages" AS RESTRICTIVE FOR DELETE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"])));



CREATE POLICY "client_packages_restrict_insert" ON "public"."client_packages" AS RESTRICTIVE FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"])));



CREATE POLICY "client_packages_restrict_update" ON "public"."client_packages" AS RESTRICTIVE FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'instructor'::"text"])));



ALTER TABLE "public"."content_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_delete_own" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING (("client_id" = "auth"."uid"()));



CREATE POLICY "push_insert_own" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("client_id" = "auth"."uid"()));



CREATE POLICY "push_select_own" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("client_id" = "auth"."uid"()));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_update_own" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING (("client_id" = "auth"."uid"())) WITH CHECK (("client_id" = "auth"."uid"()));



ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."studios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subthr_select_own" ON "public"."subthreshold_decisions" FOR SELECT TO "authenticated" USING (("client_id" = "auth"."uid"()));



ALTER TABLE "public"."subthreshold_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."book_lesson"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."book_lesson"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."book_lesson"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_studio_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_studio_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_studio_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refund_booking_full"("p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refund_booking_full"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_subthreshold_refund"("p_decision_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_subthreshold_refund"("p_decision_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_subthreshold_refund"("p_decision_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_subthreshold_reschedule"("p_decision_id" "uuid", "p_target_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_subthreshold_reschedule"("p_decision_id" "uuid", "p_target_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_subthreshold_reschedule"("p_decision_id" "uuid", "p_target_schedule_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sweep_subthreshold_deadline"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sweep_subthreshold_deadline"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sweep_subthreshold_detect"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sweep_subthreshold_detect"() TO "service_role";
























GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."client_notes" TO "anon";
GRANT ALL ON TABLE "public"."client_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."client_notes" TO "service_role";



GRANT ALL ON TABLE "public"."client_packages" TO "anon";
GRANT ALL ON TABLE "public"."client_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."client_packages" TO "service_role";



GRANT ALL ON TABLE "public"."content_items" TO "anon";
GRANT ALL ON TABLE "public"."content_items" TO "authenticated";
GRANT ALL ON TABLE "public"."content_items" TO "service_role";



GRANT ALL ON TABLE "public"."email_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."email_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."email_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."event_registrations" TO "anon";
GRANT ALL ON TABLE "public"."event_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."event_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."studios" TO "anon";
GRANT ALL ON TABLE "public"."studios" TO "authenticated";
GRANT ALL ON TABLE "public"."studios" TO "service_role";



GRANT ALL ON TABLE "public"."subthreshold_decisions" TO "anon";
GRANT ALL ON TABLE "public"."subthreshold_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."subthreshold_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































