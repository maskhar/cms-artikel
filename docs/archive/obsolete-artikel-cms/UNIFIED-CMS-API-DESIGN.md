# Rancangan API Automation Tunggal

**Status:** Disetujui untuk implementasi bertahap — 10 September 2026

## Tujuan

Sediakan satu endpoint Edge Function yang mudah dipanggil manual oleh automation. Endpoint ini membuat atau memperbarui artikel satu tenant dengan request konsisten dan retry aman.

```text
POST https://supabase.carubra.com/functions/v1/artikel-cms
```

Endpoint ini **bukan** pengganti CMS admin dan **bukan** pengganti Public Read API.

## Batasan

| Area | Keputusan |
| --- | --- |
| Automation tulis artikel | Pindah ke endpoint tunggal `artikel-cms`. |
| CMS admin | Tetap memakai Next.js `/api/cms/*` dan session Auth. |
| Website pembaca | Tetap memakai `GET /api/v1/articles*` dengan `X-Artikel-Key`. |
| Manajemen tenant, user, kategori, key | Tidak diekspos melalui Edge Function automation. |
| `service_role` | Hanya environment Edge Function. Tidak pernah dikirim caller. |

## Kontrak Request

Semua request memakai `POST`, `Content-Type: application/json`, dan `x-artikel-key`.

```json
{
  "action": "article.upsert",
  "request_id": "opsional-idempotency-key",
  "data": {
    "external_id": "workflow-run-123",
    "title": "Judul artikel",
    "content": "<p>Konten HTML</p>",
    "slug": "judul-artikel",
    "excerpt": "Ringkasan",
    "category_slug": "artikel",
    "status": "draft",
    "seo_title": "Judul SEO",
    "meta_description": "Deskripsi SEO"
  }
}
```

`external_id` wajib untuk `article.upsert`. Nilainya unik per tenant dan dipakai ulang ketika automation retry.

## Aksi Versi 1

| Action | Fungsi | Status |
| --- | --- | --- |
| `article.upsert` | Buat/perbarui draft dari `external_id`. | Implementasi pertama. |
| `article.publish` | Publish artikel existing setelah validasi workflow. | Fase berikutnya. |
| `article.archive` | Archive artikel existing. | Fase berikutnya. |
| `article.get` | Ambil artikel automation berdasarkan `external_id`. | Fase berikutnya. |

`article.delete` dibatalkan dari API automation. Penghapusan permanen tetap tindakan CMS admin dengan konfirmasi eksplisit.

## Response

```json
{
  "success": true,
  "request_id": "opsional-idempotency-key",
  "data": {
    "id": "uuid",
    "external_id": "workflow-run-123",
    "slug": "judul-artikel",
    "status": "draft",
    "created": true
  }
}
```

Kegagalan selalu memakai envelope yang sama:

```json
{
  "success": false,
  "request_id": "opsional-idempotency-key",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Field title wajib diisi.",
    "details": {}
  }
}
```

Status: `400` JSON rusak, `401` key salah, `403` tenant tidak aktif, `404` data tidak ada, `409` konflik slug/idempotency, `422` validasi payload, `429` rate limit, `500` kegagalan internal.

## Server Flow

1. Tolak selain `POST`; buat atau ambil `request_id`.
2. Validasi API key tenant, expiry, revoke, status tenant, dan rate limit.
3. Validasi `action` serta payload memakai schema action khusus.
4. Scope kategori, artikel, media, dan semua query ke `site_id` dari key.
5. Jalankan fungsi PostgreSQL atomik di schema `artikel`.
6. Simpan audit log tanpa key dan tanpa base64 media.
7. Kembalikan envelope JSON konsisten.

## Database

Tambahkan `external_id text` nullable ke `artikel.articles` dan unique partial index `(site_id, external_id) where external_id is not null`. Tambahkan fungsi `artikel.upsert_automation_article(...)` untuk menangani kategori, slug, workflow, dan revision secara atomik.

## Contoh Panggilan

```bash
curl -X POST 'https://supabase.carubra.com/functions/v1/artikel-cms' \
  -H 'Content-Type: application/json' \
  -H 'x-artikel-key: ak_live_xxx' \
  -d '{"action":"article.upsert","request_id":"run-123","data":{"external_id":"run-123","title":"Test","content":"<p>Test</p>","status":"draft"}}'
```

## Rollout

1. Migration `external_id` dan PostgreSQL function.
2. Edge Function `artikel-cms` dengan `article.upsert` saja.
3. Unit/integration test tenant isolation, retry, duplicate slug, dan audit redaction.
4. UAT satu tenant dan satu automation caller.
5. Tambah publish/archive/get setelah metrik dan audit bersih.

