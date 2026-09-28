# RINGKASAN PEROMBAKAN API — 10 September 2026

## Keputusan Utama

### ✅ Dipertahankan
- CMS Admin UI dan routes `/api/cms/*` tetap memakai Next.js dengan Supabase Auth session
- Public Read API `/api/v1/articles*` tetap terpisah untuk website tenant
- API key per tenant dengan header `x-artikel-key`
- Rate limit, audit log, RLS, dan tenant isolation existing
- Docker deployment CMS di `~/apps/cms-artikel`

### 🆕 Ditambahkan
- Satu endpoint automation: `POST /functions/v1/artikel-cms`
- Field `external_id` nullable di `artikel.articles` untuk idempotency
- Action `article.upsert` sebagai fase pertama
- PostgreSQL function `artikel.upsert_automation_article` untuk atomic mutation
- Audit redaction untuk secret dan base64 media

### ❌ Dibatalkan
- Gagasan API tunggal menggantikan seluruh CMS
- `article.delete` melalui automation (permanent delete hanya CMS admin)
- Distribusi atau exposure `SUPABASE_SERVICE_ROLE_KEY` ke automation caller
- Hardcoded bearer token service_role seperti `blog-auto-post`

### ⏸️ Ditunda
- Action `article.publish`, `article.archive`, `article.get` (tunggu UAT `article.upsert`)
- Endpoint public kategori (evaluasi terpisah per tenant need)

## Dokumen Sumber Kebenaran

| Dokumen | Status | Fungsi |
| --- | --- | --- |
| `docs/UNIFIED-CMS-API-DESIGN.md` | ✅ Updated | Kontrak Edge Function automation lengkap |
| `docs/API-DECISIONS.md` | ✅ Baru | Tabel keputusan apa dipertahankan/dibatalkan/ditunda |
| `docs/PRD.md` | ✅ Updated | Requirement produk termasuk automation API |
| `docs/SDD.md` | ✅ Updated | Arsitektur database dan flow Edge Function |
| `docs/TODO.md` | ✅ Updated | Checklist fase 3 dengan migration dan UAT |
| `docs/API-INTEGRATION.md` | ✅ Updated | Panduan Public Read API (tetap berlaku) |
| `docs/API-DEPLOYMENT.md` | ✅ Updated | Deployment CMS dan API existing |
| `docs/DEPLOYMENT-TENANT-API.md` | ✅ Updated | Runbook tenant integration |

## Checklist Implementasi Berikutnya

### Database
- [ ] Migration `ALTER TABLE artikel.articles ADD COLUMN external_id TEXT`
- [ ] Index `CREATE UNIQUE INDEX ON artikel.articles (site_id, external_id) WHERE external_id IS NOT NULL`
- [ ] Function `artikel.upsert_automation_article(...)` dengan parameter tenant-scoped

### Edge Function
- [ ] File `supabase/functions/artikel-cms/index.ts`
- [ ] Validasi `x-artikel-key` memakai existing `artikel.api_keys`
- [ ] Rate limit memakai existing `artikel.consume_api_key_rate_limit`
- [ ] Action router untuk `article.upsert`
- [ ] Response envelope konsisten `{ success, request_id, data/error }`

### Testing
- [ ] Unit test idempotency `external_id` duplicate
- [ ] Integration test tenant isolation (key A tidak bisa tulis tenant B)
- [ ] E2E test retry automation dengan `request_id` sama
- [ ] Verifikasi audit log tidak simpan `x-artikel-key` atau base64 image

### UAT
- [ ] Deploy Edge Function ke staging
- [ ] Buat artikel automation dari satu tenant test
- [ ] Retry request sama dan verifikasi tidak buat artikel duplikat
- [ ] Validasi error `401`, `403`, `409`, `422`, `429`
- [ ] Smoke test production setelah UAT bersih

## Prinsip Arsitektur

1. **Separation of Concerns**: CMS admin, Public Read, dan Automation Write adalah tiga jalur berbeda dengan auth berbeda.
2. **Idempotency**: `external_id` + `request_id` memastikan retry aman tanpa duplikasi.
3. **Least Privilege**: Automation caller hanya dapat `x-artikel-key`; service role hanya environment Edge Function.
4. **Atomic Mutation**: Database function mencegah partial write kategori, slug, revision, dan audit.
5. **Audit Trail**: Setiap request automation tercatat tanpa mengekspos credential atau payload besar.

## Endpoint Comparison

| Jenis | Endpoint | Auth | Fungsi | Status |
| --- | --- | --- | --- | --- |
| CMS Admin | `/api/cms/*` | Session cookie | CRUD site, user, kategori, artikel, key | ✅ Tetap |
| Public Read | `/api/v1/articles*` | `x-artikel-key` | Website tenant baca artikel published | ✅ Tetap |
| Automation Write | `/functions/v1/artikel-cms` | `x-artikel-key` | Automation upsert artikel idempotent | 🆕 Implementasi |

## Alasan Perubahan

Sebelumnya ada confusion apakah automation API akan menggantikan seluruh CMS atau hanya melengkapi. Error berulang dan kompleksitas route Next.js menunjukkan perlu simplifikasi untuk automation use case. Edge Function dengan action tunggal lebih mudah dipanggil manual, retry aman, dan tenant-scoped by design.

CMS admin tetap membutuhkan UI kompleks dengan Auth session, role check, dan form validation. Public Read API tetap membutuhkan cache dan response cepat untuk website. Automation hanya butuh tulis artikel idempotent tanpa UI.

## Next Steps

1. Review summary ini dan konfirmasi alignment.
2. Buat migration branch dan test di local dev.
3. Deploy Edge Function ke staging Supabase.
4. UAT dengan satu tenant automation sebelum production rollout.
5. Dokumentasi final contoh integrasi automation caller.

---

Generated: 2026-09-10T16:38:26Z