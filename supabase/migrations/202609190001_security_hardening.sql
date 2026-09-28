-- Security hardening — forward-only patch untuk produksi.
--
-- Konteks: migrasi proyek ini diterapkan manual lewat
--   docker exec -i supabase-db psql -U postgres -d postgres < file.sql
-- Rapikan migration history menyusul (lihat Fase 4 plan remediasi).
--
-- Dijalankan satu transaksi. Kalau ada bagian gagal, seluruhnya rollback.

begin;

-- =====================================================================
-- 1. Helper role-check untuk user eksplisit
-- ---------------------------------------------------------------------
-- has_site_role() lama bergantung pada auth.uid(), jadi selalu NULL saat
-- dipanggil lewat service-role (tanpa sesi JWT). Itu sebabnya guard SQL
-- tidak bisa dipasang di delete_site tanpa versi yang menerima user id.
-- =====================================================================

create or replace function artikel.has_site_role_for(
  check_user_id uuid,
  target_site_id uuid,
  allowed_roles artikel.user_role[]
)
returns boolean
language sql
stable
security definer
set search_path to 'artikel', 'pg_catalog'
as $$
  select exists (
    select 1 from artikel.user_roles
    where user_id = check_user_id
      and is_active
      and role = any(allowed_roles)
      and (site_id = target_site_id or (site_id is null and role = 'admin'))
  );
$$;

-- Hanya server-side tepercaya. Kalau di-grant ke authenticated, user bisa
-- menebak-nebak keanggotaan role user lain.
revoke execute on function artikel.has_site_role_for(uuid, uuid, artikel.user_role[]) from public;
grant execute on function artikel.has_site_role_for(uuid, uuid, artikel.user_role[]) to service_role;

-- has_site_role() jadi pembungkus tipis; perilaku untuk RLS tidak berubah.
create or replace function artikel.has_site_role(
  target_site_id uuid,
  allowed_roles artikel.user_role[]
)
returns boolean
language sql
stable
security definer
set search_path to 'artikel', 'auth', 'pg_catalog'
as $$
  select artikel.has_site_role_for(auth.uid(), target_site_id, allowed_roles);
$$;

-- =====================================================================
-- 2. delete_site — CRITICAL: sebelumnya tanpa cek otorisasi sama sekali,
--    dan EXECUTE ter-grant ke PUBLIC + authenticated.
-- ---------------------------------------------------------------------
-- Catatan sengaja TIDAK memakai session_replication_role = 'replica':
-- itu ikut mematikan penegakan FK/CASCADE, bisa meninggalkan baris yatim.
-- Disable trigger audit secara selektif (perilaku lama) sudah tepat: DDL-nya
-- memegang lock sampai transaksi selesai, jadi sesi lain terblokir,
-- bukan kehilangan audit.
-- =====================================================================

-- Buang signature lama supaya versi tanpa guard tidak tersisa sebagai overload.
drop function if exists artikel.delete_site(uuid);

create function artikel.delete_site(site_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path to 'artikel', 'pg_catalog'
as $$
begin
  if actor_id is null
     or not artikel.has_site_role_for(actor_id, delete_site.site_id, array['admin']::artikel.user_role[])
  then
    raise exception 'Tidak berwenang menghapus website ini' using errcode = '42501';
  end if;

  -- gallery_items merujuk media_assets dengan RESTRICT, harus lebih dulu.
  delete from artikel.gallery_items
  where gallery_id in (
    select id from artikel.galleries where galleries.site_id = delete_site.site_id
  );

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

revoke execute on function artikel.delete_site(uuid, uuid) from public;
grant execute on function artikel.delete_site(uuid, uuid) to service_role;

-- =====================================================================
-- 3. Integritas audit trail
-- ---------------------------------------------------------------------
-- site_id CASCADE bikin jejak audit ikut terhapus bersama site-nya.
-- actor_id NO ACTION memblokir penghapusan akun user.
-- =====================================================================

alter table artikel.audit_logs drop constraint audit_logs_site_id_fkey;
alter table artikel.audit_logs add constraint audit_logs_site_id_fkey
  foreign key (site_id) references artikel.sites(id)
  on delete set null deferrable initially deferred;

alter table artikel.audit_logs drop constraint audit_logs_actor_id_fkey;
alter table artikel.audit_logs add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;

-- =====================================================================
-- 4. storage_site_id — resolver path menjadi site id
-- ---------------------------------------------------------------------
-- Versi lama hanya menerima UUID sebagai segmen folder pertama, sedangkan
-- aplikasi selalu menulis slug ("<slug>/articles/..."). Akibatnya semua
-- policy storage yang ber-scope mati diam-diam, dan yang menutupi kerusakan
-- itu justru policy broad lintas-tenant.
-- =====================================================================

create or replace function artikel.storage_site_id(path text)
returns uuid
language sql
stable
security definer
set search_path to 'artikel', 'storage', 'pg_catalog'
as $$
  select coalesce(
    case
      when (storage.foldername(path))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(path))[1]::uuid
    end,
    (select s.id from artikel.sites s where s.slug = (storage.foldername(path))[1])
  );
