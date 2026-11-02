-- Gift card: la copertina sa a quale disciplina appartiene (2/11/2026).
-- Quando chi regala sceglie il regalo, la copertina parte dalla foto della stessa
-- disciplina (puo' comunque cambiarla). Le illustrazioni non hanno disciplina:
-- vanno bene con tutto.
alter table public.gift_covers add column discipline_slug text;
