# Dokumentasi CMS Artikel

Dokumen ini membagi dokumentasi menjadi dua kelompok: dokumen aktif untuk penggunaan dan deployment, serta dokumen referensi/arsip untuk konteks teknis.

## ⚠️ Status Automation API

`POST /functions/v1/automation-api` saat ini masih mengembalikan **500**. Dua penyebab, keduanya di produksi — bukan di dokumen:

1. `ARTIKEL_API_KEY_PEPPER` belum ter-set di container `functions` Supabase, jadi function gagal-aman: `500 {"error":"Automation API is not configured"}`.
2. RPC `artikel.upsert_automation_article` di produksi masih versi lama (merujuk tabel `artikel.site_users` yang tidak pernah dibuat, serta kolom `featured_image`/`meta_keywords` yang tidak ada).

Perbaikan untuk (2) sudah ada di file migrasi (`202609100014` versi baru + `202609280001_automation_article_actor.sql`) tetapi **belum diterapkan ke produksi**. Langkah penerapan keduanya ada di [`API-DEPLOYMENT.md`](API-DEPLOYMENT.md).

Kontrak request sudah benar dan tidak akan berubah setelah perbaikan; `GET` pada endpoint yang sama berfungsi normal. Public Read API `/api/v1/articles` tidak terdampak. Detail di [`API.md`](API.md).

## Sumber Kebenaran

Gunakan dokumen berikut sebagai kontrak aktif:

| Prioritas | Dokumen | Fungsi |
|---|---|---|
| 1 | [`API.md`](API.md) | Kontrak final Automation API dan Public Read API, termasuk image dan add-ons. **Satu-satunya dokumen yang terverifikasi cocok dengan kode.** |
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
