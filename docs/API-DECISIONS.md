# Keputusan Dokumentasi API

**Tanggal:** 10 September 2026

| Item lama | Keputusan | Pengganti/alasan |
| --- | --- | --- |
| Gagasan satu API menggantikan seluruh CMS | Dibatalkan | CMS admin perlu Auth/RLS dan tetap memakai `/api/cms/*`. |
| Public Read API `/api/v1/*` | Dipertahankan | Website tenant tetap membutuhkan read-only API ber-cache. |
| `blog-auto-post` memakai service-role bearer dari caller | Tidak ditiru | `artikel-cms` memakai `x-artikel-key`; service role hanya secret runtime function. |
| Automation multi-endpoint | Diubah | Satu endpoint `POST /functions/v1/artikel-cms` dengan field `action`. |
| `article.delete` automation | Dihilangkan | Permanent delete hanya CMS admin, menghindari penghapusan automation tidak sengaja. |
| Action publish/archive/get | Ditunda | Dibangun setelah `article.upsert` idempotent lolos UAT. |
| Hardcoded kategori pada website | Tetap tidak direkomendasikan | Ikuti `docs/API-INTEGRATION.md`; endpoint kategori publik dinilai terpisah. |

Dokumen sumber keputusan teknis: `docs/UNIFIED-CMS-API-DESIGN.md`.
