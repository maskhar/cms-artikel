# Dokumentasi CMS Artikel

Dokumen ini membagi dokumentasi menjadi dua kelompok: dokumen aktif untuk penggunaan dan deployment, serta dokumen referensi/arsip untuk konteks teknis.

## ✅ Status Automation API

`POST /functions/v1/automation-api` **berfungsi** sejak 28 September 2026. Ketiga blocker produksi sudah ditutup:

1. `ARTIKEL_API_KEY_PEPPER` ter-set di container `functions` Supabase (sebelumnya kosong, function gagal-aman dengan `500 "Automation API is not configured"`).
2. RPC `artikel.upsert_automation_article` diganti versi perbaikan, plus `202609280001_automation_article_actor.sql` diterapkan.
3. Edge Function membaca embed `sites!inner(...)` sebagai array padahal PostgREST mengembalikan objek untuk relasi to-one — setiap key sah ikut ditolak `401`. Sudah diperbaiki dan disalin ke server.

Diverifikasi end-to-end lewat HTTP nyata (`GET` 200, `POST` create, `POST` upsert, `400`, `401`, header `X-RateLimit-*` menurun) memakai key sementara yang langsung dicabut, plus suite integrasi SQL 10/10 lulus terhadap database produksi (transaksi di-rollback). Rate limit aktif 120 req/60 detik per key. Detail kontrak di [`API.md`](API.md); prosedur deployment di [`API-DEPLOYMENT.md`](API-DEPLOYMENT.md).

## Sumber Kebenaran

Gunakan dokumen berikut sebagai kontrak aktif:

| Prioritas | Dokumen | Fungsi |
|---|---|---|
| 1 | [`API.md`](API.md) | Kontrak final Automation API dan Public Read API, termasuk image dan add-ons. **Satu-satunya dokumen yang terverifikasi cocok dengan kode.** |
| 1 | [`API-EXTERNAL.md`](API-EXTERNAL.md) | **Berkas untuk dikirim keluar.** Kontrak mandiri kedua API, ditulis untuk dibaca AI coding agent di repo project konsumen — salin ke sana sebagai `AGENTS.md` atau `API.md`. Tidak memuat rujukan internal, tidak memuat rahasia. |
| 2 | [`STORAGE-STRUCTURE.md`](STORAGE-STRUCTURE.md) | Aturan path storage untuk artikel, gambar, dan file. |
| 3 | [`PANDUAN-PENGGUNAAN.md`](PANDUAN-PENGGUNAAN.md) | Panduan CMS untuk admin, editor, writer, dan developer tenant. |

Jika dokumen lain berbeda dengan `API.md`, ikuti `API.md` dan update dokumen lama sebelum dipakai sebagai referensi.

### Dokumen dengan akurasi sebagian

Endpoint dan header benar, tetapi sebagian field request masih salah. Verifikasi terhadap `API.md` sebelum dipakai:

- [`API-INTEGRATION.md`](API-INTEGRATION.md) dan [`DEPLOYMENT-TENANT-API.md`](DEPLOYMENT-TENANT-API.md) — keliru menyatakan `page` dan `limit` wajib; keduanya opsional (default `page=1`, `limit=10`).

`AUTOMATION-API-USAGE.md` dan `API-DEPLOYMENT.md` sudah disamakan dengan kontrak nyata pada 28 September 2026 dan tidak lagi masuk daftar ini.

### Contoh client

[`../examples/`](../examples/) berisi client Node.js, Python, dan PHP yang sudah disesuaikan dengan kontrak nyata (`automation-api`, header `x-api-key`, body flat).

## Arsitektur dan Keputusan

- [`API-DECISIONS.md`](API-DECISIONS.md) — keputusan endpoint dan batas tanggung jawab API.
- [`API-INTEGRATION.md`](API-INTEGRATION.md) — pola integrasi Public Read API.
- [`GALLERY-ADDONS-DESIGN.md`](GALLERY-ADDONS-DESIGN.md) — desain gallery dan add-ons.
- [`PRD.md`](PRD.md) — kebutuhan produk.
- [`SDD.md`](SDD.md) — keputusan desain sistem.

## Operasional

- [`UAT-RELEASE-CHECKLIST.md`](UAT-RELEASE-CHECKLIST.md) — checklist UAT dan release.
- [`DOCKER-WHITELABEL-CMS.md`](DOCKER-WHITELABEL-CMS.md) — catatan deployment Docker white-label.
- [`DEPLOYMENT-CMS.md`](DEPLOYMENT-CMS.md) — operasional container CMS production.
- [`TODO.md`](TODO.md) — pekerjaan terbuka.

## Arsip

- [`archive/reports/`](archive/reports/) — laporan deployment, completion, dan sesi lama.
- [`archive/notes/`](archive/notes/) — handoff, quickstart, dan catatan implementasi lama.
- [`archive/obsolete-artikel-cms/`](archive/obsolete-artikel-cms/) — dokumen Edge Function `artikel-cms` yang sudah dipensiunkan. Jangan dipakai sebagai referensi integrasi; lihat README di dalamnya.

Arsip tidak menjadi kontrak API dan tidak dipakai sebagai instruksi deployment baru.

## Deployment Server

Supabase self-hosted memakai server `maskhar@20.20.20.173` dan direktori:

```text
~/docker/supabase/supabase-1.26.05/docker
```

Sebelum perubahan infrastructure, inspeksi konfigurasi Docker Compose dan pertahankan service, volume, environment, secret, serta aplikasi lain yang sudah berjalan.

## Skrip Operasional

- [`../scripts/deploy.ps1`](../scripts/deploy.ps1) — sinkronisasi dan deploy container CMS.
- [`../scripts/test-edge-function.ps1`](../scripts/test-edge-function.ps1) — smoke test Edge Function Automation API. Butuh `SUPABASE_URL` dan `TEST_API_KEY` di environment. Default hanya `GET` (verifikasi key, tidak menulis apa pun); tambahkan `-Post` untuk menguji penulisan artikel — jangan dijalankan terhadap produksi.

## SQL Manual

[`../supabase/manual/`](../supabase/manual/) menyimpan SQL hotfix yang pernah dijalankan manual. File di sana bukan migrasi dan tidak boleh dijalankan ulang otomatis.
