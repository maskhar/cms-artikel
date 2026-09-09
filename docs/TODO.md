# TODO — CMS Artikel Multi-Website

## Fase 0 — Persiapan
- [ ] Setujui PRD dan SDD.
- [ ] Konfirmasi domain CMS/API dan package manager.
- [ ] Bootstrap Next.js TypeScript dan `.env.example`.
- [ ] Tetapkan strategi backup database/Storage.

## Fase 1 — Database
- [ ] SSH server; inspeksi Compose aktif.
- [ ] Buat migration schema `artikel`, enum, tabel, FK, constraints, indexes.
- [ ] Buat trigger timestamps, revision snapshot, status transition, helper role.
- [ ] Aktifkan RLS/policies dan grants schema.
- [ ] Buat bucket Storage dan policies.
- [ ] Uji isolasi tenant A/B.

## Fase 2 — CMS
- [ ] Konfigurasi Supabase SSR, Auth, route guard.
- [ ] Buat app shell responsif dan dashboard.
- [ ] Buat CRUD website, assignment user, kategori, tag.
- [ ] Buat form artikel, slug, Tiptap, media, SEO, preview.
- [ ] Implementasikan workflow review, approval, publish, archive.
- [ ] Implementasikan revisions, komentar, audit log.

## Fase 3 — API
- [ ] Generate, tampil sekali, revoke, rotate API key; simpan hash.
- [ ] Middleware `X-Artikel-Key`.
- [ ] Endpoint daftar kategori dan detail slug.
- [ ] Pagination, error schema, rate limit.
- [ ] Dokumentasi integrasi dan contoh `.env` website.

## Fase 4 — QA/Rilis
- [ ] Unit test slug, workflow, key.
- [ ] Integration test RLS/tenant isolation.
- [ ] E2E test writer submit, editor approve, API read.
- [ ] Lint, typecheck, test, build.
- [ ] Uji mobile 360 px dan aksesibilitas.
- [ ] Staging, UAT, production release.
