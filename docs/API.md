# Automation API Artikel

Dokumentasi diperbarui **12 September 2026, 03:46 ICT (UTC+7)** berdasarkan kode repository. Waktu ini menandai revisi dokumentasi, bukan deployment semua endpoint. Versi Edge Function di server belum diverifikasi ulang pada revisi ini.

## Riwayat perubahan API

### 12 September 2026, 03:46 ICT — revisi dokumentasi

- Rotasi API key mengganti secret pada record yang sama; tidak membuat record duplikat.
- `DELETE /api/cms/api-keys/{keyId}` menghapus API key secara permanen.
- `POST /api/cms/articles/bulk` mengembalikan `409` jika tidak ada artikel yang berubah dan mengisi `published_at` saat status menjadi `published`.
- Pustaka media menjadi global untuk akun CMS aktif. Upload artikel dan add-on otomatis tercatat di `artikel.media_assets`.
- Upload media baru mempertahankan nama file asli pada akhir storage path. Folder UUID hanya mencegah bentrok nama.
- Kontrak Automation API dikoreksi agar hanya menampilkan field yang benar-benar diproses Edge Function.

## Endpoint final
## CMS API internal: key, media, dan bulk status

Endpoint `/api/cms/*` memakai sesi login CMS dan RLS, bukan header API key publik/otomasi. Contoh fetch berikut dijalankan dari CMS yang sudah login. Jangan menggunakannya sebagai endpoint push eksternal.

### API key

| Method / path | Perilaku |
|---|---|
| `GET /api/cms/api-keys` | Daftar metadata dan prefix; tidak mengembalikan secret. |
| `POST /api/cms/api-keys` | Body: `siteId`, `label`, `expiresAt` opsional. Mengembalikan `201` dan `data.key`. |
| `POST /api/cms/api-keys/{keyId}/rotate` | Body `{}` mempertahankan expiry. Mengembalikan `200` dan `data.key`; ID dan label tetap, secret lama langsung tidak berlaku. `last_used_at` direset. Key revoked/kedaluwarsa ditolak. |
| `DELETE /api/cms/api-keys/{keyId}` | Hapus permanen; `200` dengan `{ "success": true }`, atau `404` jika tidak ditemukan/tidak dapat dihapus. |

**Perubahan kontrak:** DELETE bukan revoke lagi; rotasi bukan create record baru lagi (`201` berubah menjadi `200`). Update integrasi pengelola key yang mengandalkan perilaku lama. Setelah rotasi, ganti secret pada semua konsumen key tersebut.

Nilai penuh key hanya disimpan sementara pada state halaman setelah generate/rotasi. Reload atau meninggalkan halaman menghilangkan nilai tersebut; salin ulang lintas sesi belum tersedia. DB menyimpan hash, bukan secret yang dapat dipulihkan.

### Media global

| Method / path | Perilaku |
|---|---|
| `GET /api/cms/media` | Daftar metadata media yang boleh dibaca akun CMS aktif. |
| `POST /api/cms/media` | Daftarkan/perbarui metadata berdasarkan `storage_path` unik; bukan upload multipart. Respons `201` dengan `data`. |
| `DELETE /api/cms/media/{assetId}` | Menghapus metadata dan mengembalikan `data.storage_path`. Client galeri kemudian menghapus object Storage; kegagalan penghapusan file dapat terjadi terpisah. |

Alur upload CMS: upload file ke bucket `artikel-media` memakai sesi pengguna, lalu POST metadata. Field wajib: `storagePath`, `fileName`, `mimeType`, `fileSize`; `altText` opsional. Owner object diverifikasi lewat RLS. Batas bucket/metadata 20 MB; picker gambar utama dan editor tetap 5 MB dengan format JPG/PNG/WebP/GIF.

```json
{
  "storagePath": "global/media/550e8400-e29b-41d4-a716-446655440000/foto-acara.jpg",
  "fileName": "foto-acara.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 381952,
  "altText": "Foto acara"
}
```

