# Keputusan Dokumentasi API

**Tanggal:** 10 September 2026

> ⚠️ **Catatan historis, bukan acuan integrasi.** Keputusan di bawah menyebut
> endpoint `POST /functions/v1/artikel-cms`, yang sesudahnya dipensiunkan dan
> tidak pernah ter-deploy. Yang berlaku sekarang `automation-api`; kontraknya
> di [`docs/API.md`](API.md).

| Item lama | Keputusan | Pengganti/alasan |
| --- | --- | --- |
| Gagasan satu API menggantikan seluruh CMS | Dibatalkan | CMS admin perlu Auth/RLS dan tetap memakai `/api/cms/*`. |
| Public Read API `/api/v1/*` | Dipertahankan | Website tenant tetap membutuhkan read-only API ber-cache. |
| `blog-auto-post` memakai service-role bearer dari caller | Tidak ditiru | `artikel-cms` memakai `x-artikel-key`; service role hanya secret runtime function. |
| Automation multi-endpoint | Diubah | Satu endpoint `POST /functions/v1/artikel-cms` dengan field `action`. |
| `article.delete` automation | Dihilangkan | Permanent delete hanya CMS admin, menghindari penghapusan automation tidak sengaja. |
| Action publish/archive/get | Ditunda | Dibangun setelah `article.upsert` idempotent lolos UAT. |
| Hardcoded kategori pada website | Tetap tidak direkomendasikan | Ikuti `docs/API-INTEGRATION.md`; endpoint kategori publik dinilai terpisah. |

Dokumen sumber keputusan teknis: `docs/archive/obsolete-artikel-cms/UNIFIED-CMS-API-DESIGN.md` (diarsipkan). Kontrak yang berlaku ada di `docs/API.md`.
