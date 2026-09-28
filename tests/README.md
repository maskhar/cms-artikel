# Test Suite: Automation API

Cakupan tes untuk fitur Automation API Artikel CMS.

> Ditulis ulang 28 September 2026. Versi sebelumnya mendokumentasikan hal-hal yang
> tidak ada: tabel `artikel.site_users`, kolom `artikel.sites.theme_config`, dan
> kolom `artikel.api_keys` bernama `user_id`/`name`/`key_hash`/`is_active`. Skrip
> setup di dalamnya tidak bisa dijalankan sama sekali, dan blok "expected output"
> menyalin keluaran suite lama yang juga rusak. Semua sudah disamakan dengan
> skema serta skrip tes yang nyata.

## Struktur

```
tests/
├── integration/
│   └── test_upsert_automation_article.sql   # Tes fungsi PostgreSQL
└── e2e/
    ├── test_automation_api.sh                # Tes E2E (bash + curl + jq)
    └── test_automation_api.ps1               # Tes E2E (PowerShell)
```

## Integration Tests

**Tujuan:** menguji `artikel.upsert_automation_article` langsung di database,
tanpa Edge Function.

Seluruh suite berjalan dalam satu transaksi dan selalu `ROLLBACK` di akhir, jadi
aman dijalankan terhadap database berisi data. Tetap disarankan memakai database
sekali pakai.

**Cakupan:**

| Test | Yang diuji |
|---|---|
| 1 | Artikel baru + kategori baru + revisi pertama (`version=1`, `snapshot` terisi) |
| 2 | Upsert idempoten lewat `external_id`, revisi bertambah jadi `version=2` |
| 3 | Slug bentrok di site yang sama ditolak |
| 4 | Isolasi tenant: `external_id` sama di dua site tetap terpisah |
| 5 | Kategori dipakai ulang tanpa memandang kapitalisasi |
| 6 | Penulis tanpa peran aktif di site ditolak (termasuk peran `is_active=false`) |
| 7 | **Regresi:** `status='published'` langsung dari satu panggilan |
| 8 | **Regresi:** `featured_image` masuk ke kolom `featured_image_path`; `meta_keywords` tidak error |
| 9 | Site tidak dikenal atau nonaktif ditolak |
| 10 | Penegakan workflow tetap berlaku saat tidak ada aktor berwenang |

Test 7 dan 8 mengunci bug yang diperbaiki 28 September 2026. Jangan dihapus.

**Prasyarat migrasi.** Suite ini butuh dua migrasi berikut sudah diterapkan:

- `202609100014_create_upsert_automation_article_function.sql` (versi perbaikan)
- `202609280001_automation_article_actor.sql`

Tanpa yang kedua, Test 7 gagal dengan `New articles must start as draft`, karena
`artikel.validate_article_write` menurunkan identitas aktor dari `auth.uid()` yang
selalu NULL di jalur `service_role`.

**Jalankan:**

```bash
psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -f tests/integration/test_upsert_automation_article.sql
```

Terhadap Supabase self-hosted, `psql` ada di dalam container database:

```bash
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/integration/test_upsert_automation_article.sql
```

**Keluaran yang diharapkan:** setiap test mencetak `Test N: PASSED`, diakhiri
`=== All Integration Tests Completed (transaksi di-rollback) ===`. Assertion
memakai `ASSERT` di dalam blok `DO`, jadi kegagalan membuat `psql` keluar dengan
status bukan nol — bukan sekadar mencetak teks.

## E2E Tests

**Tujuan:** menguji alur penuh lewat Edge Function, termasuk autentikasi API key
dan validasi payload.

> ⚠️ Tes ini menulis artikel sungguhan ke site milik API key yang dipakai, dan
> tidak membersihkannya sendiri. **Jangan jalankan terhadap produksi.** Pakai site
> khusus tes. Semua `external_id` diberi prefix `e2e-<unix timestamp>` agar mudah
> dicari dan dihapus lewat CMS.

**Endpoint:** `POST|GET {SUPABASE_URL}/functions/v1/automation-api`
**Header autentikasi:** `x-api-key: ak_live_...`
**Body:** flat JSON (bukan envelope `{action, data}`).

**Cakupan:**

| Test | Yang diuji |
|---|---|
| 1 | `GET` memverifikasi API key dan mengembalikan identitas site |
| 2 | API key tidak dikenal ditolak `401` |
| 3 | Artikel baru dibuat (`created_new=true`) |
| 4 | Upsert idempoten: `external_id` sama memperbarui artikel yang sama |
| 5 | Field wajib hilang ditolak `400` (`title`, `slug`, `content`, `category_name`) |
| 6 | Status tidak dikenal ditolak `400` |
| 7 | Kategori dipakai ulang antar-artikel |

Test 1 bersifat gerbang: kalau gagal, sisa test tidak dijalankan.