$$;

-- =====================================================================
-- 5. storage.objects — cabut akses blanket lintas-tenant
-- ---------------------------------------------------------------------
-- Policy ber-scope ("members read/upload article media", "owners
-- update/delete article media") sudah ada dan benar; begitu resolver di
-- atas diperbaiki, policy itu mulai berfungsi. Tiga policy broad di bawah
-- memberi semua anggota CMS akses ke media semua tenant.
-- =====================================================================

drop policy if exists "cms members read global media storage" on storage.objects;
drop policy if exists "cms members upload global media storage" on storage.objects;
drop policy if exists "cms owners delete global media storage" on storage.objects;

-- Varian TANPA prefix "cms " dari 202609110019. 202609130001 membuat versi
-- ber-prefix dengan nama berbeda, sehingga drop-nya tidak pernah mengenai yang
-- lama. Di produksi ketiganya kebetulan tidak ada (snapshot Fase 0 hanya memuat
-- yang ber-prefix), jadi drop ini no-op di sana — tetapi pada database hasil
-- `supabase db reset` ketiganya hidup dan memberi setiap anggota CMS akses
-- baca/tulis/hapus media SEMUA tenant di bucket artikel-media. Ditemukan
-- 28 September 2026 lewat diff struktur produksi vs database bersih.
drop policy if exists "members read global media storage" on storage.objects;
drop policy if exists "members upload global media storage" on storage.objects;
drop policy if exists "owners delete global media storage" on storage.objects;

-- =====================================================================
-- 6. Bucket artikel-media — blokir konten aktif
-- ---------------------------------------------------------------------
-- allowed_mime_types sempat dikosongkan, sehingga text/html dan
-- image/svg+xml (pembawa stored-XSS) ikut boleh diunggah.
-- Daftar di bawah tetap lebar (pustaka media memang menerima video, audio,
-- dan dokumen), hanya menutup tipe yang bisa mengeksekusi skrip.
-- =====================================================================

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/mp4',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip'
]
where id = 'artikel-media';

-- =====================================================================
-- 7. media_assets — scoping per site
-- ---------------------------------------------------------------------
-- site_id tidak pernah diisi aplikasi (93 baris NULL semua), jadi policy
-- terpaksa memakai is_media_member() yang tidak mengenal batas tenant.
-- Backfill dari prefix path lebih dulu, baru policy di-scope.
-- Verifikasi sebelum migrasi ini: 0 referensi media lintas-site pada
-- gallery_items, featured_image_path, maupun embed di body artikel.
-- =====================================================================

update artikel.media_assets
set site_id = artikel.storage_site_id(storage_path)
where site_id is null
  and artikel.storage_site_id(storage_path) is not null;

-- has_site_role(site_id, ...) menangani dua kasus sekaligus:
--   site_id terisi  -> anggota site itu, atau admin global
--   site_id NULL    -> admin global saja (path tak terpetakan/legacy)
drop policy if exists "authenticated users read global media assets" on artikel.media_assets;
create policy "members read site media assets" on artikel.media_assets
  for select to authenticated
  using (artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[]));

drop policy if exists "members create media assets" on artikel.media_assets;
create policy "members create site media assets" on artikel.media_assets
  for insert to authenticated
  with check (
    artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
    and created_by = auth.uid()
    -- site_id yang diklaim harus cocok dengan path sebenarnya
    and site_id is not distinct from artikel.storage_site_id(storage_path)
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'artikel-media'
        and o.name = media_assets.storage_path
        and o.owner_id = auth.uid()::text
    )
  );

drop policy if exists "editors manage media assets" on artikel.media_assets;
create policy "editors manage site media assets" on artikel.media_assets
  for update to authenticated
  using (
    artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
    and created_by = auth.uid()
  )
  with check (
    artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
    and created_by = auth.uid()
    and site_id is not distinct from artikel.storage_site_id(storage_path)
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'artikel-media'
        and o.name = media_assets.storage_path
        and o.owner_id = auth.uid()::text
    )
  );

-- "editors delete media assets" sudah berbasis has_site_role(site_id, ...);
-- setelah backfill barulah policy itu benar-benar ber-scope. Tidak diubah.

-- =====================================================================
-- 8. Policy automation_api_* — terlalu longgar
-- ---------------------------------------------------------------------
-- Keenamnya hanya menuntut "punya baris user_roles di site tersebut",
-- tanpa cek role maupun is_active, sehingga melewati aturan authorship.
-- Jalur automation memakai service-role key yang bypass RLS, jadi policy
-- ini tidak memberi manfaat apa pun — hanya memperluas permukaan serangan.
-- =====================================================================

drop policy if exists automation_api_insert_articles on artikel.articles;
drop policy if exists automation_api_update_articles on artikel.articles;
drop policy if exists automation_api_select_articles on artikel.articles;
drop policy if exists automation_api_insert_revisions on artikel.article_revisions;
drop policy if exists automation_api_insert_categories on artikel.categories;
drop policy if exists automation_api_select_categories on artikel.categories;

