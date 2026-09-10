# SDD — CMS Artikel Multi-Website

**Status:** Updated — 10 September 2026

## Arsitektur
```text
CMS Browser → Next.js CMS → Supabase Auth/PostgreSQL schema artikel/Storage
                         → /api/v1 → Website klien
Automation Caller → Edge Function artikel-cms → PostgreSQL function artikel
```

## Tabel
- `artikel.sites`: `id`, `name`, `domain`, `slug`, `is_active`, timestamps.
- `artikel.user_roles`: `user_id`, `site_id`, `role` (`admin|editor|writer`).
- `artikel.categories`: `site_id`, `name`, `slug`, `description`, `is_active`; unique `(site_id, slug)`.
- `artikel.articles`: `site_id`, `category_id`, `author_id`, `reviewer_id`, `external_id`, `title`, `slug`, `excerpt`, `content`, image paths, status, SEO fields, workflow timestamps; unique `(site_id, slug)` and unique partial `(site_id, external_id)`.
- `artikel.tags` dan `artikel.article_tags`: tag reusable per website.
- `artikel.article_revisions`: snapshot `jsonb`, version, change note, actor.
- `artikel.review_comments`: komentar dan transisi status.
- `artikel.api_keys`: `site_id`, `key_prefix`, `secret_hash`, expiry, revoke, last use.
- `artikel.audit_logs`: actor, action, entity, metadata, timestamp.

## Workflow
```text
draft → in_review → revision_requested → in_review
in_review → approved → published → archived
approved → draft
archived → draft
```
Transition hanya lewat server/function tervalidasi. Writer tidak mendapat transition publish.

## Security
- RLS aktif pada semua tabel exposed.
- Helper role berdasarkan `auth.uid()` dan `site_id`.
- API hash key, resolve `site_id`, query hanya `published`, kategori aktif, tenant terkait.
- Service role hanya server-side.
- Edge Function memvalidasi `x-artikel-key` lalu memakai service role hanya di runtime server untuk menjalankan mutation tenant-scoped.
- Index: `(site_id, status, published_at DESC)`, `(site_id, slug)`, kategori/tag slug, API key prefix.

## Rute CMS
`/login`, `/dashboard`, `/sites`, `/sites/[siteId]/categories`, `/sites/[siteId]/articles`, `/sites/[siteId]/articles/new`, `/sites/[siteId]/api-keys`, `/settings/users`.

## API Automation

- Satu endpoint: `POST /functions/v1/artikel-cms`.
- Request memakai `action`, `request_id`, dan `data`; versi pertama hanya `article.upsert`.
- Database mutation harus melalui `artikel.upsert_automation_article(...)`, bukan insert berantai dari Edge Function.
- Endpoint tidak mengelola site, role, kategori, API key, atau permanent delete.
- Detail kontrak: `docs/UNIFIED-CMS-API-DESIGN.md`.

## Deployment
SSH `maskhar@20.20.20.173`, masuk `~/docker/supabase/supabase-1.26.05/docker`, inspeksi Compose aktif, lalu jalankan migration versioned schema `artikel`. Jangan ubah service, volume, secret, atau aplikasi lain.
