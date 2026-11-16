-- Sostituzioni e lettura per i conti (16/11/2026).
--
-- Una sostituzione e' un'azione a se': la lezione tiene la sua insegnante
-- prevista (schedules.instructor_id) e si segna chi l'ha tenuta al suo posto
-- (schedules.sostituta_id). Cosi' il palinsesto delle settimane dopo non cambia
-- e i conti sanno tutte e due le cose.
--
-- I conti (scrivania Studio e Conti) leggono dalla vista conti_lezioni_app,
-- concordata con loro il 16/11/2026: l'app non scrive nei loro dati. Gli
-- insegnanti nei conti hanno un id loro: profiles.conti_id tiene la
-- corrispondenza (lo compila lo studio; vuoto = non ancora collegata).

begin;

alter table public.profiles
  add column if not exists conti_id text;

comment on column public.profiles.conti_id is
  'Id della stessa persona nei conti delle lezioni (conti_lezioni). Vuoto se non collegata.';

alter table public.schedules
  add column if not exists sostituta_id uuid references public.profiles(id) on delete set null,
  add column if not exists sostituzione_at timestamptz;

comment on column public.schedules.sostituta_id is
  'Chi ha tenuto (o terra'') la lezione al posto dell''insegnante prevista. Vuoto = nessuna sostituzione.';

-- ---------------------------------------------------------------------------
-- Lo studio segna o toglie una sostituzione
-- ---------------------------------------------------------------------------
create or replace function public.studio_segna_sostituzione(p_schedule_id uuid, p_sostituta uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_prevista uuid;
begin
  perform _studio_admin_di(p_schedule_id);
  select instructor_id into v_prevista from schedules where id = p_schedule_id for update;

  if p_sostituta is null then
    update schedules set sostituta_id = null, sostituzione_at = null where id = p_schedule_id;
    return;
  end if;
  if p_sostituta = v_prevista then raise exception 'stessa_insegnante'; end if;
  -- puo' sostituire un'insegnante dello studio, o la titolare
  if not exists (
    select 1 from profiles
    where id = p_sostituta and studio_id = get_user_studio_id()
      and role in ('instructor', 'admin') and coalesce(is_active, true)
  ) then raise exception 'instructor_not_found'; end if;

  update schedules set sostituta_id = p_sostituta, sostituzione_at = now() where id = p_schedule_id;
end;
$$;

revoke all on function public.studio_segna_sostituzione(uuid, uuid) from public, anon;
grant execute on function public.studio_segna_sostituzione(uuid, uuid) to authenticated;

-- Le presenze le segna anche chi sostituisce
create or replace function public.segna_presenza(p_booking_id uuid, p_presenza text)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_schedule uuid; v_instructor uuid; v_sostituta uuid; v_studio uuid;
begin
  if p_presenza is not null and p_presenza not in ('presente', 'assente') then raise exception 'presenza_non_valida'; end if;
  select b.schedule_id, s.instructor_id, s.sostituta_id, s.studio_id
    into v_schedule, v_instructor, v_sostituta, v_studio
  from bookings b join schedules s on s.id = b.schedule_id
  where b.id = p_booking_id and b.status in ('confirmed', 'held');
  if not found then raise exception 'booking_not_found'; end if;
  if v_studio <> get_user_studio_id() then raise exception 'not_allowed'; end if;
  if not (get_user_role() = 'admin'
          or (get_user_role() = 'instructor' and auth.uid() in (v_instructor, v_sostituta))) then
    raise exception 'not_allowed';
  end if;
  update bookings set presenza = p_presenza, presenza_segnata_at = now() where id = p_booking_id;
end;
$$;

-- Alle clienti: nome e cognome di chi insegna, compresa chi sostituisce (anche
-- se e' la titolare, che non ha il ruolo di insegnante)
create or replace function public.nomi_insegnanti()
returns table (id uuid, first_name text, last_name text)
language sql stable security definer set search_path to 'public'
as $$
  select p.id, p.first_name, p.last_name
  from profiles p
  where p.studio_id = get_user_studio_id()
    and (p.role = 'instructor'
         or exists (select 1 from schedules s where s.sostituta_id = p.id or s.instructor_id = p.id))
$$;

-- ---------------------------------------------------------------------------
-- La lettura per i conti: una riga per lezione
-- ---------------------------------------------------------------------------
create or replace view public.conti_lezioni_app
with (security_invoker = true) as
select
  s.id                                                        as lezione_id,
  s.studio_id,
  (s.starts_at at time zone 'Europe/Rome')::date              as data,
  to_char(s.starts_at at time zone 'Europe/Rome', 'FMHH24.MI') as ora,
  -- chiave nel formato dei conti: 'Gio|7.00'
  (array['Lun','Mar','Mer','Gio','Ven','Sab','Dom'])[extract(isodow from s.starts_at at time zone 'Europe/Rome')::int]
    || '|' || to_char(s.starts_at at time zone 'Europe/Rome', 'FMHH24.MI') as chiave,
  c.name                                                      as tipo_lezione,
  s.instructor_id                                             as prevista_profilo,
  pp.conti_id                                                 as prevista,
  coalesce(s.sostituta_id, s.instructor_id)                   as effettiva_profilo,
  coalesce(ps.conti_id, pp.conti_id)                          as effettiva,
  (s.sostituta_id is not null)                                as sostituita,
  coalesce(s.is_cancelled, false)                             as saltata,
  (select count(*) from public.bookings b
    where b.schedule_id = s.id and b.status in ('confirmed', 'held', 'attended'))::int as iscritte,
  (select count(*) from public.bookings b
    where b.schedule_id = s.id and b.presenza = 'presente')::int               as presenze
from public.schedules s
left join public.classes c  on c.id = s.class_id
left join public.profiles pp on pp.id = s.instructor_id
left join public.profiles ps on ps.id = s.sostituta_id;

comment on view public.conti_lezioni_app is
  'Una riga per lezione, per i conti delle lezioni (scrivania Studio e Conti). Sola lettura, dal server.';

-- nessuno la legge dall'app: solo il server e le funzioni dei conti
revoke all on public.conti_lezioni_app from public, anon, authenticated;
grant select on public.conti_lezioni_app to service_role;

commit;
