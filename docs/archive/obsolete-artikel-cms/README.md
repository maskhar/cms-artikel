# Arsip: dokumen Edge Function `artikel-cms` (SUDAH TIDAK BERLAKU)

**Jangan pakai dokumen di folder ini sebagai referensi integrasi.** Semuanya menjelaskan Edge Function `artikel-cms` yang tidak pernah ter-deploy ke produksi dan sudah dipensiunkan.

Diarsipkan pada **28 September 2026** setelah audit akurasi dokumentasi API.

## Kenapa diarsipkan, bukan ditambal

Dokumen-dokumen ini bukan salah di detail kecil. Kontrak transport-nya berbeda total dari endpoint yang benar-benar hidup:

| Aspek | Dokumen di folder ini (`artikel-cms`) | Yang nyata (`automation-api`) |
|---|---|---|
| Path | `/functions/v1/artikel-cms` | `/functions/v1/automation-api` |
| Header auth | `x-artikel-key` | `x-api-key` |
| Bentuk body | envelope `{ action, data }` | flat |
| Bentuk error | bersarang `{ error: { message, code, timestamp } }` | flat `{ error: "..." }` |
| Field kategori | `category` | `category_name` |
| Prefix API key | `<uuid>` / `aut_live_` | `ak_live_` |
| Rate limit | 429 + kode error | belum ada di produksi |

Menambal berarti menulis ulang hampir setiap baris. Lebih jujur menandainya mati.

Tambahan: SQL pembuatan API key di dokumen-dokumen ini **tidak bisa dieksekusi**. SQL tersebut memakai kolom `user_id`, `name`, `key_hash`, `is_active` yang tidak ada pada `artikel.api_keys`. Kolom nyata: `label`, `key_prefix`, `secret_hash`, `revoked_at`, `created_by`. Hash-nya juga tanpa pepper sehingga tidak akan pernah cocok.

## Pakai apa sebagai gantinya

- **[`../../API.md`](../../API.md)** — satu-satunya dokumen kontrak yang terverifikasi cocok dengan kode.
- Halaman **API Docs** di dalam CMS (`/api-docs`) untuk contoh integrasi siap pakai.

Perhatikan peringatan status di kedua tempat tersebut: `POST` Automation API saat ini masih mengembalikan 500 karena bug di fungsi database, terlepas dari dokumen mana yang Anda ikuti.

## Isi folder

| File | Catatan |
|---|---|
| `API-DOCUMENTATION-COMPLETE.md` | 877 baris; tidak ada satu pun contoh yang jalan terhadap produksi. Juga memuat form HTML statis yang menerima API key di sisi browser — pola berbahaya, jangan ditiru. |
| `DEPLOYMENT-AUTOMATION-API.md` | Bekas runbook resmi. Men-deploy function yang salah, SQL key tidak eksekusi, dan tidak pernah menyebut `ARTIKEL_API_KEY_PEPPER`. |
| `QUICK-REFERENCE-AUTOMATION-API.md` | Ringkasan cepat untuk endpoint yang salah. |
| `AUTOMATION-API-SUMMARY.md` | Menyatakan migrasi RLS berhasil; migrasi tersebut justru gagal saat apply. |
| `SUMMARY-API-REWORK.md` | Aspirasional. Rate limit dan envelope `{success, request_id, data}` tidak pernah dibangun. |
| `UNIFIED-CMS-API-DESIGN.md` | Desain arsitektur. Idempotency `request_id` tidak pernah diimplementasikan. |

Dokumen di sini disimpan untuk jejak historis, bukan sebagai kontrak.
