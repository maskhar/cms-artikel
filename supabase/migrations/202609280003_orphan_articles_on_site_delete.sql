-- Migration: Artikel jadi draf tak bertuan saat website dihapus
-- File: 202609280003_orphan_articles_on_site_delete.sql
--
-- Keputusan produk (28 September 2026). Sebelum ini, menghapus website yang
-- masih berisi artikel DITOLAK: route DELETE /api/cms/sites/[siteId] menghitung
-- artikel/kategori/tag lebih dulu dan membalas 409 "Website belum kosong".
-- Kalau penjaga itu dilewati (panggilan langsung ke artikel.delete_site lewat
-- SQL), yang muncul error FK mentah karena articles/categories/tags ber-FK
-- RESTRICT ke sites.
--
-- Perilaku baru: artikel TIDAK ikut terhapus dan TIDAK menghalangi penghapusan.
-- Ia jadi draf tak bertuan yang bisa dipungut kembali:
--
--   site_id      -> null
--   status       -> 'draft'
--   category_id  -> kategori penampung global "Tanpa Kategori"
--
-- Kategori dan tag milik website tetap IKUT TERHAPUS. Sempat dipertimbangkan
-- untuk ikut diglobalkan seperti galeri di #280002, tapi kunci unik keduanya
-- adalah (site_id, slug) dan di produksi slug 'global' dipakai 4 website serta
-- 'news' 3 website. Karena NULL tidak dianggap duplikat oleh UNIQUE di
-- PostgreSQL, meng-null-kan site_id TIDAK menimbulkan error — hasilnya empat
-- kategori "Global" kembar yang tak terbedakan di dropdown, tanpa satu pun
-- pesan kesalahan. Kekacauan senyap lebih mahal daripada kehilangan label yang
-- bisa dibuat ulang dalam sepuluh detik.
--
-- Artikel yatim tidak boleh bocor ke pembaca publik, dan ini TIDAK gratis.
-- Public Read API membaca artikel.article_sites yang difilter site_id milik API
-- key. article_sites_site_id_fkey memang CASCADE, tapi itu hanya membuang baris
-- distribusi milik site yang dihapus — distribusi artikel yang sama ke website
-- LAIN selamat, dan statusnya tetap 'published'.
--
-- Dibuktikan pada data produksi (dry-run 28 September 2026): kedua artikel
-- Buzzerhood tersebar ke 4 website. Sesudah Buzzerhood dihapus, 3 baris
-- distribusi 'published' tetap berdiri, sehingga artikel yang di CMS sudah jadi
-- draf yatim masih tersaji lewat API key Soundpub, Utero Academy dan Utero
-- Indonesia. Versi pertama migrasi ini mengklaim CASCADE sudah cukup; klaim itu
-- salah untuk artikel multi-site, dan hanya terlihat setelah dijalankan pada
-- data nyata — data uji lokal kebetulan hanya berisi artikel satu-website.
--
-- Karena itu delete_site menghapus SELURUH baris distribusi artikel yang
-- diyatimkan, bukan mengandalkan CASCADE. Artikel tanpa pemilik tidak punya
-- alasan untuk tetap terbit di mana pun; saat dipungut kembali, distribusinya
-- dibangun ulang oleh sync_article_distributions.
--
-- Yang boleh melihat artikel yatim: ADMIN SAJA (dikonfirmasi 28 September 2026).
-- Berbeda dari galeri di #280002 yang dibuka ke semua anggota CMS, karena isi
-- artikel bisa berupa draf internal. Cabang `author_id = auth.uid()` pada policy
-- baca SENGAJA tidak berlaku untuk baris yatim: penulisnya pun tidak melihatnya
-- lagi. Itu konsekuensi yang diminta, bukan kelalaian.

begin;