File upload baru memakai nama asli pada akhir path, dengan folder UUID untuk mencegah overwrite. Karakter pemisah path/kontrol dinormalisasi. File lama yang sudah bernama UUID tidak otomatis berganti nama. Upload artikel/OG/editor/add-on CMS kini mendaftarkan metadata; path eksternal dari Automation API tidak otomatis diimpor. Menghapus artikel tidak otomatis menghapus media. Bulk select, ukuran kartu, drag selection, dan popup adalah fitur UI, bukan endpoint baru.

### Bulk status artikel

```js
const response = await fetch('/api/cms/articles/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ids: ['550e8400-e29b-41d4-a716-446655440000'],
    action: 'status',
    status: 'published'
  })
});
const body = await response.json();
if (!response.ok) throw new Error(body.error);
```

- `ids`: 1–100 UUID. `action`: `review`, `archive`, `status`, atau `delete`.
- `status` wajib untuk action `status`: draft, in_review, revision_requested, approved, published, archived.
- `status`/`archive` memerlukan admin/editor; delete memerlukan admin dan tetap dibatasi RLS.
- Action `status` ke Published mengisi ulang `published_at` dengan waktu request. Status lain mempertahankan tanggal publikasi lama; `archived_at` diisi untuk Archived atau dikosongkan untuk status lain.
- `review` hanya memproses draft/revision_requested; `archive` hanya memproses published.
- Sukses `200`: `{ "data": { "affected": 2 } }`. Angka ini jumlah row diperbarui, bukan jaminan seluruh pilihan berhasil diproses.
- `409` bila update tidak menyentuh row; `404` bila artikel tidak ditemukan/tidak dapat dibaca; `403` bila role tidak cukup; `400` untuk payload/query tidak valid.
- Dropdown hanya memilih tujuan; pengguna menekan **Terapkan status** untuk mengirim request.

## Endpoint Automation API

Endpoint dan header Public Read API tetap sama. Integrasi pembaca tidak perlu mengubah URL karena perubahan UI galeri.

Semua project yang membuat atau memperbarui artikel memakai:

```text
POST https://supabase.carubra.com/functions/v1/automation-api
```

`https://cms.carubra.com/api/v1` **bukan** endpoint push. URL tersebut Public Read API terpisah untuk membaca artikel `published`. Jangan bagikan URL itu ke project pengirim artikel.

## Autentikasi

```http
x-api-key: YOUR_AUTOMATION_API_KEY
Content-Type: application/json
```

Simpan key di backend, worker, cron, CI secret, atau serverless function. Jangan taruh key di browser, Git, log, query string, `NEXT_PUBLIC_*`, atau `VITE_*`.

## Quick start

```bash
curl -X POST "https://supabase.carubra.com/functions/v1/automation-api" \
  -H "x-api-key: YOUR_AUTOMATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "project-a-article-123",
    "title": "Judul Artikel",
    "slug": "judul-artikel",
    "content": "<p>Konten artikel</p>",
    "category_name": "Teknologi",
    "status": "draft"
  }'
```

## Cara kerja upsert

1. API key menentukan website/tenant tujuan. Client tidak mengirim `site_id`.
2. `external_id` menjadi identitas artikel dari project sumber.
3. Request pertama dengan `external_id` baru membuat artikel. `slug` dan `category_name` wajib ada.
4. Request berikut dengan `external_id` sama memperbarui artikel.
5. Status default `draft`.

Gunakan `external_id` stabil dan ber-namespace, misalnya `wordpress-42`, `erp-news-20260911-001`, atau `project-a:article:123`. Jangan membuat ID baru saat retry.

## Request body

| Field | Tipe | Aturan | Keterangan |
|---|---|---|---|
| `external_id` | string | Wajib | ID stabil dan unik dari project sumber. |
| `title` | string | Wajib | Judul artikel. |
| `content` | string | Wajib | Isi artikel; HTML diperbolehkan. |
| `slug` | string | Wajib | Slug artikel; huruf kecil dan tanda hubung. |
| `excerpt` | string | Opsional | Ringkasan artikel. |
| `category_name` | string | Wajib | Nama kategori untuk resolusi/pembuatan kategori. |
| `featured_image` | string | Opsional | Path storage gambar utama. |
| `status` | enum | Opsional | `draft`, `in_review`, `revision_requested`, `approved`, `published`, `archived`. Default `draft`. |
| `meta_description` | string | Opsional | Meta description. |
| `meta_keywords` | string[] | Opsional | Daftar keyword metadata. |
| `published_at` | ISO 8601 | Opsional | Waktu publikasi. |

