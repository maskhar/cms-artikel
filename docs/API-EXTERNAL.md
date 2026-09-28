# CMS Artikel — Kontrak API untuk Project Eksternal

> **Untuk AI coding agent yang membaca berkas ini:** dokumen ini adalah kontrak
> lengkap dan mandiri. Semua yang dibutuhkan untuk berintegrasi ada di sini —
> jangan mencari dokumen lain, jangan menebak field yang tidak tercantum, dan
> jangan mengarang endpoint. Bentuk respons di bawah disalin dari implementasi
> nyata, bukan dari rencana.
>
> **Cara memakai:** salin berkas ini ke repo project konsumen. Kalau project itu
> belum punya `AGENTS.md`, ganti namanya jadi `AGENTS.md` supaya agent membacanya
> otomatis. Kalau sudah punya, simpan sebagai `API.md` dan rujuk dari `AGENTS.md`.

Diverifikasi terhadap produksi 29 September 2026.

---

## ⚠️ Baca ini dulu: ada DUA API yang berbeda

Ini sumber kesalahan integrasi paling sering. Keduanya bukan varian dari satu
API — beda host, beda header, beda bentuk error.

| | **Public Read API** | **Automation API** |
|---|---|---|
| Untuk | Website konsumen **membaca** artikel | Bot/CI **mengirim** artikel ke CMS |
| Base URL | `https://cms.carubra.com/api/v1` | `https://supabase.carubra.com/functions/v1/automation-api` |
| Header key | `x-artikel-key` | `x-api-key` |
| Bentuk error | `{"error":{"code":"...","message":"..."}}` | `{"error":"..."}` (string datar) |
| Method | `GET` saja | `GET` (verifikasi key) dan `POST` |

**Jangan tertukar.** Mengirim `x-api-key` ke Public Read API menghasilkan `401`
yang terlihat seperti "key saya salah", padahal headernya yang salah. Begitu juga
sebaliknya.

Key-nya juga berbeda benda: satu key hanya berlaku di satu API. Minta key
terpisah ke admin CMS untuk masing-masing keperluan.

---

# BAGIAN 1 — Public Read API (membaca artikel)

Base URL: `https://cms.carubra.com/api/v1`

## Autentikasi

```http
x-artikel-key: ak_live_xxxxxxxxxxxxxxxxx
```

API key menentukan tenant. Client **tidak pernah** mengirim `site_id` — satu key
hanya bisa membaca artikel milik satu website, dan hanya yang berstatus
`published`.

**Key ini rahasia backend.** Jangan taruh di bundle browser, `NEXT_PUBLIC_*`,
`VITE_*`, query string, atau Git. Panggil API dari server (route handler, PHP,
worker), lalu teruskan hasilnya ke frontend.

## `GET /articles` — daftar artikel

```http
GET /api/v1/articles?category=teknologi&page=1&limit=10
x-artikel-key: ak_live_xxx
```

| Parameter | Wajib | Aturan |
|---|---|---|
| `category` | **ya** | Slug kategori persis seperti tersimpan di CMS |
| `page` | tidak | Bilangan bulat ≥ 1. Default `1` |
| `limit` | tidak | Bilangan bulat ≥ 1. Default `10`. Nilai > 50 **dipotong diam-diam ke 50**, bukan error |

"Bilangan bulat" ditegakkan harfiah: `limit=10.5` dan `page=1.5` ditolak `400`.
Bulatkan hasil pembagian sebelum mengirim.

### ⚠️ Jebakan 1: `category` divalidasi SEBELUM autentikasi

Kalau `category` tidak dikirim, respons adalah **`400`, bukan `401`** — walaupun
API key Anda salah atau tidak ada sama sekali.

Konsekuensi saat debugging: `400` di sini **tidak berarti key Anda benar.**
Jangan menyimpulkan autentikasi sudah lolos dari fakta Anda dapat `400`. Uji key
dengan menyertakan `category` yang valid.

### ⚠️ Jebakan 2: `category` adalah slug, bukan label

Kalau kategori di CMS ber-slug `news`, maka `?category=berita` mengembalikan
**`200` dengan array kosong**, bukan error. Tidak ada artikel hilang — slugnya
yang tidak cocok. Array kosong pada `200` hampir selalu berarti slug salah.

### ⚠️ Jebakan 3: tidak ada endpoint daftar kategori

`GET /api/v1/categories` **tidak ada**. Belum dibuat. Konsumen harus menyimpan
sendiri daftar slug kategori yang ingin ditampilkan, dan daftar itu tidak akan
otomatis tahu kalau admin menambah kategori baru di CMS. Rencanakan cara
memutakhirkannya (konfigurasi, bukan hardcode di banyak tempat).

