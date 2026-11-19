-- Snapshot Data Sales, 8 November 2026.
-- Dya Ayu and Diah Kanthi stay in the roster without an email, so they cannot log in.
-- No visit_reports rows: Laporan Kunjungan has headers only.

insert into public.sales_profiles (roster_order, name, email, area, team, status)
values
  (1, 'Ilya', 'estimatorgreenmileindonesia@gmail.com', 'surabaya', 'PPIC', 'Aktif'),
  (2, 'Ling Ling', 'sales002.gmi@gmail.com', 'surabaya', 'Sales', 'Aktif'),
  (3, 'Mariska', 'gmi.salesjatim@gmail.com', 'surabaya', 'Sales', 'Aktif'),
  (4, 'Mariszka Etha', 'greenmilesales1@gmail.com', 'surabaya', 'Sales', 'Aktif'),
  (5, 'Peter Ang', 'peter.angkawidjaja@gmail.com', 'surabaya', 'Sales', 'Aktif'),
  (6, 'Puput', 'operasionalgreenmileindonesia@gmail.com', 'surabaya', 'PPIC', 'Aktif'),
  (7, 'Riyan', 'greenmilesales2@gmail.com', 'surabaya', 'Sales', 'Aktif'),
  (8, 'Dya Ayu', null, 'surabaya', 'Sales', 'Aktif'),
  (9, 'Diah Kanthi', null, 'surabaya', 'Sales', 'Aktif')
on conflict (name) do update
set
  roster_order = excluded.roster_order,
  email = excluded.email,
  area = excluded.area,
  team = excluded.team,
  status = excluded.status,
  updated_at = pg_catalog.now();

update public.sales_profiles as profile
set
  auth_user_id = users.id,
  updated_at = pg_catalog.now()
from auth.users as users
where profile.email is not null
  and profile.email = lower(users.email)
  and profile.auth_user_id is distinct from users.id;
