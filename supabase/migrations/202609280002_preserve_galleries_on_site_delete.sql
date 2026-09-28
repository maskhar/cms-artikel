-- Migration: Pertahankan galeri & media saat website dihapus
-- File: 202609280002_preserve_galleries_on_site_delete.sql
--
-- Ditemukan 28 September 2026 lewat diff struktur produksi vs database hasil
-- `supabase db reset` (Fase 4.6).
--
-- 202609100018 menyatakan niatnya di baris 3: "Keeps galleries and media_assets
-- (they are reusable assets)", lalu baris 5-14 melonggarkan NOT NULL dan
-- mengubah kedua foreign key jadi `on delete set null`.
--
-- Di produksi baris 5-14 itu TIDAK PERNAH KENA. Keadaan nyata 28 September 2026:
--
--   galleries.site_id            NOT NULL          (harusnya nullable)
--   galleries_site_id_fkey       ON DELETE CASCADE (harusnya set null)
--   media_assets_site_id_fkey    ON DELETE CASCADE (harusnya set null)
--
-- media_assets.site_id sendiri sudah nullable, tapi bukan karena migrasi ini —
-- 202609110019 dan 202609130001 melonggarkannya lagi untuk pustaka media global.
-- Keduanya TIDAK menyentuh foreign key-nya, jadi FK cascade bertahan diam-diam.
-- Kolom yang nullable dengan FK cascade adalah kombinasi yang menyesatkan:
-- skemanya seolah mengizinkan aset global, tapi penghapusan site tetap
-- memusnahkan barisnya sebelum sempat jadi global.
--
-- Akibat nyata sebelum migrasi ini: menghapus satu website ikut memusnahkan
-- seluruh galeri dan media miliknya, termasuk baris media yang sudah dipakai
-- artikel site LAIN lewat pustaka global.
--
-- Keputusan produk (dikonfirmasi 28 September 2026): galeri dan media
-- dipertahankan sebagai aset global, sesuai niat asli 202609100018.
--
-- Catatan perilaku yang SENGAJA tidak diubah: user_roles_site_id_fkey adalah
-- CASCADE, jadi menghapus site juga menghapus role orang di site itu. Kalau itu
-- satu-satunya site seseorang, ia berhenti jadi anggota CMS dan tidak lagi
-- melihat aset yatim — termasuk yang dibuatnya sendiri. Itu benar: orang tanpa
-- role aktif memang tidak berhak melihat apa pun. Disebut di sini supaya tidak
-- dikira regresi saat diamati nanti.
--
-- Catatan: saat migrasi ini ditulis, artikel.galleries dan artikel.gallery_items
-- KOSONG di produksi (0 baris), jadi perubahan NOT NULL di bawah tidak menyentuh
-- data apa pun. media_assets berisi 93 baris, 2 di antaranya sudah site_id null.

begin;

-- 1. Samakan skema dengan niat 202609100018 -------------------------------

alter table artikel.galleries alter column site_id drop not null;

alter table artikel.galleries
  drop constraint if exists galleries_site_id_fkey,
  add constraint galleries_site_id_fkey
    foreign key (site_id) references artikel.sites(id) on delete set null;

alter table artikel.media_assets
  drop constraint if exists media_assets_site_id_fkey,
  add constraint media_assets_site_id_fkey
    foreign key (site_id) references artikel.sites(id) on delete set null;