### Respons `200`

```json
{
  "data": [
    {
      "title": "Judul Artikel",
      "excerpt": "Ringkasan singkat...",
      "seo_title": "Judul untuk mesin pencari",
      "meta_description": "Deskripsi meta",
      "featured_image_path": "site-id/article-id/gambar.webp",
      "featured_image_url": "https://supabase.carubra.com/storage/v1/object/sign/...",
      "article_tags": [{ "tags": { "name": "AI", "slug": "ai" } }],
      "slug": "judul-artikel",
      "published_at": "2026-09-10T10:00:00Z",
      "category": { "name": "Teknologi", "slug": "teknologi" }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 42 }
}
```

Catatan bentuk data yang mudah salah dibaca:

- **`article_tags` bersarang dua lapis.** Nama tag ada di
  `article_tags[i].tags.name`, bukan `article_tags[i].name`.
- **`category` (tunggal)** di daftar artikel. Di endpoint detail ada `category`
  **dan** `categories` — lihat bagian berikutnya.
- **`featured_image_path` ikut terkirim tapi tidak berguna bagi Anda.** Itu path
  internal storage. Yang bisa dipakai hanya `featured_image_url`.
- **`total`** adalah jumlah seluruh artikel pada kategori itu, bukan jumlah item
  di halaman ini. Pakai untuk menghitung jumlah halaman.
- Urutan: `published_at` menurun (terbaru dahulu).
- Halaman di luar jangkauan mengembalikan `200` dengan `data: []`, bukan `404`.

## `GET /articles/{slug}` — detail artikel

```http
GET /api/v1/articles/judul-artikel
x-artikel-key: ak_live_xxx
```

Tanpa parameter query. `slug` diambil dari field `slug` hasil endpoint daftar.

### Respons `200`

```json
{
  "data": {
    "title": "Judul Artikel",
    "excerpt": "Ringkasan singkat...",
    "content": "<p>Konten HTML yang sudah disanitasi server.</p>",
    "seo_title": "Judul untuk mesin pencari",
    "meta_description": "Deskripsi meta",
    "canonical_url": "https://contoh.com/artikel/judul-artikel",
    "robots": "index,follow",
    "featured_image_path": "site-id/article-id/gambar.webp",
    "og_image_path": "site-id/article-id/og.webp",
    "featured_image_url": "https://supabase.carubra.com/storage/v1/object/sign/...",
    "og_image_url": "https://supabase.carubra.com/storage/v1/object/sign/...",
    "article_tags": [{ "tags": { "name": "AI", "slug": "ai" } }],
    "slug": "judul-artikel",
    "published_at": "2026-09-10T10:00:00Z",
    "categories": { "name": "Teknologi", "slug": "teknologi" },
    "category": { "name": "Teknologi", "slug": "teknologi" },
    "addons": []
  }
}
```

- **`categories` dan `category` berisi hal yang sama.** `category` adalah bentuk
  yang sudah dinormalkan; pakai itu. `categories` sisa bentuk mentah query.
- `id` artikel **sengaja tidak dikirim**. Identitas publik artikel adalah `slug`.
- `canonical_url`, `robots`, `og_image_url` bisa `null` kalau editor tidak
  mengisinya. Sediakan fallback sebelum merender tag SEO.

### `addons` — blok konten tambahan

Array, boleh kosong. Tiap elemen:

```json
{
  "id": "uuid",
  "addon_type": "gallery",
  "title": "Galeri Acara",
  "placement": "after_content",
  "sort_order": 1,
  "config": { }
}
```

Render berurutan menurut `sort_order`. Isi `config` bergantung `addon_type`:

| `addon_type` | Isi `config` yang bisa dipakai |
|---|---|
| `gallery`, `image_slider` | `config.gallery.gallery_items[]`, tiap item punya `media_assets.url`, `caption_override`, `link_url`. Bentuk lain: `config.media[]` berisi `{ url }` |
| `pdf_viewer`, `file_download` | `config.url` |

Path storage mentah (`storage_path`, `media_paths`) sudah dibuang dari respons
dan diganti URL siap pakai. Kalau `addon_type` tidak Anda kenali, **lewati saja**
— jenis baru bisa ditambahkan tanpa perubahan versi API.

## ⚠️ Jebakan 4: semua URL gambar KEDALUWARSA dalam 1 jam

`featured_image_url`, `og_image_url`, dan setiap `url` di dalam `addons` adalah
**signed URL berumur 3600 detik**.

Yang akan rusak kalau ini diabaikan:

