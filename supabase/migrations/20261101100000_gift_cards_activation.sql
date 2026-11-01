-- Gift card, versione di prova con QR (1/11/2026): il regalo si attiva in studio.
-- Chi lo riceve mostra il QR la prima volta che viene; chi e' dello studio lo
-- scansiona, sceglie il gruppo con la persona e lo attiva. Lo stato resta
-- 'redeemed' (gia' previsto), qui si aggiunge chi lo usa e chi l'ha attivato.
-- Le lezioni poi si segnano come oggi, finche' l'app non e' in uso.

begin;

alter table public.gift_cards
  add column holder_name text,
  add column holder_phone text,
  add column studio_note text,
  add column activated_by uuid references public.profiles(id) on delete set null;

commit;