Payload minimum:

`category_id`, `tags`, `seo_title`, `canonical_url`, `robots`, `og_image_path`, `og_image_url`, dan `publishScope` tidak diteruskan oleh source Automation API saat ini. Jangan menganggap field tersebut tersimpan meski request sukses. `meta_keywords` bukan pengganti sinkronisasi relasi tag. Mengirim path gambar juga tidak mengunggah file atau otomatis mendaftarkannya ke pustaka media.

```json
{
  "external_id": "project-a-article-123",
  "title": "Judul Artikel",
  "slug": "judul-artikel",
  "content": "<p>Konten artikel</p>",
  "category_name": "Teknologi"
}
```

## Node.js / Next.js server

```ts
const response = await fetch(
  "https://supabase.carubra.com/functions/v1/automation-api",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ARTIKEL_AUTOMATION_API_KEY!,
    },
    body: JSON.stringify({
      external_id: "project-a-article-123",
      title: "Judul Artikel",
      slug: "judul-artikel",
      content: "<p>Konten artikel</p>",
      category_name: "Teknologi",
      status: "draft",
    }),
  },
);

const body = await response.json();
if (!response.ok) throw new Error(body.error ?? "Automation API gagal");
```

## Python

```python
import os
import requests

response = requests.post(
    "https://supabase.carubra.com/functions/v1/automation-api",
    headers={
        "Content-Type": "application/json",
        "x-api-key": os.environ["ARTIKEL_AUTOMATION_API_KEY"],
    },
    json={
        "external_id": "python-job-123",
        "title": "Judul Artikel",
        "slug": "judul-artikel",
        "content": "<p>Konten artikel</p>",
        "category_name": "Teknologi",
        "status": "draft",
    },
    timeout=30,
)
response.raise_for_status()
```

## Public Read API: mengambil artikel untuk website

Public Read API dipakai website untuk membaca artikel `published`, termasuk gambar utama, SEO, kategori, tag, dan add-on. API key read terikat ke satu website melalui `artikel.api_keys.site_id`, sehingga hasil hanya berasal dari distribusi artikel untuk website tersebut.

Artikel dapat memakai `publish_scope` berikut:

- `selected_sites`: artikel hanya didistribusikan ke website sumber.
- `all_active_sites`: artikel didistribusikan ke seluruh website aktif dan otomatis dipasang pada website baru.

Scope publikasi tidak mengubah kontrak Public Read API. Konsumen tetap memakai endpoint dan API key yang sama. Tabel `artikel.article_sites` menentukan slug, kategori, status, dan waktu publish untuk setiap website.

### CMS API: scope publikasi artikel

`POST /api/cms/articles` menerima field opsional berikut:

```json
{
  "publishScope": "selected_sites"
}
```

Untuk admin global:

```json
{
  "publishScope": "all_active_sites"
}
```

Jika field tidak dikirim, default adalah `selected_sites`. Request `all_active_sites` dari pengguna selain admin global menghasilkan `403 Forbidden`. `PATCH /api/cms/articles/{articleId}` menerima field yang sama untuk mengubah artikel existing menjadi artikel global.

Base URL:

```text
https://cms.carubra.com/api/v1
```

Header wajib:

```http
x-artikel-key: YOUR_PUBLIC_READ_API_KEY
Accept: application/json
```

### Apakah URL GET bisa dibuka langsung di address bar browser?

Tidak untuk penggunaan normal. Address bar browser tidak dapat menambahkan header `x-artikel-key`. Jika URL dibuka langsung, API mengembalikan `401`.

Pilihan yang benar:

1. Panggil API dari backend website.
2. Buat endpoint proxy pada website, misalnya `/api/articles`.
3. Untuk pengujian manual, gunakan `curl`, Postman, Insomnia, atau Console DevTools browser.

Jangan menaruh API key di query string, HTML, JavaScript publik, `NEXT_PUBLIC_*`, atau `VITE_*`.

