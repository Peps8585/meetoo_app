-- Gift card: la ricevuta (2/11/2026).
-- Come lavora Mee Too: se chi compra e' gia' cliente dello studio, la ricevuta
-- (Aruba Fatturazione) si fa subito dopo il pagamento; se non lo e', si fa
-- quando chi riceve il regalo viene ad attivarlo, chiedendo i dati li'.
-- L'app non fa la ricevuta: tiene il segno che e' stata fatta, e quando.

begin;

alter table public.gift_cards
  add column receipt_done_at timestamptz,
  add column receipt_done_by uuid references public.profiles(id) on delete set null;

commit;