- **Jangan simpan URL itu ke database Anda.** Besok URL itu mati.
- **Jangan cache respons API lebih dari 1 jam** kalau halaman menampilkan gambar.
  Cache 5–30 menit aman dan tetap mengurangi beban.
- **Jangan pasang di sitemap, feed RSS, email, atau meta `og:image` yang
  di-crawl belakangan.** Crawler datang setelah URL mati → gambar hilang.
- Untuk gambar yang harus awet, unduh saat menerima lalu simpan/serve sendiri.

## Rate limit

120 request per 60 detik **per API key**. Berlaku di kedua API.

Setiap respons membawa:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 117
X-RateLimit-Reset: 1790000000
```

Saat terlampaui: `429` + `Retry-After: <detik>`. Hormati `Retry-After`; jangan
coba lagi seketika.

Kuota dihitung per key, bukan per IP atau per endpoint — satu halaman yang
memanggil 7 kategori memakai 7 request. Batching dan cache di sisi Anda adalah
cara utama menghindari `429`.

## Kode error

Semua error Public Read API berbentuk `{"error":{"code":"...","message":"..."}}`.

| HTTP | `code` | Arti dan tindakan |
|---|---|---|
| `400` | `INVALID_REQUEST` | `category` hilang, atau `page`/`limit` bukan bilangan bulat ≥ 1. **Bisa muncul walau key salah** |
| `401` | `INVALID_API_KEY` | Key tidak dikirim, salah, dicabut, atau kedaluwarsa |
| `403` | `SITE_INACTIVE` | Website dinonaktifkan admin CMS. Bukan masalah kode — hubungi admin |
| `404` | `NOT_FOUND` | Slug tidak ada, **atau** artikel belum `published`, **atau** milik tenant lain. Ketiganya sengaja tidak dibedakan |
| `429` | `RATE_LIMITED` | Lihat `Retry-After` |
| `500` | `INTERNAL_ERROR` | Kesalahan sisi CMS. Aman dicoba ulang dengan backoff |

Pesan pada `message` ditujukan untuk log developer, **bukan untuk ditampilkan ke
pengunjung**. Tampilkan pesan Anda sendiri.

## Contoh implementasi (server-side)

```ts
// Jalankan di server. Key tidak boleh sampai ke browser.
const BASE = "https://cms.carubra.com/api/v1";