### GET daftar artikel berdasarkan kategori

```bash
curl "https://cms.carubra.com/api/v1/articles?category=news&page=1&limit=10" \
  -H "x-artikel-key: YOUR_PUBLIC_READ_API_KEY" \
  -H "Accept: application/json"
```

Parameter:

| Parameter | Wajib | Aturan |
|---|---|---|
| `category` | Ya | Slug kategori, misalnya `news` atau `teknologi`. |
| `page` | Tidak | Mulai dari `1`; default `1`. |
| `limit` | Tidak | Default `10`; maksimum `50`. |

Response daftar berisi metadata artikel dan `featured_image_url`. Add-on dan `content` hanya tersedia melalui endpoint detail.

```json
{
  "data": [
    {
      "title": "Judul Artikel",
      "slug": "judul-artikel",
      "excerpt": "Ringkasan artikel",
      "featured_image_url": "https://supabase.carubra.com/storage/v1/object/sign/...",
      "category": { "name": "News", "slug": "news" },
      "article_tags": [],
      "published_at": "2026-09-11T02:32:34.102+07:00"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1 }
}
```

### GET detail artikel, image, dan add-ons

Gunakan slug artikel:

```bash
curl "https://cms.carubra.com/api/v1/articles/judul-artikel" \
  -H "x-artikel-key: YOUR_PUBLIC_READ_API_KEY" \
  -H "Accept: application/json"
```

Response detail mengembalikan `content`, URL gambar siap pakai, kategori, tags, dan `addons`. Client tidak perlu menyusun URL Supabase Storage sendiri.

```json
{
  "data": {
    "title": "Judul Artikel",
    "slug": "judul-artikel",
    "content": "<p>Konten artikel</p>",
    "featured_image_url": "https://supabase.carubra.com/storage/v1/object/sign/...",
    "og_image_url": null,
    "category": { "name": "News", "slug": "news" },
    "article_tags": [],
    "addons": [
      {
        "id": "addon-uuid",
        "addon_type": "image_slider",
        "title": "Galeri",
        "placement": "after_content",
        "sort_order": 0,
        "config": {
          "media": [
            { "url": "https://supabase.carubra.com/storage/v1/object/sign/..." }
          ]
        }
      },
      {
        "id": "addon-uuid-2",
        "addon_type": "pdf_viewer",
        "title": "Dokumen",
        "placement": "after_content",
        "sort_order": 1,
        "config": {
          "url": "https://supabase.carubra.com/storage/v1/object/sign/...",
          "show_download": true
        }
      }
    ]
  }
}
```

### Cara memakai field gambar

Gunakan URL hasil API secara langsung:

```html
<img src="FEATURED_IMAGE_URL_DARI_API" alt="Judul artikel">
```

Contoh JavaScript setelah response berhasil diterima:

```js
const article = response.data;

document.querySelector("#featured-image").src = article.featured_image_url;
document.querySelector("#featured-image").alt = article.title;
```

- `featured_image_url`: gambar utama artikel.
- `og_image_url`: gambar Open Graph untuk SEO/social sharing.
- `featured_image_path` dan `og_image_path`: path internal storage; jangan dipakai sebagai URL `<img>`.
- Signed URL berlaku sementara. Jangan simpan URL tersebut permanen; ambil ulang melalui API saat expired.

### Cara membaca add-ons

```js
for (const addon of article.addons ?? []) {
  if (addon.addon_type === "image_slider") {
    const images = addon.config.media ?? [];
    for (const image of images) {
      console.log(image.url);
    }
  }

  if (addon.addon_type === "gallery") {
    const items = addon.config.gallery?.gallery_items ?? [];
    for (const item of items) {
      console.log(item.media_assets?.url);
    }
  }

  if (addon.addon_type === "pdf_viewer") {
    console.log(addon.config.url);
  }

  if (addon.addon_type === "file_download") {
    console.log(addon.config.url);
  }
}
```

Lokasi URL berdasarkan jenis add-on:

