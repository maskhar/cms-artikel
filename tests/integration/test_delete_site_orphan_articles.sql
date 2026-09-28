-- Uji perilaku delete_site sesudah #280003 — artikel diyatimkan, bukan memblokir.
--
-- Jalankan: docker exec -i <db> psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f ini
-- Seluruh isi berjalan dalam satu transaksi yang DIROLLBACK di akhir. Tidak ada
-- baris yang tertinggal, jadi aman dijalankan terhadap produksi sekalipun.
--
-- Yang dikunci di sini adalah hal-hal yang TIDAK terlihat dari skema. Setiap
-- blok pernah gagal sungguhan saat migrasi ini dikembangkan; kalau ada yang
-- kembali merah, jangan diakali angkanya — baca komentar di atasnya.

\set ON_ERROR_STOP on
begin;

-- Aktor disemai sendiri, tidak meminjam baris nyata: database bersih hasil
-- `supabase db reset` punya nol auth.users, dan meminjam admin produksi membuat
-- hasil uji bergantung pada data yang bisa berubah kapan saja.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('dddd4444-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-admin-global@contoh.uji', '', now(), now(), now()),
  ('dddd4444-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-penulis@contoh.uji', '', now(), now(), now())
on conflict (id) do nothing;

insert into artikel.user_roles (user_id, site_id, role, is_active)
values ('dddd4444-0000-4000-8000-000000000001', null, 'admin', true)
on conflict do nothing;

-- Dunia uji: dua website, satu artikel yang disebarkan ke KEDUANYA.
-- Penyebaran ganda itu intinya: artikel satu-website tidak akan menangkap bug
-- yang paling mahal di migrasi ini.
insert into artikel.sites (id, name, domain, slug, is_active) values
  ('aaaa1111-0000-4000-8000-000000000001', 'Uji Pemilik', 'pemilik.uji', 'uji-pemilik', true),
  ('aaaa1111-0000-4000-8000-000000000002', 'Uji Tetangga', 'tetangga.uji', 'uji-tetangga', true);

insert into artikel.categories (id, site_id, name, slug) values
  ('bbbb2222-0000-4000-8000-000000000001', 'aaaa1111-0000-4000-8000-000000000001', 'Kabar', 'kabar'),
  ('bbbb2222-0000-4000-8000-000000000002', 'aaaa1111-0000-4000-8000-000000000002', 'Kabar', 'kabar');

-- Seed langsung: psql tidak punya identitas auth.uid(), sedangkan
-- validate_article_write menuntutnya. Dimatikan HANYA selama seed.
alter table artikel.articles disable trigger validate_article_write;
insert into artikel.articles (id, site_id, category_id, author_id, title, slug, content, status, published_at)
values ('cccc3333-0000-4000-8000-000000000001', 'aaaa1111-0000-4000-8000-000000000001',
        'bbbb2222-0000-4000-8000-000000000001', 'dddd4444-0000-4000-8000-000000000002',
        'Artikel Tersebar', 'artikel-tersebar', '<p>isi</p>', 'published', now());
alter table artikel.articles enable trigger validate_article_write;

-- Terbit di kedua website.
insert into artikel.article_sites (article_id, site_id, category_id, slug, status, published_at) values
  ('cccc3333-0000-4000-8000-000000000001', 'aaaa1111-0000-4000-8000-000000000001', 'bbbb2222-0000-4000-8000-000000000001', 'artikel-tersebar', 'published', now()),
  ('cccc3333-0000-4000-8000-000000000001', 'aaaa1111-0000-4000-8000-000000000002', 'bbbb2222-0000-4000-8000-000000000002', 'artikel-tersebar', 'published', now())
on conflict do nothing;

select artikel.delete_site('aaaa1111-0000-4000-8000-000000000001'::uuid, 'dddd4444-0000-4000-8000-000000000001'::uuid);