-- 1. Longgarkan kolom yang wajib -------------------------------------------
--
-- Sama persis dengan jebakan di #280002: kolom NOT NULL membuat `on delete set
-- null` gagal, bukan diam-diam salah. Dilonggarkan lebih dulu.

alter table artikel.articles alter column site_id drop not null;
alter table artikel.articles alter column category_id drop not null;

alter table artikel.articles
  drop constraint if exists articles_site_id_fkey,
  add constraint articles_site_id_fkey
    foreign key (site_id) references artikel.sites(id) on delete set null;

-- category_id sudah RESTRICT ke categories dan itu DIPERTAHANKAN: selama masih
-- ada artikel yang memakainya, kategori tidak boleh lenyap. Yang memindahkan
-- artikel ke kategori penampung adalah delete_site di langkah 3, dilakukan
-- SEBELUM kategori site dihapus, jadi RESTRICT tidak pernah terpicu.

-- 2. Kategori penampung global ---------------------------------------------
--
-- Artikel yatim tetap butuh kategori supaya tidak ada baris tanpa rujukan sama
-- sekali. Satu baris global, bukan salinan per-site — inilah yang membuat
-- "4 kategori Global kembar" tidak pernah terjadi.
--
-- Kunci unik (site_id, slug) tidak menjaga baris ber-site_id null (NULL tidak
-- kembar bagi UNIQUE), jadi keunikannya ditegakkan indeks parsial di bawah.

alter table artikel.categories alter column site_id drop not null;

alter table artikel.categories
  drop constraint if exists categories_site_id_fkey,
  add constraint categories_site_id_fkey
    foreign key (site_id) references artikel.sites(id) on delete cascade;

create unique index if not exists categories_global_slug_key
  on artikel.categories (slug) where site_id is null;

-- tags juga RESTRICT ke sites, jadi tanpa ini penghapusan tetap terhalang —
-- hanya pesan errornya yang berganti dari categories ke tags. Tag site ikut
-- terhapus (lihat catatan di delete_site: label murah dibuat ulang, dan
-- tags.slug unik per-site sehingga tag global akan menumpuk kembar).
alter table artikel.tags
  drop constraint if exists tags_site_id_fkey,
  add constraint tags_site_id_fkey
    foreign key (site_id) references artikel.sites(id) on delete cascade;

insert into artikel.categories (site_id, name, slug, description)
values (null, 'Tanpa Kategori', 'tanpa-kategori',
        'Penampung artikel yang websitenya sudah dihapus. Pilih kategori yang benar saat artikel dipakai lagi.')
on conflict do nothing;

-- Slug artikel unik per (site_id, slug). Dua website yang sama-sama punya
-- artikel ber-slug 'promo-akhir-tahun', lalu keduanya dihapus, menghasilkan dua
-- baris (null, 'promo-akhir-tahun') — dan UNIQUE menerimanya diam-diam karena
-- NULL tidak dianggap kembar. Hasilnya dua draf bernama sama di daftar, tanpa
-- error. Indeks parsial ini yang mencegahnya; delete_site menambah akhiran saat
-- bentrok.
create unique index if not exists articles_orphan_slug_key
  on artikel.articles (slug) where site_id is null;

-- 3. delete_site: yatimkan artikel, jangan halangi ---------------------------
--
-- Body dipertahankan verbatim dari produksi (guard actor_id dari 202609190001,
-- audit dari 202609280001, tanpa penghapusan gallery_items sejak 202609280002).
-- Yang ditambah hanya blok yatim di bawah, dijalankan SEBELUM delete sites.

create or replace function artikel.delete_site(site_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = artikel, pg_catalog
as $$
declare
  fallback_category_id uuid;
begin
  if actor_id is null
     or not artikel.has_site_role_for(actor_id, delete_site.site_id, array['admin']::artikel.user_role[])
  then
    raise exception 'Tidak berwenang menghapus website ini' using errcode = '42501';
  end if;

  -- Kolom dikualifikasi dengan alias: parameter fungsi ini bernama site_id,
  -- sehingga `where site_id is null` polos ambigu bagi plpgsql dan gagal saat
  -- dijalankan, bukan saat dibuat.
  select c.id into fallback_category_id
  from artikel.categories c where c.site_id is null and c.slug = 'tanpa-kategori';

  if fallback_category_id is null then
    raise exception 'Kategori penampung "tanpa-kategori" tidak ada'
      using errcode = 'P0002';
  end if;

  -- Slug bentrok dengan artikel yatim yang sudah ada lebih dulu: beri akhiran
  -- pendek supaya indeks parsial tidak menolak seluruh penghapusan site. Nama
  -- yang berubah jauh lebih baik daripada site yang mendadak tidak bisa dihapus.
  update artikel.articles a
  set slug = a.slug || '-' || left(replace(a.id::text, '-', ''), 12)
  where a.site_id = delete_site.site_id
    and exists (
      select 1 from artikel.articles o
      where o.site_id is null and o.slug = a.slug
    );

  -- Artikel diyatimkan lebih dulu, selagi kategori site masih ada: begitu
  -- baris sites terhapus, categories ikut cascade dan RESTRICT pada
  -- articles.category_id akan memblokir kalau urutannya dibalik.
  --
  -- Status diturunkan ke 'draft', bukan dibuat null: status bertipe enum
  -- NOT NULL, dan 'draft' memang sudah berarti "belum terbit, boleh disunting".
  -- Tidak perlu konsep baru yang harus dipahami setiap pembaca kolom ini.
  -- Penanda dibaca validate_article_write untuk membedakan pelepasan yang sah
  -- ini dari UPDATE biasa. `set local` = hilang otomatis saat transaksi selesai.
  set local artikel.orphaning = 'on';

  update artikel.articles a
  set site_id = null,
      status = 'draft',
      category_id = fallback_category_id
  where a.site_id = delete_site.site_id;

  set local artikel.orphaning = 'off';

  -- Cabut artikel yatim dari SEMUA website, bukan hanya yang dihapus.
  -- CASCADE hanya membuang distribusi milik site ini; sisanya tetap berdiri
  -- dengan status 'published' dan terus disajikan API key website lain (lihat
  -- catatan bukti di kepala file). Artikel tanpa pemilik tidak boleh terbit di
  -- mana pun. Dijalankan SESUDAH update di atas supaya `site_id is null` sudah
  -- menandai persis artikel yang baru diyatimkan, bukan artikel yatim lama.
  delete from artikel.article_sites d
  using artikel.articles a
  where d.article_id = a.id and a.site_id is null;

  -- Tag site ikut terhapus lewat cascade sites -> tags -> article_tags, jadi
  -- artikel yatim kehilangan tag-nya. Disengaja: tag adalah label yang murah
  -- dibuat ulang, dan tags.slug juga unik per-site sehingga tag global akan
  -- menumpuk kembar tiap kali ada site dihapus.

  alter table artikel.sites disable trigger audit_sites;
  alter table artikel.api_keys disable trigger audit_api_keys;
  alter table artikel.cms_hostnames disable trigger audit_cms_hostnames;

  delete from artikel.sites where id = delete_site.site_id;

  alter table artikel.sites enable trigger audit_sites;
  alter table artikel.api_keys enable trigger audit_api_keys;
  alter table artikel.cms_hostnames enable trigger audit_cms_hostnames;

  insert into artikel.audit_logs (site_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, delete_site.actor_id, 'sites.delete', 'sites', delete_site.site_id,
          '{"changed_fields": []}'::jsonb);
end;
$$;

revoke execute on function artikel.delete_site(uuid, uuid) from public, anon, authenticated;
grant execute on function artikel.delete_site(uuid, uuid) to service_role;

-- 4. Helper admin global ----------------------------------------------------
--
-- has_site_role(site_id, …) menguji `user_roles.site_id = target or (site_id is
-- null and role = 'admin')`. Untuk artikel yatim, target-nya null sehingga
-- perbandingan itu NULL — hanya cabang admin global yang bisa true. Tapi
-- bersandar pada efek samping itu membuat maksudnya tak terbaca. Helper ini
-- menyatakannya langsung.

create or replace function artikel.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from artikel.user_roles
    where user_id = auth.uid() and is_active
      and site_id is null and role = 'admin'
  );
$$;

revoke execute on function artikel.is_global_admin() from public, anon;
grant execute on function artikel.is_global_admin() to authenticated, service_role;

-- 5. RLS: artikel yatim hanya untuk admin global ----------------------------
--
-- Cabang `author_id = auth.uid()` pada policy lama membuat penulis tetap
-- melihat artikelnya sendiri. Untuk baris yatim itu dimatikan: keputusan
-- 28 September 2026 adalah ADMIN SAJA, termasuk terhadap penulisnya.
--
-- Policy ber-site di bawah tidak berubah sedikit pun dari versi produksi.

drop policy if exists "members read articles" on artikel.articles;
create policy "members read articles" on artikel.articles
for select to authenticated
using (
  case
    when site_id is null then artikel.is_global_admin()
    else author_id = auth.uid()
         or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
  end
);

drop policy if exists "authors and editors update articles" on artikel.articles;
create policy "authors and editors update articles" on artikel.articles
for update to authenticated
using (
  case
    when site_id is null then artikel.is_global_admin()
    else author_id = auth.uid()
         or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
  end
)
with check (
  case
    when site_id is null then artikel.is_global_admin()
    else author_id = auth.uid()
         or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
  end
);

drop policy if exists "editors delete articles" on artikel.articles;
create policy "editors delete articles" on artikel.articles
for delete to authenticated
using (
  case
    when site_id is null then artikel.is_global_admin()
    else artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
  end
);

-- INSERT sengaja TIDAK diberi cabang yatim: artikel baru wajib punya site.
-- Baris yatim hanya boleh lahir dari penghapusan site.
drop policy if exists "writers create own articles" on artikel.articles;
create policy "writers create own articles" on artikel.articles
for insert to authenticated
with check (
  author_id = auth.uid()
  and site_id is not null
  and artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
);

-- Kategori penampung harus terlihat semua anggota supaya artikel yang dipungut
-- kembali bisa dipindahkan keluar darinya. Isinya bukan rahasia — hanya nama
-- label. Yang dijaga adalah artikelnya, di policy di atas.
drop policy if exists "members read categories" on artikel.categories;
create policy "members read categories" on artikel.categories
for select to authenticated
using (
  case
    when site_id is null then artikel.is_media_member()
    else artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
  end
);

-- 6. validate_article_write: izinkan artikel yatim dipungut kembali ---------
--
-- Tanpa perubahan ini, "bisa diedit ulang" tidak akan pernah berjalan. Dua
-- baris di trigger lama menolaknya:
--
--   a. Guard pindah-site memanggil has_site_role_for(actor, old.site_id, …).
--      Untuk artikel yatim old.site_id null, sehingga hasilnya bukan true —
--      admin global sekalipun tidak bisa memindahkannya keluar.
--   b. `category_site_id is distinct from new.site_id` menolak begitu artikel
--      dipindahkan ke site baru sementara kategorinya masih penampung global.
--
-- Keduanya ditangani eksplisit. Sisa body dipertahankan verbatim.

create or replace function artikel.validate_article_write()
returns trigger
language plpgsql
security definer
set search_path = artikel, pg_catalog
as $$
declare category_site_id uuid; privileged boolean; actor_id uuid;
begin
  actor_id := artikel.current_article_actor();

  -- Guard pemindahan artikel antar site (dari 202609190001).
  if tg_op = 'UPDATE' and new.site_id is distinct from old.site_id then
    if old.site_id is null then
      -- Memungut artikel yatim: tidak ada site asal yang bisa diuji, jadi
      -- syaratnya admin global + admin di site tujuan. Ini jalan masuk kembali
      -- yang dijanjikan keputusan 28 September 2026, bukan celah: kalau blok
      -- ini tidak ada, artikel yatim tidak akan pernah bisa dipakai lagi.
      if not (
        artikel.is_global_admin()
        and artikel.has_site_role_for(actor_id, new.site_id, array['admin']::artikel.user_role[])
      ) then
        raise exception 'Hanya admin global yang boleh memindahkan artikel tak bertuan';
      end if;
    elsif new.site_id is null then
      -- Meyatimkan hanya boleh terjadi sebagai akibat delete_site. Itu dibedakan
      -- lewat penanda sesi artikel.orphaning yang dipasang delete_site dan
      -- dibersihkan di akhir — bukan lewat memeriksa siapa pemanggilnya, karena
      -- delete_site berjalan SECURITY DEFINER sehingga current_user tidak
      -- membedakannya dari sesi biasa. Penanda ini `set local`, jadi hilang
      -- sendiri saat transaksi berakhir dan tidak bisa bocor antar permintaan.
      if coalesce(current_setting('artikel.orphaning', true), '') <> 'on' then
        raise exception 'Artikel tidak boleh dilepas dari website lewat perubahan biasa';
      end if;
    elsif not (
      artikel.has_site_role_for(actor_id, old.site_id, array['admin']::artikel.user_role[])
      and artikel.has_site_role_for(actor_id, new.site_id, array['admin']::artikel.user_role[])
    ) then
      raise exception 'Tidak berwenang memindahkan artikel ke website lain';
    end if;
  end if;

  select site_id into category_site_id from artikel.categories where id = new.category_id;

  -- Kategori global (site_id null) diterima untuk artikel yatim DAN untuk
  -- artikel yang baru dipungut ke site: pemungutnya memilih kategori yang
  -- benar sesudah artikel masuk, tidak dipaksa melakukannya dalam satu langkah.
  if category_site_id is not null and category_site_id is distinct from new.site_id then
    raise exception 'Category does not belong to selected site';
  end if;

  privileged := artikel.has_site_role_for(actor_id, new.site_id, array['admin','editor']::artikel.user_role[]);

  -- Artikel baru wajib draft, kecuali dibuat aktor yang memang berwenang
  -- menerbitkan. Ini yang membuat Automation API bisa menulis status final
  -- dalam satu panggilan, tanpa memberi writer jalan pintas.
  if tg_op = 'INSERT' and new.status <> 'draft' and not privileged then
    raise exception 'New articles must start as draft';
  end if;

  if tg_op = 'UPDATE' and not privileged and new.author_id = actor_id and old.status not in ('draft','revision_requested') then
    raise exception 'Writer can only edit draft or revision requested articles';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if coalesce(current_setting('artikel.orphaning', true), '') = 'on' then
      -- Penurunan ke draft saat site dihapus melewati tabel transisi: apa pun
      -- status lamanya, artikel yatim berakhir sebagai draf. delete_site sudah
      -- memverifikasi pemanggilnya admin site tersebut, jadi otorisasinya tidak
      -- hilang — hanya dipindah ke satu tempat, bukan diulang di sini.
      null;
    elsif privileged then
      if not ((old.status = 'draft' and new.status = 'in_review')
           or (old.status = 'revision_requested' and new.status = 'in_review')
           or (old.status = 'in_review' and new.status in ('revision_requested','approved'))
           or (old.status = 'approved' and new.status in ('published','draft'))
           or (old.status = 'published' and new.status in ('archived','draft'))
           or (old.status = 'archived' and new.status = 'draft')) then
        raise exception 'Invalid article status transition';
      end if;
    elsif new.author_id = actor_id and actor_id is not null then
      if not (old.status in ('draft','revision_requested') and new.status = 'in_review') then
        raise exception 'Writer cannot perform this status transition';
      end if;
    else
      raise exception 'Not allowed to change article status';
    end if;
  end if;

  return new;
end;
$$;

-- 7. sync_article_distributions: artikel yatim tidak mendistribusikan apa pun --
--
-- Trigger ini membuat/memperbarui baris artikel.article_sites tiap artikel
-- ditulis. Untuk artikel yatim, new.site_id null sementara article_sites.site_id
-- NOT NULL, jadi penghapusan site gagal di tengah jalan dengan pelanggaran
-- not-null — bukan karena rancangannya salah, tapi karena artikel tanpa site
-- memang tidak punya tujuan distribusi.
--
-- Ini juga yang menjaga artikel yatim tak terlihat pembaca publik: Public Read
-- API membaca dari article_sites, dan baris itu tidak ada. Jadi guard di bawah
-- bukan sekadar menghindari error, ia bagian dari jaminan "tidak keluar di
-- website mana pun".
--
-- Sisa body dipertahankan verbatim dari produksi.

create or replace function artikel.sync_article_distributions()
returns trigger
language plpgsql
security definer
set search_path = artikel, pg_catalog
as $$
begin
  -- Artikel tak bertuan: tidak ada site tujuan, jadi tidak ada yang disinkronkan.
  -- Baris distribusi lamanya sudah ikut terhapus bersama site (article_sites
  -- ber-FK CASCADE ke sites).
  if new.site_id is null then
    return new;
  end if;

  if new.publish_scope = 'all_active_sites' then
    insert into artikel.categories (site_id, name, slug, description)
    select target.id, source_category.name, source_category.slug, source_category.description
    from artikel.sites target
    join artikel.categories source_category on source_category.id = new.category_id
    where target.is_active
    on conflict (site_id, slug) do nothing;

    insert into artikel.article_sites (article_id, site_id, category_id, slug, status, published_at)
    select
      new.id,
      target.id,
      coalesce(
        (select c.id
         from artikel.categories c
         join artikel.categories source_category on source_category.id = new.category_id
         where c.site_id = target.id
           and c.slug = source_category.slug
           and c.is_active
         limit 1),
        case when target.id = new.site_id then new.category_id else null end
      ),
      new.slug,
      new.status,
      case when new.status = 'published' then coalesce(new.published_at, now()) else null end
    from artikel.sites target
    where target.is_active
    on conflict do nothing;

    update artikel.article_sites distribution
    set category_id = coalesce(
          (select c.id from artikel.categories c
           join artikel.categories source_category on source_category.id = new.category_id
           where c.site_id = distribution.site_id and c.slug = source_category.slug and c.is_active limit 1),
          case when distribution.site_id = new.site_id then new.category_id else null end),
        slug = new.slug,
        status = new.status,
        published_at = case when new.status = 'published' then coalesce(new.published_at, now()) else null end
    where distribution.article_id = new.id;
  else
    insert into artikel.article_sites (article_id, site_id, category_id, slug, status, published_at)
    values (
      new.id,
      new.site_id,
      new.category_id,
      new.slug,
      new.status,
      case when new.status = 'published' then coalesce(new.published_at, now()) else null end
    )
    on conflict (article_id, site_id) do update set
      category_id = excluded.category_id,
      slug = excluded.slug,
      status = excluded.status,
      published_at = excluded.published_at;
  end if;
  return new;
end;
$$;

commit;

notify pgrst, 'reload schema';