| `addon_type` | URL file/image |
|---|---|
| `image_slider` | `addon.config.media[].url` |
| `gallery` dengan gallery tersimpan | `addon.config.gallery.gallery_items[].media_assets.url` |
| `gallery` dengan media langsung | `addon.config.media[].url` |
| `pdf_viewer` | `addon.config.url` |
| `file_download` | `addon.config.url` |

Hormati `placement` (`before_content` atau `after_content`) dan urutkan berdasarkan `sort_order`.

### Tes dari Console browser

Hanya untuk debugging pada komputer developer. Membuat request langsung dari browser dapat terkena aturan CORS dan akan mengekspos key pada DevTools.

```js
const response = await fetch(
  "https://cms.carubra.com/api/v1/articles/judul-artikel",
  {
    headers: {
      "x-artikel-key": "YOUR_PUBLIC_READ_API_KEY",
      Accept: "application/json",
    },
  },
);

const body = await response.json();
console.log(body.data.featured_image_url);
console.table(body.data.addons);
```

Untuk production, browser harus memanggil backend website sendiri:

```js
const response = await fetch("/api/articles/judul-artikel");
const { data } = await response.json();
```

Backend `/api/articles/[slug]` meneruskan request ke CMS dan menambahkan `x-artikel-key` dari environment server.
## Respons

```json
{
  "success": true,
  "site": {
    "id": "site-uuid",
    "name": "Website A",
    "domain": "example.com",
    "slug": "website-a"
  },
  "data": []
}
```

| HTTP | Error | Tindakan |
|---|---|---|
| `400` | `Missing required fields` | Isi `external_id`, `title`, `slug`, `content`, `category_name`. |
| `401` | `Missing x-api-key header` | Tambahkan header `x-api-key`. |
| `401` | `Invalid or inactive API key` | Cek key dan website tujuan. |
| `500` | `Database operation failed` | Catat `details`; cek log function/database. |

## Checklist blast project

1. Endpoint selalu `https://supabase.carubra.com/functions/v1/automation-api`.
2. Pakai key berbeda per website dan environment.
3. Simpan key sebagai `ARTIKEL_AUTOMATION_API_KEY`.
4. Panggil hanya dari server-side.
5. Pakai `external_id` stabil.
6. Mulai dengan `status: draft`.
7. Retry timeout, `429`, dan `5xx` memakai backoff. Jangan retry `400`/`401` sebelum input diperbaiki.

## Status Public Read API

Kontrak read-only:

```text
GET https://cms.carubra.com/api/v1/articles?category={slug}&page=1&limit=10
GET https://cms.carubra.com/api/v1/articles/{slug}
Header: x-artikel-key
```

API ini hanya membaca artikel `published`. Endpoint aktif dan wajib memakai API key read milik website tujuan pada header `x-artikel-key`.

## Status Automation API

Endpoint `https://supabase.carubra.com/functions/v1/automation-api` telah diverifikasi aktif dan merespons `401` tanpa header key. Route dan Edge Function tersedia; request sukses memerlukan automation API key valid.


## Deployment wajib sebelum blast

Source function telah diselaraskan di supabase/functions/automation-api/index.ts. Sebelum key CMS dapat dipakai oleh Automation API, deploy source ini dan set ARTIKEL_API_KEY_PEPPER pada service functions ke nilai pepper CMS yang sama. Restart hanya service functions, lalu uji satu request draft dengan API key dari CMS.




## Penentuan website tujuan

Client tidak mengirim `site_id` atau `domain`. Automation API membaca API key, mengambil `api_keys.site_id`, lalu mengambil `name`, `domain`, dan `slug` dari `artikel.sites`. Satu API key selalu terikat ke satu website. Respons sukses mengembalikan object `site` agar project dapat memastikan artikel masuk ke website yang benar.


## Cek website tujuan sebelum push

```bash
curl "https://supabase.carubra.com/functions/v1/automation-api" \
  -H "x-api-key: YOUR_AUTOMATION_API_KEY"
```

Respons:

```json
{
  "success": true,
  "site": {
    "id": "site-uuid",
    "name": "Website A",
    "domain": "example.com",
    "slug": "website-a"
  }
}
```

Gunakan pemeriksaan ini setelah memasang key pada project. Jika domain salah, ganti API key; jangan mengirim `domain` atau `site_id` dalam payload.

