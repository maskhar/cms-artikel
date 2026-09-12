# Dokumentasi CMS Artikel

Dokumen ini membagi dokumentasi menjadi dua kelompok: dokumen aktif untuk penggunaan dan deployment, serta dokumen referensi/arsip untuk konteks teknis.

## Sumber Kebenaran

Gunakan dokumen berikut sebagai kontrak aktif:

| Prioritas | Dokumen | Fungsi |
|---|---|---|
| 1 | [`API.md`](API.md) | Kontrak final Automation API dan Public Read API, termasuk image dan add-ons. |
| 2 | [`AUTOMATION-API-USAGE.md`](AUTOMATION-API-USAGE.md) | Contoh integrasi Automation API dari project eksternal. |
| 3 | [`API-DEPLOYMENT.md`](API-DEPLOYMENT.md) | Deployment API, environment, migration, dan smoke test. |
| 4 | [`DEPLOYMENT-AUTOMATION-API.md`](DEPLOYMENT-AUTOMATION-API.md) | Runbook deployment Edge Function Automation API. |
| 5 | [`STORAGE-STRUCTURE.md`](STORAGE-STRUCTURE.md) | Aturan path storage untuk artikel, gambar, dan file. |
| 6 | [`PANDUAN-PENGGUNAAN.md`](PANDUAN-PENGGUNAAN.md) | Panduan CMS untuk admin, editor, writer, dan developer tenant. |

Jika dokumen lain berbeda dengan `API.md`, ikuti `API.md` dan update dokumen lama sebelum dipakai sebagai referensi.

## Arsitektur dan Keputusan

- [`UNIFIED-CMS-API-DESIGN.md`](UNIFIED-CMS-API-DESIGN.md) — desain arsitektur Automation API.
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
- [`QUICK-REFERENCE-AUTOMATION-API.md`](QUICK-REFERENCE-AUTOMATION-API.md) — ringkasan cepat; gunakan `API.md` jika ada perbedaan.

## Arsip

- [`archive/reports/`](archive/reports/) — laporan deployment, completion, dan sesi lama.
- [`archive/notes/`](archive/notes/) — handoff, quickstart, dan catatan implementasi lama.

Arsip tidak menjadi kontrak API dan tidak dipakai sebagai instruksi deployment baru.

## Deployment Server

Supabase self-hosted memakai server `maskhar@20.20.20.173` dan direktori:

```text
~/docker/supabase/supabase-1.26.05/docker
```

Sebelum perubahan infrastructure, inspeksi konfigurasi Docker Compose dan pertahankan service, volume, environment, secret, serta aplikasi lain yang sudah berjalan.

## Skrip Operasional

- [`../scripts/deploy.ps1`](../scripts/deploy.ps1) — sinkronisasi dan deploy container CMS.
- [`../scripts/test-edge-function.ps1`](../scripts/test-edge-function.ps1) — smoke test Edge Function Automation API.

## SQL Manual

[`../supabase/manual/`](../supabase/manual/) menyimpan SQL hotfix yang pernah dijalankan manual. File di sana bukan migrasi dan tidak boleh dijalankan ulang otomatis.
