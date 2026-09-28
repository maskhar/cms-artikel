-- Migration: Kenali aktor otomasi di trigger validate_article_write
-- File: 202609280001_automation_article_actor.sql
--
-- Masalah yang ditutup di sini ditemukan 28 September 2026, saat memperbaiki
-- artikel.upsert_automation_article (202609100014). Memperbaiki RPC saja tidak
-- cukup: POST Automation API dengan status selain 'draft' tetap gagal.
--
-- Sebabnya artikel.validate_article_write menurunkan identitas aktor dari
-- auth.uid(). Jalur Automation API selalu memakai service_role key tanpa sesi
-- JWT, jadi auth.uid() NULL di sana. Akibatnya:
--
--   * INSERT dengan status <> 'draft' selalu kena 'New articles must start as
--     draft', tanpa memandang siapa pemilik API key.
--   * Saat status berubah pada UPDATE, has_site_role() ikut NULL sehingga
--     privileged = false, lalu cabang `new.author_id = auth.uid()` juga tidak
--     pernah benar, sehingga selalu jatuh ke 'Not allowed to change article
--     status'.
--
-- Jadi status 'published' yang dijanjikan kontrak API tidak akan pernah bisa
-- ditulis, bahkan setelah bug kolom di RPC diperbaiki.
--
-- Perbaikannya bukan melonggarkan workflow. Trigger tetap menjalankan aturan
-- yang sama persis; yang diganti hanya sumber identitas aktor. Untuk jalur
-- otomasi, identitas diambil dari setting transaksi artikel.automation_actor
-- yang di-set artikel.upsert_automation_article lewat set_config(..., true)
-- sehingga hilang sendiri di akhir transaksi.
--
-- Setting itu hanya dihormati saat auth.uid() IS NULL. User CMS yang login
-- selalu punya auth.uid(), jadi mereka tidak bisa memanggil set_config untuk
-- menyamar sebagai orang lain. Peran anon tidak punya policy INSERT/UPDATE pada
-- artikel.articles, jadi tidak pernah sampai ke trigger ini.
--
-- ⚠️ URUTAN MIGRASI — PENTING
-- Migrasi ini melakukan CREATE OR REPLACE penuh atas validate_article_write.
-- 202609190001_security_hardening.sql (branch security/critical-remediation)
-- juga me-replace fungsi yang sama dengan versi tanpa dukungan aktor otomasi.
-- Karena penomoran migrasi diurut leksikografis, 202609280001 selalu berjalan
-- setelah 202609190001 pada database bersih, sehingga versi inilah yang menang.
-- Tetapi pada database yang sudah menerapkan file ini lebih dulu lalu baru
-- menerima 202609190001 secara manual, dukungan aktor otomasi akan hilang diam-
-- diam dan POST Automation API kembali 500. Terapkan 202609190001 lebih dulu.
--
-- Guard pemindahan artikel antar site dari 202609190001 disalin apa adanya ke
-- sini supaya tidak hilang saat fungsi di-replace.

-- has_site_role_for() diperkenalkan di 202609190001. Dibuat ulang di sini
-- (idempoten, definisi identik) supaya migrasi ini berdiri sendiri pada lini
-- yang belum memuat migrasi pengerasan itu.
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

revoke execute on function artikel.has_site_role_for(uuid, uuid, artikel.user_role[]) from public;
grant execute on function artikel.has_site_role_for(uuid, uuid, artikel.user_role[]) to service_role;

-- Identitas aktor untuk penegakan workflow. auth.uid() selalu menang; setting
-- transaksi hanya dipakai kalau tidak ada sesi JWT sama sekali.
create or replace function artikel.current_article_actor()
returns uuid
language plpgsql
stable
security definer
set search_path to 'artikel', 'auth', 'pg_catalog'
as $$
declare session_actor uuid; automation_actor text;
begin
  session_actor := auth.uid();
  if session_actor is not null then
    return session_actor;
  end if;

  automation_actor := nullif(current_setting('artikel.automation_actor', true), '');
  if automation_actor is null then
    return null;
  end if;

  begin
    return automation_actor::uuid;
  exception when others then
    return null;
  end;
end;
$$;

revoke execute on function artikel.current_article_actor() from public;
grant execute on function artikel.current_article_actor() to authenticated, service_role;

create or replace function artikel.validate_article_write()
returns trigger
language plpgsql
set search_path to 'artikel', 'auth', 'pg_catalog'
as $$
declare category_site_id uuid; privileged boolean; actor_id uuid;
begin
  actor_id := artikel.current_article_actor();

  -- Guard pemindahan artikel antar site (dari 202609190001).
  if tg_op = 'UPDATE' and new.site_id is distinct from old.site_id then
    if not (
      artikel.has_site_role_for(actor_id, old.site_id, array['admin']::artikel.user_role[])
      and artikel.has_site_role_for(actor_id, new.site_id, array['admin']::artikel.user_role[])
    ) then
      raise exception 'Tidak berwenang memindahkan artikel ke website lain';
    end if;
  end if;

  select site_id into category_site_id from artikel.categories where id = new.category_id;
  if category_site_id is distinct from new.site_id then
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
    if privileged then
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

drop trigger if exists validate_article_write on artikel.articles;
create trigger validate_article_write
  before insert or update on artikel.articles
  for each row execute function artikel.validate_article_write();

comment on function artikel.current_article_actor() is
'Identitas aktor untuk penegakan workflow artikel. Mengembalikan auth.uid() bila ada sesi JWT; bila tidak ada, membaca setting transaksi artikel.automation_actor yang di-set artikel.upsert_automation_article. Setting hanya dihormati saat auth.uid() NULL sehingga user yang login tidak dapat menyamar.';
