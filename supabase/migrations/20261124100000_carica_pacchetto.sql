-- Lo studio carica un pacchetto a una cliente dalla sua scheda (richiesta di Mattia del 24/11/2026).
--
-- Serve in due casi:
-- - una vendita in studio: pacchetto intero, pagato oggi;
-- - il passaggio dai cartellini di carta: il pacchetto che la cliente ha gia',
--   con le lezioni che le restano e la sua scadenza, senza un nuovo pagamento.
-- I crediti dell'app sono in euro (amount_remaining): ogni lezione rimasta vale
-- credit_amount / credits del pacchetto, cioe' il prezzo di una lezione.

begin;

create or replace function public.carica_pacchetto(
  p_client uuid,
  p_package uuid,
  p_lezioni_rimaste int,
  p_scadenza date,
  p_pagato_oggi boolean
)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_studio uuid;
  v_pkg packages%rowtype;
  v_lezioni int;
  v_valore numeric;
  v_restante numeric;
  v_id uuid;
begin
  if get_user_role() <> 'admin' then raise exception 'not_admin'; end if;
  select studio_id into v_studio from profiles where id = auth.uid();

  if not exists (select 1 from profiles where id = p_client and studio_id = v_studio and role = 'client') then
    raise exception 'client_not_found';
  end if;
  select * into v_pkg from packages where id = p_package and studio_id = v_studio;
  if not found then raise exception 'package_not_found'; end if;

  v_lezioni := coalesce(p_lezioni_rimaste, v_pkg.credits);
  if v_lezioni < 1 or (v_pkg.credits > 0 and v_lezioni > v_pkg.credits) then
    raise exception 'lezioni_non_valide';
  end if;
  if p_scadenza is not null and p_scadenza < current_date then raise exception 'scadenza_passata'; end if;

  v_valore := v_pkg.credit_amount;
  v_restante := case when v_pkg.credits > 0
                     then round(v_pkg.credit_amount * v_lezioni / v_pkg.credits, 2)
                     else v_pkg.credit_amount end;

  insert into client_packages
    (studio_id, client_id, package_id, credits_total, credits_used, price_paid,
     purchased_at, expires_at, is_active, amount_initial, amount_remaining)
  values
    (v_studio, p_client, p_package, v_pkg.credits, greatest(v_pkg.credits - v_lezioni, 0),
     case when p_pagato_oggi then v_pkg.price else null end,
     now(),
     case when p_scadenza is not null then ((p_scadenza + 1)::timestamp - interval '1 second') at time zone 'Europe/Rome'
          when v_pkg.validity_days is not null then now() + make_interval(days => v_pkg.validity_days)
          else null end,
     true, v_valore, v_restante)
  returning id into v_id;

  insert into wallet_transactions (studio_id, client_id, amount, type, description, client_package_id)
  values (v_studio, p_client, v_restante, 'credit',
          case when p_pagato_oggi then 'Pacchetto ' || v_pkg.name || ' acquistato in studio'
               else 'Pacchetto ' || v_pkg.name || ': ' || v_lezioni || ' lezioni rimaste dal cartellino' end,
          v_id);

  return v_id;
end;
$$;

revoke all on function public.carica_pacchetto(uuid, uuid, int, date, boolean) from public, anon;
grant execute on function public.carica_pacchetto(uuid, uuid, int, date, boolean) to authenticated;

commit;