-- 2. Hentikan delete_site memusnahkan isi galeri --------------------------
--
-- Versi produksi membuka dengan menghapus seluruh gallery_items milik site:
--
--   delete from artikel.gallery_items
--   where gallery_id in (select id from artikel.galleries where site_id = ...);
--
-- Komentarnya menjelaskan alasannya: "gallery_items merujuk media_assets dengan
-- RESTRICT, harus lebih dulu." Itu benar SELAMA media_assets ikut terhapus
-- cascade — gallery_items yang tertinggal akan memblokir penghapusan barisnya.
--
-- Setelah langkah 1, media_assets tidak lagi ikut terhapus, jadi tidak ada lagi
-- yang perlu dihindari. Kalau delete penghapus isi ini dibiarkan, hasilnya jadi
-- separuh rusak: galerinya selamat tapi ISINYA hilang — lebih buruk daripada
-- dua perilaku konsisten mana pun.
--
-- Sisa body dipertahankan verbatim dari produksi, termasuk guard actor_id dari
-- 202609190001 dan pencatatan audit dari 202609280001. JANGAN menyalin versi
-- dari 202609100018 ke sini: versi itu tidak punya guard otorisasi sama sekali
-- (lubang CRITICAL #1).

create or replace function artikel.delete_site(site_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = artikel, pg_catalog
as $$
begin
  if actor_id is null
     or not artikel.has_site_role_for(actor_id, delete_site.site_id, array['admin']::artikel.user_role[])
  then
    raise exception 'Tidak berwenang menghapus website ini' using errcode = '42501';
  end if;

  -- Galeri dan media kini dipertahankan sebagai aset global: foreign key-nya
  -- `on delete set null`, jadi site_id-nya dikosongkan otomatis dan isi galeri
  -- tetap utuh. Tidak ada penghapusan gallery_items di sini lagi.

  alter table artikel.sites disable trigger audit_sites;
  alter table artikel.api_keys disable trigger audit_api_keys;
  alter table artikel.cms_hostnames disable trigger audit_cms_hostnames;

  delete from artikel.sites where id = delete_site.site_id;

  alter table artikel.sites enable trigger audit_sites;
  alter table artikel.api_keys enable trigger audit_api_keys;
  alter table artikel.cms_hostnames enable trigger audit_cms_hostnames;

  -- actor_id kini terisi sungguhan; sebelumnya selalu NULL karena auth.uid()
  -- kosong di panggilan service-role.
  insert into artikel.audit_logs (site_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, delete_site.actor_id, 'sites.delete', 'sites', delete_site.site_id,
          '{"changed_fields": []}'::jsonb);
end;
$$;

revoke execute on function artikel.delete_site(uuid, uuid) from public, anon, authenticated;
grant execute on function artikel.delete_site(uuid, uuid) to service_role;

-- 3. Buat galeri yatim tetap terlihat -------------------------------------
--
-- Policy galeri dari 202609100012 semuanya bersandar pada has_site_role(site_id, …).
-- has_site_role_for menguji `site_id = target_site_id or (site_id is null and
-- role = 'admin')` — perbandingan `user_roles.site_id = null` selalu NULL, jadi
-- untuk galeri yatim hanya cabang admin global yang bisa true, dan itu pun hanya
-- kalau si pemanggil memang admin global.
--
-- Artinya tanpa penyesuaian ini, galeri yang site-nya baru dihapus akan hilang
-- dari pandangan SEMUA orang kecuali admin global — termasuk dari pembuatnya
-- sendiri. Itu mengubah "dipertahankan sebagai aset global" jadi "hilang diam-
-- diam", persis kebalikan dari keputusan produknya.
--
-- Pola yang dipakai menyalin media_assets sesudah 202609190001: baris ber-site
-- dijaga has_site_role seperti biasa; baris yatim (site_id is null) memakai
-- is_media_member() — keanggotaan CMS mana pun — untuk baca, dan tetap dibatasi
-- ke pembuat/admin global untuk ubah dan hapus.

drop policy if exists "members read galleries" on artikel.galleries;
create policy "members read galleries" on artikel.galleries
for select to authenticated
using (
  case
    when site_id is null then artikel.is_media_member()
    else artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
  end
);

-- INSERT sengaja TIDAK dilonggarkan: galeri baru wajib punya site. Aset yatim
-- hanya boleh lahir dari penghapusan site, bukan dibuat langsung.
drop policy if exists "members create galleries" on artikel.galleries;
create policy "members create galleries" on artikel.galleries
for insert to authenticated
with check (
  created_by = auth.uid()
  and site_id is not null
  and artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
);

drop policy if exists "members update galleries" on artikel.galleries;
create policy "members update galleries" on artikel.galleries
for update to authenticated
using (
  created_by = auth.uid()
  or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
)
with check (
  created_by = auth.uid()
  or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
);

drop policy if exists "editors delete galleries" on artikel.galleries;
create policy "editors delete galleries" on artikel.galleries
for delete to authenticated
using (
  created_by = auth.uid()
  or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
);

-- media_assets perlu cabang yang sama, dan ini BUKAN detail kosmetik.
--
-- Ditemukan lewat uji perilaku di database lokal, bukan dari membaca policy:
-- setelah delete_site, seorang editor site lain melihat galeri=1, item=1,
-- tapi media=0. Galerinya selamat, daftar isinya selamat, tapi setiap baris
-- media yang ditunjuk tak terlihat — galerinya render KOSONG untuk semua orang.
-- Itu keadaan separuh rusak yang sama persis dengan yang dihindari di langkah 2,
-- hanya pindah satu tabel.
--
-- Sebabnya `members read site media assets` dari 202609190001 hanya menguji
-- has_site_role(site_id, …); untuk site_id null hasilnya bukan true.
--
-- Ini TIDAK membuka kembali CRITICAL #2. Yang ditutup Fase 1.3 adalah akses
-- lintas-tenant ke media yang DIMILIKI tenant lain; media ber-site tetap ketat
-- per site di bawah ini. Yang dilonggarkan hanya baris tanpa pemilik — dan
-- "tanpa pemilik, terlihat semua anggota CMS" adalah definisi aset global yang
-- dipilih 28 September 2026.
--
-- UPDATE sengaja TIDAK diberi cabang yatim: aset global adalah arsip, boleh
-- dibaca dan boleh dihapus pembuatnya (policy delete sudah mengizinkan lewat
-- `created_by = auth.uid()`), tapi tidak diedit ramai-ramai. Dibiarkan tertutup
-- bukan karena terlewat.
drop policy if exists "members read site media assets" on artikel.media_assets;
create policy "members read site media assets" on artikel.media_assets
for select to authenticated
using (
  case
    when site_id is null then artikel.is_media_member()
    else artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
  end
);

-- gallery_items ikut lewat galeri induknya; samakan cabang yatimnya.
drop policy if exists "members read gallery items" on artikel.gallery_items;
create policy "members read gallery items" on artikel.gallery_items
for select to authenticated
using (exists (
  select 1 from artikel.galleries g
  where g.id = gallery_items.gallery_id
    and case
      when g.site_id is null then artikel.is_media_member()
      else artikel.has_site_role(g.site_id, array['admin','editor','writer']::artikel.user_role[])
    end
));

drop policy if exists "members manage gallery items" on artikel.gallery_items;
create policy "members manage gallery items" on artikel.gallery_items
for all to authenticated
using (exists (
  select 1 from artikel.galleries g
  where g.id = gallery_items.gallery_id
    and (g.created_by = auth.uid()
         or artikel.has_site_role(g.site_id, array['admin','editor']::artikel.user_role[]))
))
with check (exists (
  select 1 from artikel.galleries g
  where g.id = gallery_items.gallery_id
    and (g.created_by = auth.uid()
         or artikel.has_site_role(g.site_id, array['admin','editor']::artikel.user_role[]))
));

commit;

notify pgrst, 'reload schema';