async function ambilArtikel(category: string, page = 1, limit = 10) {
  const url = `${BASE}/articles?category=${encodeURIComponent(category)}&page=${page}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { "x-artikel-key": process.env.ARTIKEL_API_KEY! },
    // Cache < 1 jam: signed URL gambar mati setelah 3600 detik.
    next: { revalidate: 300 },
  });

  if (res.status === 429) {
    const tunggu = Number(res.headers.get("Retry-After") ?? "60");
    throw new Error(`Rate limited, coba lagi dalam ${tunggu} detik`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`CMS ${res.status}: ${body?.error?.code ?? "UNKNOWN"}`);
  }
  return res.json();
}
```

## Keamanan wajib: sanitasi ulang `content`

`content` adalah HTML. Server CMS sudah menyanitasinya, tapi **sanitasi lagi
sebelum render** — pertahanan berlapis, dan Anda tidak mengendalikan siapa yang
menulis artikel di CMS.

```tsx
import DOMPurify from "isomorphic-dompurify";

<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }} />
```

Berlaku sama untuk `v-html` (Vue), `{@html}` (Svelte), dan `echo` di PHP.

---

# BAGIAN 2 — Automation API (mengirim artikel)

Endpoint: `https://supabase.carubra.com/functions/v1/automation-api`

Hanya perlu kalau project Anda **membuat/memperbarui** artikel di CMS. Kalau
project Anda cuma menampilkan artikel, abaikan seluruh bagian ini.

## Autentikasi

```http
x-api-key: YOUR_AUTOMATION_API_KEY
Content-Type: application/json
```

Key menentukan tenant tujuan. **Jangan kirim `site_id`** — tidak diterima.

## `GET` — verifikasi key

Dipakai untuk memastikan key hidup dan tahu tenant mana yang dituju.

```bash
curl "https://supabase.carubra.com/functions/v1/automation-api" \
  -H "x-api-key: YOUR_KEY"
```

```json
{
  "success": true,
  "site": { "id": "uuid", "name": "Nama Website", "domain": "contoh.com", "slug": "contoh" }
}
```

## `POST` — buat atau perbarui artikel

```bash
curl -X POST "https://supabase.carubra.com/functions/v1/automation-api" \
  -H "x-api-key: YOUR_KEY" \
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

### Field

| Field | Wajib | Catatan |
|---|---|---|
| `external_id` | **ya** | Identitas artikel **di sistem Anda**. Kunci idempotensi |
| `title` | **ya** | |
| `slug` | **ya** | Slug di CMS |
| `content` | **ya** | HTML |
| `category_name` | **ya** | **Nama** kategori, bukan slug. Dibuat otomatis kalau belum ada |
| `excerpt` | tidak | |
| `status` | tidak | Default `draft`. Lihat daftar di bawah |
| `featured_image` | tidak | |
| `meta_description` | tidak | |
| `meta_keywords` | tidak | Harus **array**, bukan string dipisah koma |
| `published_at` | tidak | ISO 8601 |

Field di luar daftar ini **diabaikan diam-diam**. Kalau data Anda tidak muncul di
CMS, periksa dulu apakah nama fieldnya memang ada di tabel ini.

`status` yang diterima: `draft`, `in_review`, `revision_requested`, `approved`,
`published`, `archived`. Nilai lain → `400`.

### ⚠️ `category_name` pakai NAMA, Public Read API pakai SLUG

Kirim `"category_name": "Teknologi"` di sini, lalu baca dengan
`?category=teknologi` di sana. Dua konvensi berbeda pada dua API berbeda.

### Idempotensi

`external_id` adalah kuncinya. POST pertama dengan `external_id` baru **membuat**
artikel; POST berikutnya dengan `external_id` sama **memperbarui** artikel yang
sama, tidak membuat duplikat.

Artinya retry setelah timeout atau `500` **aman** — tidak akan menghasilkan
artikel ganda, asalkan `external_id` tetap sama. Simpan `external_id` yang Anda
pakai; jangan bangkitkan ulang secara acak tiap kali mengirim.

### Respons `200`

```json
{
  "success": true,
  "site": { "id": "uuid", "name": "Nama Website", "domain": "contoh.com", "slug": "contoh" },
  "data": { }
}
```

`data` memuat hasil upsert, termasuk penanda apakah artikel baru dibuat.

### Error Automation API

Bentuknya **string datar** — `{"error":"..."}` — bukan objek seperti Public Read
API. Kode yang sama dapat dibedakan dari isi pesannya:

| HTTP | `error` | Arti |
|---|---|---|
| `400` | `Missing required fields` | Disertai array `required` berisi field yang kurang |
| `400` | `Invalid status` | Disertai array `allowed` |
| `400` | `meta_keywords must be an array` | Dikirim sebagai string |
| `400` | `published_at must be ISO 8601` | |
| `401` | `Missing x-api-key header` | Header tidak dikirim — **bukan** key salah |
| `401` | `Invalid or inactive API key` | Key salah/dicabut/kedaluwarsa, atau website dinonaktifkan |
| `405` | `Method not allowed` | Selain `GET`/`POST` |
| `429` | `Too many requests` | Lihat `Retry-After` |
| `500` | `Automation API is not configured` | Kesalahan konfigurasi server. Laporkan ke admin CMS; percuma dicoba ulang |
| `500` | `Database operation failed` | Aman dicoba ulang dengan backoff dan `external_id` sama |

Bedakan `Missing x-api-key header` dari `Invalid or inactive API key`: yang
pertama berarti kode Anda tidak mengirim header sama sekali (sering karena salah
nama header), yang kedua berarti header terkirim tapi nilainya ditolak.

---

# Rujukan cepat

```
BACA artikel
  https://cms.carubra.com/api/v1
  header: x-artikel-key
  GET /articles?category=<slug>&page=1&limit=10     (category WAJIB)
  GET /articles/<slug>
  error: {"error":{"code","message"}}

KIRIM artikel
  https://supabase.carubra.com/functions/v1/automation-api
  header: x-api-key
  GET   -> verifikasi key
  POST  -> upsert, kunci idempotensi external_id
  error: {"error":"pesan"}

Keduanya: 120 request / 60 detik per key, X-RateLimit-*, 429 + Retry-After
Semua URL gambar: signed, mati setelah 3600 detik
```

## Checklist sebelum menyebut integrasi selesai

- [ ] API key dibaca dari environment variable, tidak pernah masuk Git/bundle browser
- [ ] Semua panggilan API dilakukan dari server, bukan dari browser
- [ ] `category` memakai **slug** CMS, dan sudah dicek mengembalikan data
- [ ] `429` ditangani dengan menghormati `Retry-After`
- [ ] Cache respons < 1 jam, dan URL gambar tidak disimpan ke database
- [ ] `content` disanitasi ulang sebelum dirender
- [ ] `article_tags[i].tags.name` dibaca pada kedalaman yang benar
- [ ] `addon_type` tak dikenal dilewati, tidak membuat render gagal
- [ ] Untuk pengirim: `external_id` stabil dan tersimpan, retry aman
