# PRD — CMS Artikel Multi-Website

**Status:** Draft — 10 September 2026

## Ringkasan
CMS responsif untuk membuat, meninjau, menyetujui, menerbitkan, dan menyajikan artikel/blog ke banyak website melalui Supabase self-hosted. Semua data berada di schema PostgreSQL `artikel`.

## Keputusan utama
- Satu database, satu schema `artikel`, tabel bersama.
- Website menjadi tenant melalui `artikel.sites` dan `site_id`.
- Kategori tidak membuat tabel baru.
- API key terikat pada website dan API hanya mengembalikan artikel `published` milik website tersebut.
- Stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Tiptap, Supabase Auth/Storage.

## Role
- `admin`: semua website, user, kategori, key, artikel.
- `editor`: review, minta revisi, approve, publish pada website tugas.
- `writer`: buat/edit artikel sendiri dan submit review; tidak boleh publish.

## Fitur MVP
- CRUD website, kategori, tag, user assignment, API key.
- Artikel: judul, slug unik per website, excerpt, rich text, gambar, SEO title, meta description, canonical, robots, Open Graph, tag.
- Workflow: `draft` → `in_review` → `revision_requested`/`approved` → `published` → `archived`.
- Revision history, komentar review, audit log.
- API:
  - `GET /api/v1/articles?category={slug}&page=1&limit=10`
  - `GET /api/v1/articles/{slug}`
- API key lewat header `X-Artikel-Key`, bukan parameter domain yang dipercaya.

## Non-functional
- Responsive minimum 360 px.
- RLS dan tenant isolation wajib.
- API key tidak disimpan plaintext.
- Rate limit dan validasi input.
- Target p95 daftar artikel < 500 ms pada data terindeks.

## Tidak termasuk MVP
Database/schema/tabel per website, multi-bahasa, real-time collaboration, A/B testing, newsletter, analytics.
