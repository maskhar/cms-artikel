# Migration Ledger

**Terakhir diverifikasi:** 28 September 2026 terhadap produksi `20.20.20.173`.

Catatan hidup: migrasi mana sudah diterapkan di mana. Sebelum dokumen ini ada,
tidak ada catatan sama sekali dan satu-satunya cara mengetahui keadaan produksi
adalah menginspeksi katalog PostgreSQL langsung.

---

## ⚠️ Tidak ada tabel ledger di database

`artikel.schema_migrations` **tidak ada** — sudah diverifikasi
(`to_regclass('artikel.schema_migrations') is null`). Proyek ini tidak memakai
Supabase CLI untuk migrasi; SQL diterapkan manual:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < migration.sql
```

Konsekuensinya: **tidak ada yang mencegah satu migrasi dijalankan dua kali atau
terlewat sama sekali.** Karena itu status di bawah tidak dibaca dari tabel
ledger, melainkan dibuktikan lewat **marker** — objek nyata di katalog yang hanya
ada kalau migrasi itu benar-benar jalan. Tiap baris menyebut marker-nya supaya
dapat diperiksa ulang kapan pun tanpa mempercayai dokumen ini.

Jangan menambahkan tabel ledger sekarang tanpa membahasnya: mengisi tabel itu
secara retroaktif berarti menuliskan klaim yang tidak bisa diverifikasi ulang.
Marker lebih jujur.

---

## Status produksi (`20.20.20.173`, schema `artikel`)

Semua 27 migrasi di `supabase/migrations/` **sudah diterapkan**. Diverifikasi
28 September 2026 lewat query marker read-only.

| # | Migrasi | Marker pembuktian | Status |
|---|---|---|---|
| 01 | `202609100001_create_artikel_schema.sql` | schema `artikel` + 17 tabel ada | ✅ |
| 02 | `202609100002_add_rls_policies.sql` | policy dasar `articles` ada | ✅ |
| 03 | `202609100003_add_global_admin.sql` | `user_roles.site_id` nullable | ✅ |
| 04 | `202609100004_seed_dev_admin.sql` | seed dev | ✅ |
| 05 | `202609100005_article_workflow_guards.sql` | trigger `validate_article_write` | ✅ |
| 06 | `202609100006_article_revisions.sql` | tabel `article_revisions` | ✅ |
| 07 | `202609100007_writer_edit_guard.sql` | guard writer di trigger | ✅ |
| 08 | `202609100008_article_media_and_tags.sql` | `media_assets`, `tags`, `storage_site_id()` | ✅ |
| 09 | `202609100009_rate_limits_and_audit.sql` | `api_key_rate_limits`, `audit_logs` | ✅ |
| 10 | `202609100010_cms_hostnames.sql` | tabel `cms_hostnames` | ✅ |
| 11 | `202609100011_management_statuses.sql` | `has_site_role()` versi cek `is_active` | ✅ |
| 12 | `202609100012_gallery_addons.sql` | `galleries`, `gallery_items`, `article_addons` | ✅ |
| 13 | `202609100013_fix_audit_logs_fkey.sql` | ditimpa #14, lihat catatan | ✅ |
| 14 | `202609100014_audit_logs_cascade.sql` | `audit_logs_site_id_fkey` → dibalik #190001 | ✅ |
| 15 | `202609100015_delete_site_function.sql` | ditimpa #16/#17/#18 | ✅ |
| 16 | `202609100016_delete_site_function_v2.sql` | ditimpa #17/#18 | ✅ |
| 17 | `202609100017_delete_site_function_v3.sql` | ditimpa #18 | ✅ |
| 18 | `202609100018_delete_site_safe.sql` | `delete_site` **2 argumen** (`pronargs = 2`) | ✅ |
| 19 | `202609100019_add_external_id_to_articles.sql` | kolom `articles.external_id` | ✅ |
| 20 | `202609100020_create_upsert_automation_article_function.sql` | `upsert_automation_article` ada, **bebas `site_users`**, pakai `featured_image_path` | ✅ |
| 21 | `202609100021_add_automation_api_rls_policies.sql` | **nol** policy `automation_api_*` | ✅ |
| 22 | `202609110019_global_media_library.sql` | `media_assets.site_id` nullable | ✅ |
| 23 | `202609110020_fix_api_key_rate_limit.sql` | fungsi `consume_api_key_rate_limit` | ✅ |
| 24 | `202609120001_article_multi_site_distribution.sql` | tabel `article_sites` | ✅ |
| 25 | `202609130001_sync_global_media_library.sql` | fungsi `is_media_member` | ✅ |
| 26 | `202609190001_security_hardening.sql` | `has_site_role_for`, MIME allowlist non-null, policy `members read site media assets` | ✅ |
| 27 | `202609280001_automation_article_actor.sql` | fungsi `current_article_actor`; `validate_article_write` memanggilnya; RPC memanggil `set_config('artikel.automation_actor', …)` | ✅ |

Query marker lengkap yang dipakai ada di bagian [Cara verifikasi ulang](#cara-verifikasi-ulang).

---

## Perubahan penomoran, 28 September 2026

Tiga pasang nomor duplikat dibereskan (bentrok primary key kalau tabel
`schema_migrations` pernah diaktifkan, dan urutan apply-nya ambigu bagi manusia
maupun `supabase db reset`):

| Sebelum | Sesudah | Alasan urutan |
|---|---|---|
| `202609100013_add_external_id_to_articles.sql` | `202609100019_…` | Rantai automation harus jalan **setelah** rantai `delete_site` selesai (#15–#18); tidak ada dependensi balik. |
| `202609100014_create_upsert_automation_article_function.sql` | `202609100020_…` | Butuh `articles.external_id` dari #19. |
| `202609100015_add_automation_api_rls_policies.sql` | `202609100021_…` | Menyebut RPC dari #20. |

Nomor `…13`, `…14`, `…15` tetap dipegang rantai audit/`delete_site`
(`fix_audit_logs_fkey` → `audit_logs_cascade` → `delete_site_function`) karena
**berurutan secara semantik**: `audit_logs_cascade` men-drop constraint yang
dibuat `fix_audit_logs_fkey`; membalik urutannya akan gagal.

Dihapus pada tanggal yang sama:

- `202609110001_global_media_library.sql` — **sepenuhnya digantikan
  `202609110019_global_media_library.sql`**. Terverifikasi, bukan diasumsikan:
  keempat policy yang dibuatnya (`members read/create media assets`,
  `editors manage/delete media assets`) berasal dari `202609100012` dan
  di-`drop … if exists` lalu dibuat ulang oleh `…19`; satu-satunya pernyataan
  lain, `update storage.buckets set file_size_limit = 20971520,
  allowed_mime_types = null`, diulang verbatim di `202609130001:77`. Tidak ada
  migrasi di antara keduanya yang menyentuh `media_assets` atau bucket
  `artikel-media`, jadi tidak ada jendela di mana isinya mengubah hasil akhir.

`supabase/manual/202609100015_add_automation_api_rls_policies_fixed.sql`
**sengaja tetap memakai nomor lama** — file itu catatan historis tentang SQL yang
benar-benar pernah dijalankan manual di server. Menamainya ulang akan memalsukan
catatan.

---

## Migrasi yang saling menimpa (jangan apply sebagian)

Beberapa migrasi me-`create or replace` objek yang sama. Pada database bersih
urutan leksikografis menyelesaikannya sendiri. Pada database yang menerima file
secara manual, **urutan salah = regresi diam-diam**:

| Objek | Ditulis oleh | Pemenang yang benar |
|---|---|---|
| `artikel.audit_logs_site_id_fkey` | #13 → #14 → #190001 | **#190001** (`on delete set null deferrable`) — #14 memasang `cascade` yang menghapus jejak audit |
| `artikel.delete_site` | #15 → #16 → #17 → #18 → #190001 | **#190001** (2 argumen + guard role) |
| `artikel.validate_article_write` | #05 → #07 → #190001 → #280001 | **#280001** (dukungan aktor otomasi) |
| `artikel.has_site_role_for` | #190001 → #280001 | **#280001** |
| Policy `media_assets` | #12 → #110019 → #130001 → #190001 | **#190001** (ber-scope per site) |
| `storage.buckets.allowed_mime_types` | #110019 (null) → #130001 (null) → #190001 (allowlist) | **#190001** (non-null; menutup stored-XSS via `text/html`, `image/svg+xml`) |

⚠️ **Menjalankan #190001 setelah #280001 akan mencabut dukungan aktor otomasi**
dan mematikan `POST` Automation API untuk status selain `draft`. Peringatan ini
juga ada di kepala file #280001.

---

## Hasil verifikasi `supabase db reset` (28 September 2026)

Fase 4.6 dijalankan sungguhan, bukan dinilai dari membaca file. `supabase init`
+ `supabase start` + `supabase db reset` terhadap stack Supabase lokal bersih,
lalu struktur hasilnya (policy, function, kolom, RLS, indeks) di-diff terhadap
produksi.

**Hasil: `supabase db reset` sekarang selesai bersih.** Sebelumnya mustahil.
Dua cacat ditemukan dan diperbaiki karena verifikasi ini:

1. **Rantai migrasi gagal di `202609100003`** —
   `null value in column "site_id" of relation "user_roles" violates not-null`.
   `site_id` mewarisi NOT NULL dari primary key komposit di `202609100001`;
   melepas PK tidak melepas NOT NULL-nya. `alter … drop not null` baru ada di
   `202609100004`, yaitu **setelah** insert admin global yang memakai
   `site_id = null`. Dipindahkan ke `202609100003` (idempoten, `202609100004`
   tetap aman). Seed admin juga dikondisikan pada keberadaan user karena
   `user_roles.user_id` punya FK ke `auth.users` yang kosong di database bersih.

2. **Tiga policy storage yatim hidup kembali di database bersih** —
   `members read/upload global media storage`, `owners delete global media
   storage` (dari `202609110019`). `202609130001` membuat versi ber-prefix
   `cms ` dengan nama berbeda, jadi `drop` di `202609190001` tidak pernah
   mengenai yang lama. Di produksi ketiganya kebetulan tidak ada, jadi tidak
   pernah terlihat; pada database hasil `db reset` ketiganya memberi **setiap
   anggota CMS akses baca/tulis/hapus media semua tenant** di bucket
   `artikel-media` — persis lubang CRITICAL #2 yang Fase 1.3 tutup. Drop
   eksplisit ditambahkan ke `202609190001`. Ini yang dimaksud plan item 1.3.1;
   sebelumnya baru separuh terlaksana.

### Sisa divergensi produksi vs database bersih

Setelah kedua perbaikan, objek milik CMS artikel identik **kecuali dua hal**.
Keduanya sudah ada sebelum sesi ini, **belum diubah di produksi**, dan menunggu
konfirmasi eksplisit karena menyentuh skema produksi:

| Objek | Produksi | Hasil `db reset` | Dampak |
|---|---|---|---|
| `artikel.galleries.site_id` | `NOT NULL`, FK `on delete cascade` | nullable, FK `on delete set null` | `202609100018` baris 5 dan 9–10 tampaknya tidak pernah mengenai `galleries` di produksi (`media_assets` pada baris 6 mengenai). Akibatnya menghapus site **ikut menghapus** galerinya di produksi, padahal komentar migrasi menyatakan niat sebaliknya ("Keeps galleries and media_assets"). **0 baris `galleries` di produksi**, jadi belum ada data yang terdampak. |
| Policy `editors delete media assets` | versi `202609100012` (tanpa guard `site_id is not null`) | versi `202609110019` (dengan guard) | Perbedaan defensif saja: `has_site_role(null, …)` tidak mengembalikan true, jadi media global tetap hanya bisa dihapus pembuatnya di kedua versi. Versi baru menyatakannya eksplisit. |

Tujuh function terbaca "berbeda" pada perbandingan hash `prosrc`. **Bukan
perbedaan perilaku**: setelah normalisasi whitespace, seluruh body identik
(0 baris beda). Penyebabnya CRLF, karena file di produksi diterapkan lewat `scp`
dari Windows. Jangan mengejar selisih hash ini.

Policy `storage.objects` milik aplikasi lain (soundpub, chatten_cafe, dan
bucket non-`artikel-media` lain) hanya ada di produksi. Itu wajar — stack
Supabase itu dipakai bersama; jangan pernah dipakai sebagai alasan mengubah
produksi.

### Cara mengulang verifikasi ini

```bash
npx supabase start     # butuh Docker; config.toml sudah ada di repo
npx supabase db reset  # harus selesai tanpa ERROR
```

---

## Cara verifikasi ulang

Read-only, aman dijalankan kapan pun terhadap produksi:

```bash
ssh maskhar@20.20.20.173
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
select 'schema_migrations_ada' as marker, (to_regclass('artikel.schema_migrations') is not null)::text as val
union all select '0019_external_id', (exists(select 1 from information_schema.columns where table_schema='artikel' and table_name='articles' and column_name='external_id'))::text
union all select '0020_rpc_bebas_site_users', (select (prosrc not like '%site_users%')::text from pg_proc where pronamespace='artikel'::regnamespace and proname='upsert_automation_article')
union all select '0021_nol_policy_automation', (not exists(select 1 from pg_policies where policyname like 'automation_api_%'))::text
union all select '0018_delete_site_nargs', (select pronargs::text from pg_proc where pronamespace='artikel'::regnamespace and proname='delete_site' limit 1)
union all select '110020_rate_limit_fn', (exists(select 1 from pg_proc where pronamespace='artikel'::regnamespace and proname='consume_api_key_rate_limit'))::text
union all select '120001_article_sites', (to_regclass('artikel.article_sites') is not null)::text
union all select '130001_is_media_member', (exists(select 1 from pg_proc where pronamespace='artikel'::regnamespace and proname='is_media_member'))::text
union all select '190001_has_site_role_for', (exists(select 1 from pg_proc where pronamespace='artikel'::regnamespace and proname='has_site_role_for'))::text
union all select '190001_mime_allowlist', (select (allowed_mime_types is not null)::text from storage.buckets where id='artikel-media')
union all select '190001_media_ber_scope', (exists(select 1 from pg_policies where tablename='media_assets' and policyname='members read site media assets'))::text
union all select '280001_current_article_actor', (exists(select 1 from pg_proc where pronamespace='artikel'::regnamespace and proname='current_article_actor'))::text
union all select '280001_trigger_pakai_actor', (select (prosrc like '%current_article_actor%')::text from pg_proc where pronamespace='artikel'::regnamespace and proname='validate_article_write');
SQL
```

Semua baris harus `true`, kecuali `schema_migrations_ada` (`false`) dan
`0018_delete_site_nargs` (`2`).

---

## Aturan pemeliharaan

1. **Tambah baris ke tabel status di atas setiap kali migrasi baru dibuat**,
   lengkap dengan marker yang membuktikannya — bukan sekadar nama file.
2. **Jangan pakai ulang nomor yang sudah terpakai.** Nomor tertinggi sekarang
   `202609280001`.
3. **Jangan menamai ulang migrasi yang sudah diterapkan di produksi** kecuali
   dicatat di bagian perubahan penomoran, seperti yang dilakukan 28 September 2026.
4. Kalau migrasi menyentuh objek yang sudah ada di tabel "saling menimpa",
   perbarui baris itu juga.
5. Sebelum apply manual di server: jalankan blok verifikasi di atas lebih dulu,
   supaya diketahui keadaan awal — tidak ada tabel ledger yang akan mengingatkan.

## Dokumen terkait

- [`DB-STATE-SNAPSHOT.md`](DB-STATE-SNAPSHOT.md) — snapshot policy/function produksi sebelum Fase 1.
- [`API-DEPLOYMENT.md`](API-DEPLOYMENT.md) — prosedur apply migrasi ke server.
- [`../supabase/manual/README.md`](../supabase/manual/README.md) — SQL hotfix manual; bukan migrasi, jangan diulang otomatis.