-- =====================================================================
-- 9. upsert_automation_article — kunci akses
-- ---------------------------------------------------------------------
-- SECURITY DEFINER dengan EXECUTE ke PUBLIC + authenticated.
-- Body-nya sendiri rusak (merujuk artikel.site_users yang tidak pernah ada,
-- kolom featured_image/meta_keywords salah) — perbaikannya menyusul di
-- Fase 4. Di sini cukup pastikan user biasa tidak bisa memanggilnya.
-- =====================================================================

do $$
declare fn record;
begin
  for fn in
    select oid::regprocedure as sig
    from pg_proc
    where proname = 'upsert_automation_article'
      and pronamespace = 'artikel'::regnamespace
  loop
    execute format('revoke execute on function %s from public', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end $$;

-- =====================================================================
-- 10. Cegah pemindahan artikel lintas-tenant
-- ---------------------------------------------------------------------
-- WITH CHECK pada "authors and editors update articles" lolos lewat klausa
-- author_id = auth.uid(), sehingga penulis bisa memindahkan artikelnya
-- sendiri ke site mana pun. Guard dipasang di trigger (punya akses OLD dan
-- NEW) alih-alih di RLS, supaya tidak perlu subquery rawan di WITH CHECK.
-- =====================================================================

create or replace function artikel.validate_article_write()
returns trigger
language plpgsql
set search_path to 'artikel', 'auth', 'pg_catalog'
as $$
declare category_site_id uuid; privileged boolean;
begin
  if tg_op = 'UPDATE' and new.site_id is distinct from old.site_id then
    if not (
      artikel.has_site_role(old.site_id, array['admin']::artikel.user_role[])
      and artikel.has_site_role(new.site_id, array['admin']::artikel.user_role[])
    ) then
      raise exception 'Tidak berwenang memindahkan artikel ke website lain';
    end if;
  end if;

  select site_id into category_site_id from artikel.categories where id = new.category_id;
  if category_site_id is distinct from new.site_id then raise exception 'Category does not belong to selected site'; end if;
  privileged := artikel.has_site_role(new.site_id, array['admin','editor']::artikel.user_role[]);
  if tg_op = 'INSERT' and new.status <> 'draft' then raise exception 'New articles must start as draft'; end if;
  if tg_op = 'UPDATE' and not privileged and new.author_id = auth.uid() and old.status not in ('draft','revision_requested') then
    raise exception 'Writer can only edit draft or revision requested articles';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if privileged then
      if not ((old.status = 'draft' and new.status = 'in_review') or (old.status = 'revision_requested' and new.status = 'in_review') or (old.status = 'in_review' and new.status in ('revision_requested','approved')) or (old.status = 'approved' and new.status in ('published','draft')) or (old.status = 'published' and new.status in ('archived','draft')) or (old.status = 'archived' and new.status = 'draft')) then raise exception 'Invalid article status transition'; end if;
    elsif new.author_id = auth.uid() then
      if not (old.status in ('draft','revision_requested') and new.status = 'in_review') then raise exception 'Writer cannot perform this status transition'; end if;
    else raise exception 'Not allowed to change article status';
    end if;
  end if;
  return new;
end;
$$;

-- =====================================================================
-- 11. cms_hostnames — hentikan enumerasi lintas-tenant
-- ---------------------------------------------------------------------
-- SELECT sebelumnya USING (true): semua user login bisa membaca pemetaan
-- domain seluruh tenant. Baris canonical (site_id NULL) tetap terbaca semua
-- anggota supaya resolusi context CMS tidak terganggu.
-- =====================================================================

drop policy if exists "authenticated read cms hostnames" on artikel.cms_hostnames;
create policy "members read cms hostnames" on artikel.cms_hostnames
  for select to authenticated
  using (
    site_id is null
    or artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
  );

-- =====================================================================
-- 12. Default privileges — cegah tabel baru lahir tanpa proteksi
-- ---------------------------------------------------------------------
-- Tanpa ini, tabel baru di skema artikel otomatis dapat grant penuh untuk
-- authenticated sebelum RLS sempat dipasang.
-- =====================================================================

alter default privileges in schema artikel revoke all on tables from authenticated;
alter default privileges in schema artikel revoke all on tables from anon;

-- =====================================================================
-- 13. Indeks pendukung
-- =====================================================================

create index if not exists audit_logs_site_created_idx on artikel.audit_logs (site_id, created_at desc);
create index if not exists audit_logs_actor_idx on artikel.audit_logs (actor_id);
create index if not exists articles_author_idx on artikel.articles (author_id);
create index if not exists articles_category_idx on artikel.articles (category_id);
create index if not exists api_keys_site_idx on artikel.api_keys (site_id);
create index if not exists user_roles_site_idx on artikel.user_roles (site_id);
create index if not exists media_assets_created_by_idx on artikel.media_assets (created_by);
create index if not exists media_assets_site_idx on artikel.media_assets (site_id);

commit;

notify pgrst, 'reload schema';
