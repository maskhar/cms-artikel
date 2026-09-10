# Rancangan Gallery dan Article Add-ons

Tanggal rancangan: 10 September 2026

## Tujuan

Menambah konten modular ke artikel tanpa membuat tabel per website. Semua data tetap berada dalam schema PostgreSQL `artikel`, memakai `site_id`, RLS, dan public API yang hanya mengembalikan add-on milik artikel published.

## Fitur tahap awal

1. **Gallery** — koleksi media reusable dengan caption, alt text, urutan, dan cover.
2. **PDF Viewer** — menampilkan PDF inline dengan fallback tombol download.
3. **Image Slider** — carousel gambar dengan autoplay opsional, caption, dan navigasi.
4. **Video Embed** — YouTube/Vimeo atau URL video yang diizinkan.
5. **Call to Action** — judul, deskripsi, label tombol, URL, dan style.
6. **FAQ** — daftar pertanyaan dan jawaban terstruktur.
7. **Related Articles** — artikel terkait manual atau otomatis berdasarkan kategori/tag.
8. **Table of Contents** — dibuat dari heading artikel.
9. **Quote/Highlight Box** — kutipan atau informasi penting.
10. **File Download** — lampiran PDF/DOC/XLS/ZIP dengan metadata file.

Custom JavaScript tidak menjadi add-on karena meningkatkan risiko XSS. Integrasi khusus memakai tipe add-on terdaftar dan renderer yang tervalidasi.

## Skema Database

### `artikel.media_assets`

Media reusable per tenant.

```sql
create table artikel.media_assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references artikel.sites(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  width integer,
  height integer,
  alt_text text not null default '',
  caption text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, storage_path)
);
```

### `artikel.galleries`

```sql
create table artikel.galleries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references artikel.sites(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);
```

### `artikel.gallery_items`

```sql
create table artikel.gallery_items (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references artikel.galleries(id) on delete cascade,
  media_asset_id uuid not null references artikel.media_assets(id) on delete restrict,
  sort_order integer not null default 0,
  caption_override text,
  link_url text,
  created_at timestamptz not null default now(),
  unique (gallery_id, media_asset_id)
);
```

### `artikel.article_addons`

Satu tabel untuk menempatkan add-on pada artikel. Konfigurasi berbeda disimpan sebagai JSON tervalidasi di API.

```sql
create type artikel.article_addon_type as enum (
  'gallery', 'pdf_viewer', 'image_slider', 'video_embed',
  'call_to_action', 'faq', 'related_articles', 'table_of_contents',
  'highlight_box', 'file_download'
);

create table artikel.article_addons (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references artikel.sites(id) on delete cascade,
  article_id uuid not null references artikel.articles(id) on delete cascade,
  addon_type artikel.article_addon_type not null,
  placement text not null default 'after_content',
  sort_order integer not null default 0,
  title text not null default '',
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`placement`: `before_content`, `after_content`, atau anchor blok seperti `after_heading:heading-id`.

## Contoh Konfigurasi

```json
{
  "addon_type": "image_slider",
  "config": {
    "gallery_id": "uuid",
    "autoplay": true,
    "interval_ms": 5000,
    "show_caption": true,
    "aspect_ratio": "16:9"
  }
}
```

```json
{
  "addon_type": "pdf_viewer",
  "config": {
    "media_asset_id": "uuid",
    "height": 720,
    "show_download": true,
    "initial_page": 1
  }
}
```

## Cara Kerja CMS

1. Pengguna membuka menu **Gallery** untuk upload media dan membuat koleksi.
2. Upload memakai bucket `artikel-media`; metadata masuk ke `artikel.media_assets`.
3. Pada halaman buat/edit artikel terdapat panel **Add-ons**.
4. Pengguna memilih jenis add-on, mengisi konfigurasi, memilih placement, lalu mengurutkan dengan drag-and-drop.
5. API memvalidasi config menggunakan schema Zod khusus tiap tipe.
6. Preview CMS merender add-on memakai komponen yang sama dengan kontrak public API.
7. Add-on disimpan bersama draft, tetapi hanya tampil ke publik saat artikel berstatus `published`.

## Public API

Detail artikel ditambah field:

```json
{
  "data": {
    "title": "Judul",
    "content": "<p>...</p>",
    "addons": [
      {
        "type": "image_slider",
        "placement": "after_content",
        "sort_order": 0,
        "title": "Galeri acara",
        "config": {},
        "assets": []
      }
    ]
  }
}
```

API tidak mengirim storage path privat mentah. Server membuat URL publik/signed URL sesuai kebijakan bucket.

## RLS dan Akses

- RLS aktif pada `media_assets`, `galleries`, `gallery_items`, dan `article_addons`.
- Admin global dapat mengelola semua tenant.
- Admin/editor tenant dapat CRUD data dengan `site_id` sesuai role.
- Writer dapat menambah dan mengubah add-on pada artikel yang dapat dieditnya.
- Public API tetap menggunakan service role di server, lalu wajib memfilter `site_id`, status `published`, dan `is_active`.
- Trigger/constraint memastikan `article_addons.site_id` sama dengan `articles.site_id` dan gallery/media berasal dari tenant sama.

## Halaman dan Komponen

- `/gallery` — daftar gallery, search, bulk select, archive/delete.
- `/gallery/new` — buat gallery dan upload drag-and-drop.
- `/gallery/[galleryId]` — urutkan gambar, alt text, caption, cover.
- `ArticleAddonsPanel` — tambah, edit, hapus, duplicate, dan reorder add-on.
- `AddonPreview` — preview berdasarkan tipe.
- `MediaLibraryDialog` — pilih media yang sudah pernah diupload.

## Endpoint CMS

- `GET/POST /api/cms/media`
- `PATCH/DELETE /api/cms/media/{mediaId}`
- `GET/POST /api/cms/galleries`
- `GET/PATCH/DELETE /api/cms/galleries/{galleryId}`
- `POST /api/cms/galleries/{galleryId}/items`
- `PATCH /api/cms/galleries/{galleryId}/items/reorder`
- `GET/POST /api/cms/articles/{articleId}/addons`
- `PATCH/DELETE /api/cms/articles/{articleId}/addons/{addonId}`
- `PATCH /api/cms/articles/{articleId}/addons/reorder`

## Tahap Implementasi

1. Migration enum, tabel, index, trigger tenant consistency, dan RLS.
2. Media library dan Gallery CRUD.
3. Add-ons panel pada editor artikel.
4. Renderer PDF Viewer dan Image Slider.
5. Tambah tipe CTA, FAQ, related articles, TOC, highlight, dan download.
6. Perluas public API serta dokumentasi integrasi frontend.
7. Test RLS, cross-tenant access, config validation, upload, reorder, dan published visibility.
