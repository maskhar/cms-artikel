# TODO — CMS Artikel Multi-Website

**Diperbarui:** 10 September 2026

## Fase 0 — Persiapan
- [x] Setujui PRD dan SDD.
- [x] Pilih Next.js TypeScript dan `pnpm`.
- [x] Bootstrap aplikasi dan `.env.example`.
- [x] Hubungkan `.env` lokal ke Supabase self-hosted.
- [ ] Konfirmasi domain CMS dan domain API production.
- [ ] Tetapkan strategi backup database dan Storage.

## Fase 1 — Database
- [x] SSH server dan inspeksi Compose aktif.
- [x] Buat schema `artikel`, enum, tabel, FK, constraints, dan indexes.
- [x] Buat trigger `updated_at`, status transition, dan validasi kategori tenant.
- [x] Buat helper role global/per-website.
- [x] Aktifkan RLS, policies, grants, dan PostgREST schema.
- [x] Seed `dev@gmail.com` sebagai admin global.
- [x] Buat revision snapshot otomatis.
- [ ] Terapkan bucket Storage dan media policies ke staging/production.
- [ ] Uji isolasi tenant A/B secara otomatis.

## Fase 2 — CMS
- [x] Konfigurasi Supabase SSR, Auth, login, callback, dan route guard.
- [x] Buat dashboard dan sidebar responsif.
- [x] Buat website tenant dan kategori.
- [x] Buat form/list/edit artikel, slug, SEO title, dan meta description.
- [x] Implementasikan submit review, request revision, approval, publish, archive, dan reopen.
- [x] Pertahankan timestamp workflow tanpa menghapus histori lama.
- [x] Buat CRUD tag.
- [x] Buat assignment user dengan role admin/editor/writer.
- [x] Integrasikan Tiptap rich-text editor.
- [x] Tambah upload featured image dan Open Graph image.
- [x] Tambah SEO preview.
- [x] Tambah revision history dan komentar review UI.
- [x] Tambah audit log UI.
- [x] Batasi tombol workflow berdasarkan role dan status aktif.

## Fase 3 — API
- [x] Generate, tampil sekali, revoke API key, dan simpan hash.
- [x] Tambah rotasi dan expiry API key.
- [x] Validasi `X-Artikel-Key`.
- [x] Endpoint daftar artikel berdasarkan kategori dan detail berdasarkan slug.
- [x] Pagination dasar dan error response standar.
- [x] Tambah rate limit per API key.
- [x] Tambah dokumentasi integrasi dan contoh pemakaian website.

## Fase 4 — QA/Rilis
- [x] Unit test slug, workflow timestamp, transition, dan API key.
- [ ] Integration test RLS dan tenant isolation.
- [ ] E2E test writer submit, editor approve, publish, dan API read.
- [x] Jalankan lint, typecheck, dan production build selama pengembangan.
- [ ] Uji mobile 360 px dan aksesibilitas.
- [ ] Deploy staging, UAT, lalu production.