Tidak ada tes rate limit. `consume_api_key_rate_limit` belum aktif di
`automation-api` yang ter-deploy; tes lama yang mengirim 125 request hanya
menciptakan 125 artikel sampah tanpa membuktikan apa pun. Tidak ada pula tes
"invalid slug format" — API memang tidak pernah memvalidasi bentuk slug.

**Prasyarat:**

```bash
export SUPABASE_URL="https://supabase.example.test"
export TEST_API_KEY="ak_live_..."
```

Bash membutuhkan `curl` dan `jq`.

**Jalankan (Bash):**

```bash
bash tests/e2e/test_automation_api.sh
```

**Jalankan (PowerShell):**

```powershell
.\tests\e2e\test_automation_api.ps1
```

Kedua skrip mencetak `PASS`/`FAIL` per test, menjalankan seluruh test sampai
selesai, lalu menutup dengan ringkasan `=== Ringkasan: N lulus, M gagal ===` dan
keluar dengan status 1 bila ada yang gagal.

## Menyiapkan Data Tes

### Site, user, dan peran

`artikel.sites.slug` bersifat `NOT NULL`; tidak ada kolom `theme_config`. Tabel
peran yang nyata adalah `artikel.user_roles` (`user_id`, `site_id`, `role`,
`is_active`); `site_id` NULL berarti admin global.

```sql
INSERT INTO artikel.sites (id, name, domain, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Site',
  'test.example.test',
  'test-site'
);

INSERT INTO auth.users (id, email)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'test@example.test'
);

INSERT INTO artikel.user_roles (user_id, site_id, role, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'admin',
  true
);
```

### API key

**Buat lewat aplikasi, bukan SQL.** Kolom `artikel.api_keys.secret_hash` berisi
SHA-256 dari `"<key mentah>:<ARTIKEL_API_KEY_PEPPER>"`. Pepper itu rahasia
runtime, tidak ada di repo, dan tidak bisa direproduksi dari SQL. Key yang
disisipkan manual tanpa pepper yang benar akan selalu ditolak `401`.

Lewat UI: **Pengaturan → API Keys**.

Lewat API (perlu sesi login CMS):

```bash
curl -X POST "$CMS_URL/api/cms/api-keys" \
  -H "Content-Type: application/json" \
  -H "Cookie: $CMS_SESSION_COOKIE" \
  -d '{"siteId":"00000000-0000-0000-0000-000000000001","label":"Test E2E"}'
```

Responsnya memuat `data.key` berawalan `ak_live_`. **Nilai mentah itu hanya
ditampilkan sekali**; simpan langsung ke `TEST_API_KEY`.

Yang bisa diperiksa lewat SQL hanyalah metadata, bukan nilai key:

```sql
SELECT id, label, key_prefix, expires_at, revoked_at, created_by
FROM artikel.api_keys
WHERE site_id = '00000000-0000-0000-0000-000000000001';
```

Key dianggap sah bila `revoked_at IS NULL` dan (`expires_at IS NULL` atau masih di
masa depan). Tidak ada kolom `is_active` pada tabel ini.

`created_by` menentukan penulis artikel yang dibuat lewat Automation API, dan user
itu **wajib** punya peran aktif di site tersebut — kalau tidak, RPC menolak dengan
`Author ... is not an active member of site ...`.

## Troubleshooting

**Integration test gagal:**

```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "\df artikel.upsert_automation_article"
```

```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "\df artikel.current_article_actor"
```

Kalau `current_article_actor` tidak ada, migrasi `202609280001` belum diterapkan
dan Test 7 akan gagal.

**E2E test gagal:**

```bash
curl -i -H "x-api-key: $TEST_API_KEY" "$SUPABASE_URL/functions/v1/automation-api"
```

- `500 {"error":"Automation API is not configured"}` → `ARTIKEL_API_KEY_PEPPER`
  tidak di-set di container `supabase-edge-functions`. Function gagal-aman; ini
  bukan auth bypass.
- `401 {"error":"Invalid or inactive API key"}` → key dicabut/kedaluwarsa, site
  nonaktif, atau `created_by` kosong.
- `500` pada `POST` padahal `GET` berhasil → periksa apakah migrasi
  `202609100014` versi perbaikan dan `202609280001` sudah diterapkan.

Log function:

```bash
docker logs --tail 100 supabase-edge-functions
```

## Yang Belum Tercakup

- Tes rate limit (belum aktif di function yang ter-deploy)
- Tes performa (k6/Artillery)
- Tes keamanan khusus (SQL injection, XSS) — sanitasi HTML diuji terpisah di
  `tests/unit/`
- Tes otorisasi route CMS (`/api/cms/**`) — direncanakan di Fase 5 plan remediasi

---

**Terakhir diperbarui:** 2026-09-28