\echo ''
\echo '=== 1. Artikel selamat dan bisa disunting lagi ==='
-- Harap: yatim t, status draft, kategori "Tanpa Kategori".
-- Kalau status bukan draft: guard transisi status di validate_article_write
-- menolak published->draft untuk aktor tanpa role; penanda artikel.orphaning
-- yang membebaskannya hilang.
select a.title, a.site_id is null as yatim, a.status, c.name as kategori, c.site_id is null as kategori_global
from artikel.articles a left join artikel.categories c on c.id = a.category_id
where a.id = 'cccc3333-0000-4000-8000-000000000001';

\echo ''
\echo '=== 2. REGRESI PALING MAHAL: artikel yatim tidak terbit di mana pun ==='
-- HARUS 0. CASCADE saja TIDAK cukup: ia hanya membuang distribusi milik website
-- yang dihapus. Distribusi ke Uji Tetangga selamat dengan status 'published',
-- jadi artikel yang di CMS sudah jadi draf yatim tetap tersaji lewat API key
-- tetangga. Terbukti pada data produksi 28 September 2026 (2 artikel x 3 website).
-- Kalau angka ini > 0, Public Read API membocorkan artikel tak bertuan.
select count(*) as distribusi_artikel_yatim
from artikel.article_sites d join artikel.articles a on a.id = d.article_id
where a.site_id is null;

\echo ''
\echo '=== 3. Website lain tidak ikut jadi korban ==='
-- Uji Tetangga harus masih berdiri dengan kategorinya sendiri. Pencabutan
-- distribusi di atas menyasar artikel yatim, bukan seluruh isi tetangga.
select s.name, s.id is not null as masih_ada,
       (select count(*) from artikel.categories c where c.site_id = s.id) as kategori_utuh
from artikel.sites s where s.id = 'aaaa1111-0000-4000-8000-000000000002';

\echo ''
\echo '=== 4. Kategori & tag milik website yang dihapus ikut terhapus ==='
-- Sengaja CASCADE. Menggloblkan mereka menghasilkan kategori kembar tak
-- terbedakan tanpa satu pun galat, karena NULL bukan duplikat bagi UNIQUE.
select count(*) as kategori_pemilik_tersisa from artikel.categories
where site_id = 'aaaa1111-0000-4000-8000-000000000001';

\echo ''
\echo '=== 5. Hanya admin global yang melihat artikel yatim ==='
-- Baris "penulis" adalah yang mahal: policy baca punya cabang
-- author_id = auth.uid() yang akan diam-diam mempertahankan akses penulis.
-- Harus ditimpa eksplisit. Harap: 1, 0.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'dddd4444-0000-4000-8000-000000000001',
  'role','authenticated')::text, true);
select 'admin global' as siapa, count(*) as terlihat from artikel.articles where site_id is null;

select set_config('request.jwt.claims', json_build_object(
  'sub', 'dddd4444-0000-4000-8000-000000000002',
  'role','authenticated')::text, true);
select 'penulis artikel itu sendiri' as siapa, count(*) as terlihat from artikel.articles where site_id is null;
reset role;

\echo ''
\echo '=== 6. Admin global bisa memungut artikel kembali ==='
-- Tanpa perubahan pada validate_article_write ini mustahil: guard pindah-site
-- lamanya memblokir perpindahan DARI site_id null sama sekali. Tidak terlihat
-- dari skema — hanya dari body trigger.
-- Harap: distribusi_dibangun_ulang = 1, status tetap draft.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'dddd4444-0000-4000-8000-000000000001',
  'role','authenticated')::text, true);
update artikel.articles set site_id = 'aaaa1111-0000-4000-8000-000000000002',
       category_id = 'bbbb2222-0000-4000-8000-000000000002'
where id = 'cccc3333-0000-4000-8000-000000000001';
reset role;

select a.title, s.name as dipungut_ke, a.status,
       (select count(*) from artikel.article_sites d where d.article_id = a.id) as distribusi_dibangun_ulang
from artikel.articles a join artikel.sites s on s.id = a.site_id
where a.id = 'cccc3333-0000-4000-8000-000000000001';

rollback;
\echo ''
\echo '=== ROLLBACK selesai — tidak ada baris uji yang tertinggal ==='
