-- Regali in vendita e copertine di Mee Too Pilates (30/10/2026).
-- Tagli, prezzi e testi sono quelli della pagina /gift-card del sito
-- (meetoo-sito, lib/giftcard.ts), cioe' quelli che oggi si vendono su Gift Up.
-- Lo studio si trova per slug, niente id scritti a mano. Rilanciabile: prima
-- cancella i regali in vendita e le copertine dello studio (non i regali comprati).

begin;

delete from public.gift_products where studio_id = (select id from public.studios where slug = 'meetoo');
delete from public.gift_covers where studio_id = (select id from public.studios where slug = 'meetoo');

insert into public.gift_products
  (studio_id, discipline, discipline_slug, title, description, lessons, price, includes_stamp_duty, savings_note, detail_image, sort)
select s.id, v.* from public.studios s, (values
  ('Pilates Reformer & Chair', 'pilates-reformer', 'Lezione singola', '50 minuti sui macchinari, per chi il Reformer non l''ha mai provato.', 1, 23.00, false, null, '/regalo/dettagli/pilates-reformer.jpg', 10),
  ('Pilates Reformer & Chair', 'pilates-reformer', '5 lezioni', 'Cinque lezioni da 50 minuti sui macchinari.', 5, 112.00, true, 'risparmi 5 €', '/regalo/dettagli/pilates-reformer.jpg', 11),
  ('Pilates Reformer & Chair', 'pilates-reformer', '10 lezioni', 'Dieci lezioni sui macchinari, per chi vuole venire con regolarità.', 10, 212.00, true, 'risparmi 20 €', '/regalo/dettagli/pilates-reformer.jpg', 12),
  ('Pilates Matwork', 'pilates-matwork', 'Lezione singola', '50 minuti sul tappetino, per provare.', 1, 16.00, false, null, '/regalo/dettagli/pilates-matwork.jpg', 20),
  ('Pilates Matwork', 'pilates-matwork', '5 lezioni', 'Cinque lezioni sul tappetino.', 5, 75.00, false, 'risparmi 5 €', '/regalo/dettagli/pilates-matwork.jpg', 21),
  ('Pilates Matwork', 'pilates-matwork', '10 lezioni', 'Dieci lezioni sul tappetino, per chi vuole venire con regolarità.', 10, 142.00, true, 'risparmi 20 €', '/regalo/dettagli/pilates-matwork.jpg', 22),
  ('Yoga in studio', 'yoga', 'Lezione singola', '50 minuti di yoga in studio, per provare.', 1, 18.00, false, null, '/regalo/dettagli/yoga.jpg', 30),
  ('Yoga in studio', 'yoga', '5 lezioni', 'Cinque lezioni di yoga in studio.', 5, 87.00, true, 'risparmi 5 €', '/regalo/dettagli/yoga.jpg', 31),
  ('Yoga in studio', 'yoga', '10 lezioni', 'Dieci lezioni, per chi vuole farne un''abitudine.', 10, 162.00, true, 'risparmi 20 €', '/regalo/dettagli/yoga.jpg', 32)
) as v(discipline, discipline_slug, title, description, lessons, price, includes_stamp_duty, savings_note, detail_image, sort)
where s.slug = 'meetoo';

-- 2/11/2026: tre foto (una per disciplina, la copertina parte da quella del regalo scelto)
-- e tre illustrazioni lineart generate con Higgsfield, sui colori della palette
insert into public.gift_covers (studio_id, image_url, label, discipline_slug, sort)
select s.id, v.* from public.studios s, (values
  ('/regalo/copertine/reformer.jpg', 'Reformer', 'pilates-reformer', 1),
  ('/regalo/copertine/matwork.jpg', 'Matwork', 'pilates-matwork', 2),
  ('/regalo/copertine/yoga.jpg', 'Yoga', 'yoga', 3),
  ('/regalo/copertine/grafica-germoglio.jpg', 'Germoglio', null, 4),
  ('/regalo/copertine/grafica-sassi.jpg', 'Sassi in equilibrio', null, 5),
  ('/regalo/copertine/grafica-fiore.jpg', 'Fiore', null, 6)
) as v(image_url, label, discipline_slug, sort)
where s.slug = 'meetoo';

commit;

-- verifica: 9 regali, 6 copertine
select (select count(*) from public.gift_products p join public.studios s on s.id = p.studio_id where s.slug = 'meetoo') as regali,
       (select count(*) from public.gift_covers c join public.studios s on s.id = c.studio_id where s.slug = 'meetoo') as copertine;
