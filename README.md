# CMS Artikel Multi-Tenant

[![Production](https://img.shields.io/badge/production-live-brightgreen)](https://cms.carubra.com)
[![Tests](https://img.shields.io/badge/tests-32%2F32%20passed-brightgreen)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)]()

Platform multi-tenant untuk membuat, mereview, menyetujui, dan menerbitkan artikel/blog ke banyak website dari satu dashboard terpusat.

**Production:** https://cms.carubra.com  
**Repository:** https://github.com/maskhar/cms-artikel

---

## 🎯 Fitur Utama

- ✅ **Multi-tenant** — Kelola artikel untuk banyak website dalam satu CMS
- ✅ **Publikasi Global** — Admin global dapat menayangkan satu artikel ke semua website aktif dan website baru
- ✅ **Role-based Access** — Admin, Editor, Writer dengan permission berbeda
- ✅ **Workflow Artikel** — Draft → Review → Approved → Published
- ✅ **Rich Text Editor** — Tiptap dengan gambar, heading, list, alignment
- ✅ **SEO Optimization** — Title, meta description, Open Graph, canonical URL
- ✅ **Public Read API** — Website konsumen ambil artikel via REST API
- ✅ **Revision History** — Snapshot otomatis setiap perubahan artikel
- ✅ **Audit Log** — Track semua aktivitas user
- ✅ **Rate Limiting** — 120 req/60s per API key
- ✅ **Multi-Domain CMS** — Tenant akses CMS dari domain sendiri

---

## 📖 Dokumentasi

### Untuk Pengguna (Non-Technical)

**[Panduan Penggunaan](docs/PANDUAN-PENGGUNAAN.md)** — Panduan lengkap cara pakai CMS untuk:
- Admin: setup website, user, kategori, API key
- Editor: review, approve, publish artikel
- Writer: buat artikel, submit review, perbaiki revisi
- Developer Website: integrasikan Public API ke website tenant

### Untuk Developer

| Dokumen | Deskripsi |
|---------|-----------|
| [docs/README.md](docs/README.md) | Indeks dokumentasi aktif, referensi, dan arsip |
| [API.md](docs/API.md) | Kontrak final Automation API dan Public Read API (sumber kebenaran) |
| [PRD.md](docs/PRD.md) | Product Requirements Document |
| [SDD.md](docs/SDD.md) | System Design Document |
| [TODO.md](docs/TODO.md) | Development checklist & roadmap |
| [API-INTEGRATION.md](docs/API-INTEGRATION.md) | Panduan integrasi Public Read API |
| [DEPLOYMENT-TENANT-API.md](docs/DEPLOYMENT-TENANT-API.md) | Deployment runbook lengkap |
| [DEPLOYMENT-CMS.md](docs/DEPLOYMENT-CMS.md) | Operasional container CMS production |

---

## 🚀 Quick Start

### Login CMS

```
URL: https://cms.carubra.com/login
Email: admin@example.com
Password: (dari tim DevOps)
```

### Public API Example

```bash
# Daftar artikel
curl -H "X-Artikel-Key: ak_live_xxx" \
  "https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=10"

# Detail artikel
curl -H "X-Artikel-Key: ak_live_xxx" \
  "https://cms.carubra.com/api/v1/articles/judul-artikel"
```

### Publikasi ke Semua Website

Pada form artikel baru, admin global dapat mencentang **Tayangkan ke semua website aktif**. CMS menyimpan website yang dipilih sebagai website sumber untuk kategori, tag, dan media. Saat artikel berstatus `published`, artikel didistribusikan ke seluruh website aktif.

Website baru otomatis menerima artikel dengan `publish_scope = all_active_sites`. Kategori sumber dibuat pada website target jika slug kategori belum tersedia. API key website tetap hanya dapat membaca distribusi milik website tersebut.

Payload CMS API:

```json
{
  "siteId": "uuid-website-sumber",
  "categoryId": "uuid-kategori-sumber",
  "publishScope": "all_active_sites",
  "title": "Judul Artikel",
  "slug": "judul-artikel",
  "content": "<p>Konten artikel</p>"
}
```

`publishScope` menerima `selected_sites` atau `all_active_sites`. Jika tidak dikirim, nilainya `selected_sites`. Nilai `all_active_sites` hanya dapat digunakan admin global.

### API Response

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Judul Artikel",
      "slug": "judul-artikel",
      "excerpt": "Ringkasan artikel...",
      "content": "<p>Konten HTML...</p>",
      "featured_image_path": "site-id/article-id/image.webp",
      "seo_title": "Judul SEO",
      "meta_description": "Deskripsi SEO",
      "published_at": "2026-09-10T10:00:00Z",
      "categories": [{"name": "Teknologi", "slug": "teknologi"}],
      "article_tags": [{"tags": {"name": "AI", "slug": "ai"}}]
    }
  ],
  "meta": {"page": 1, "limit": 10, "total": 42}
}
```

---

## 🏗️ Tech Stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Rich Text:** Tiptap (ProseMirror)
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (Supabase self-hosted)
- **Auth:** Supabase Auth (cookie-based session)
- **Storage:** Supabase Storage (artikel-media bucket)
- **Schema:** `artikel` (tenant isolation via RLS)
- **Testing:** Vitest (32 tests passing)
- **Deployment:** Docker (cms.carubra.com:3002)

---

## 📊 Database Schema

```
artikel.sites              # Website tenant
artikel.user_roles         # User assignment per website
artikel.categories         # Kategori per website
artikel.articles           # Artikel dengan workflow
artikel.article_sites      # Distribusi dan status artikel per website
artikel.tags               # Tag reusable per website
artikel.article_tags       # Many-to-many artikel-tag
artikel.article_revisions  # Snapshot setiap perubahan
artikel.review_comments    # Komentar review workflow
artikel.api_keys           # API key per website
artikel.audit_logs         # Track semua aktivitas
artikel.article_addons     # Gallery, PDF viewer, etc (new)
artikel.galleries          # Gallery media (new)
artikel.media_assets       # Media library (new)
```

**RLS:** Aktif pada semua tabel exposed  
**Indexes:** Optimized untuk `(site_id, status, published_at DESC)`

---

## 🔐 Security

- ✅ Row-Level Security (RLS) pada semua tabel
- ✅ API key hashed (SHA-256), tidak disimpan plaintext
- ✅ Rate limiting per API key (120 req/60s)
- ✅ CORS configured untuk CMS domain
- ✅ Service role hanya server-side, tidak exposed ke client
- ✅ Input validation dengan Zod
- ✅ SQL injection prevention via parameterized queries
- ✅ Audit log untuk compliance

---

## 🧪 Testing

```bash
# Run tests
pnpm test

# Results
✓ src/lib/slug.test.ts (4 tests)
✓ src/lib/cms-hostname.test.ts (4 tests) 
✓ src/lib/api-key.test.ts (12 tests)
✓ src/lib/article-workflow.test.ts (12 tests)

Test Files  4 passed (4)
Tests  32 passed (32)
Duration  1.03s
```

---

## 🚢 Deployment

### Production

Aplikasi dan database ada di **dua mesin berbeda**:

```
Aplikasi   : workstation lokal (repo ini)   → cms-artikel:3002 → cms.carubra.com
Database   : maskhar@20.20.20.173           → supabase-db      → supabase.carubra.com
```

`cms.carubra.com` dilayani container `cms-artikel` **di workstation**, lewat
`cloudflared-tunnel` yang berbagi network `carubra-network`. Server
`20.20.20.173` hanya menjalankan Supabase.

> ⚠️ Kedua mesin sama-sama punya container `cms-artikel` di `127.0.0.1:3002`.
> Yang di server **tidak menerima trafik** — sisa deploy salah sasaran
> 28 September 2026. Verifikasi status produksi hanya sah lewat
> `https://cms.carubra.com`; probe localhost tidak bisa membedakan keduanya.
> Lihat `docs/DEPLOYMENT-CMS.md`.

### Deploy Script

Dijalankan **di workstation**, bukan lewat SSH:

```bash
pwsh scripts/deploy.ps1
```

Skrip itu menandai image rollback, build, memeriksa matcher middleware di dalam
image, menukar container, lalu memverifikasi gerbang auth lewat domain publik —
dan gagal keras kalau ada yang tidak 307/200 sesuai harapan.

Manual:

```bash
docker tag cms-artikel-cms-artikel cms-artikel-cms-artikel:rollback-$(date +%F)
docker compose build
docker compose up -d
docker compose logs -f cms-artikel
```

### Database Migration

```bash
# SSH ke server Supabase
ssh maskhar@20.20.20.173

# Masuk ke Supabase Docker
cd ~/docker/supabase/supabase-1.26.05/docker

# Apply migration
docker compose exec -T db psql -U postgres -d postgres \
  -f /path/to/migration.sql

# Reload PostgREST schema
docker compose exec -T db psql -U postgres -d postgres \
  -c "notify pgrst, 'reload schema';"
```

---

## 🛣️ Roadmap

### ✅ Completed (MVP)

- [x] Multi-tenant architecture
- [x] Role-based access control
- [x] Article workflow (draft → published)
- [x] Rich text editor with media upload
- [x] SEO fields and preview
- [x] Public Read API with rate limiting
- [x] Revision history
- [x] Audit log
- [x] Gallery and add-ons system
- [x] API key rotation

### 🚧 In Progress

- [x] Edge Function Automation API (`automation-api`) — `GET` (verifikasi key) berfungsi
- [ ] `POST /functions/v1/automation-api` — masih 500, lihat catatan di bawah
- [ ] PostgreSQL function `artikel.upsert_automation_article` — rujuk tabel `artikel.site_users` yang tidak ada serta kolom `featured_image`/`meta_keywords` yang tidak ada; kontrak request sudah benar dan tidak berubah setelah perbaikan. Detail: [`docs/API.md`](docs/API.md)

Edge Function `artikel-cms` sudah dipensiunkan dan tidak pernah ter-deploy; dokumennya dipindah ke [`docs/archive/obsolete-artikel-cms/`](docs/archive/obsolete-artikel-cms/).

### 📋 Planned

- [ ] Action `article.publish`, `article.archive`, `article.get`
- [ ] Public kategori endpoint
- [ ] Scheduled publish
- [ ] Media library UI
- [ ] Bulk operations improvement
- [ ] Export audit log CSV
- [ ] Multi-language support
- [ ] Real-time collaboration

---

## 🤝 Contributing

Repository ini internal untuk development CMS Artikel. Untuk kontribusi:

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

**Coding Guidelines:**
- Follow existing code style (ESLint + Prettier)
- Write tests untuk fitur baru
- Update dokumentasi jika perlu
- Commit message format: `type: description` (conventional commits)

---

## 📄 License

Internal project — proprietary license.  
© 2026 Carubra Digital Solutions

---

## 📞 Support

**DevOps Contact:**
- SSH: `maskhar@20.20.20.173` — **khusus Supabase**, aplikasi tidak ada di sini
- Supabase: `~/docker/supabase/supabase-1.26.05/docker`
- CMS: berjalan di workstation; deploy `pwsh scripts/deploy.ps1`

**Dokumentasi:**
- [Panduan Lengkap](docs/PANDUAN-PENGGUNAAN.md)
- [API Integration](docs/API-INTEGRATION.md)
- [Deployment Runbook](docs/DEPLOYMENT-TENANT-API.md)

**Latest Updates:**
- 2026-09-10: Error fixes production, API automation design approved
- 2026-09-10: Gallery add-ons migration applied
- 2026-09-10: Comprehensive documentation update

---

**Built with ❤️ by Carubra DevOps Team**
