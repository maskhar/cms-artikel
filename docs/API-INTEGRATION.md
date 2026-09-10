# Integrasi Public API Artikel

**Versi:** 10 September 2026

> Dokumen ini tetap berlaku untuk website pembaca melalui Public Read API `/api/v1/*`. Automation yang membuat atau memperbarui artikel mengikuti `docs/UNIFIED-CMS-API-DESIGN.md`; keduanya tidak saling menggantikan.

> Dokumen ini tetap berlaku untuk website pembaca melalui Public Read API `/api/v1/*`. Automation yang membuat atau memperbarui artikel mengikuti `docs/UNIFIED-CMS-API-DESIGN.md`; keduanya tidak saling menggantikan.

## Konfigurasi website

Simpan key per website di environment server. Jangan simpan key di browser, source repository, atau URL.

```env
ARTIKEL_API_URL=https://cms.example.com/api/v1
ARTIKEL_API_KEY=ak_live_...
```

Gunakan header pada setiap request:

```http
X-Artikel-Key: ak_live_...
```

## Daftar artikel

```http
GET /api/v1/articles?category=teknologi&page=1&limit=10
X-Artikel-Key: ak_live_...
```

`category`, `page`, dan `limit` wajib. `limit` maksimum `50`. Response hanya memuat artikel `published` milik tenant dari API key.

`category` harus berisi **slug kategori yang tersimpan di CMS**, bukan nama menu atau label buatan frontend. Contoh: jika artikel memakai kategori dengan slug `news`, website harus meminta `category=news`. Request `category=teknologi` tidak akan mengembalikan artikel tersebut.

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 0 }
}
```

## Detail artikel

```http
GET /api/v1/articles/judul-artikel
X-Artikel-Key: ak_live_...
```

Response memuat konten HTML dari editor, SEO fields, path featured image/OG image, kategori, dan tag.

## JavaScript server-side

```ts
const response = await fetch(`${process.env.ARTIKEL_API_URL}/articles?category=teknologi&page=1&limit=10`, {
  headers: { "X-Artikel-Key": process.env.ARTIKEL_API_KEY! },
  next: { revalidate: 60 },
});

if (!response.ok) throw new Error(`Artikel API gagal: ${response.status}`);
const payload = await response.json();
```

Render `content` sebagai HTML hanya setelah sanitasi sesuai framework website. Jangan render HTML CMS dari sumber lain tanpa sanitasi.

## Sinkronisasi kategori CMS dan website

Setiap artikel menyimpan `category_id`. Kategori tersebut terikat ke satu tenant melalui `site_id`. Saat artikel dibuat, CMS otomatis menyimpan kategori yang dipilih pada form artikel. Tidak perlu memasukkan kategori artikel dua kali.

Namun, website konsumen tetap harus meminta slug kategori yang benar. Daftar kategori yang ditulis langsung di source frontend, misalnya:

```ts
const categories = ["profil", "layanan", "portofolio", "kesehatan", "tips", "artikel", "teknologi"];
```

tidak otomatis mengetahui kategori baru dari CMS. Jika CMS memiliki kategori `news`, tetapi frontend tidak pernah meminta `category=news`, artikel kategori tersebut tidak akan tampil.

### Perilaku saat ini

- CMS otomatis menghubungkan artikel dengan kategori yang dipilih.
- Public API daftar artikel memerlukan satu parameter `category`.
- Public API belum menyediakan endpoint daftar kategori publik.
- Frontend yang memakai daftar kategori hardcoded harus diperbarui manual ketika slug kategori berubah atau bertambah.

### Arsitektur yang disarankan

Tambahkan endpoint kategori publik yang memakai API key tenant, misalnya:

```http
GET /api/v1/categories
X-Artikel-Key: ak_live_...
```

Endpoint hanya mengembalikan kategori aktif milik `site_id` dari API key:

```json
{
  "data": [
    { "name": "News", "slug": "news" },
    { "name": "Teknologi", "slug": "teknologi" }
  ]
}
```

Frontend kemudian mengambil kategori dari endpoint tersebut dan meminta artikel berdasarkan setiap slug:

```ts
const categoryResponse = await fetch("/api/categories.php");
const categoryPayload = await categoryResponse.json();

const articleRequests = categoryPayload.data.map((category: { slug: string }) =>
  fetch(`/api/articles.php?category=${encodeURIComponent(category.slug)}&page=1&limit=50`),
);
```

Dengan arsitektur ini, kategori baru yang dibuat di CMS dapat muncul tanpa mengubah daftar kategori di source frontend. Tampilan menu, urutan kategori, dan layout tetap menjadi tanggung jawab frontend.

## Proxy PHP untuk website browser

Vite/React SPA tidak boleh mengirim `ARTIKEL_API_KEY` langsung dari browser. Gunakan proxy server-side seperti `api/articles.php`. Proxy membaca key dari environment atau file konfigurasi di luar document root, lalu meneruskan request ke CMS.

Server `uteroindonesia.com` saat integrasi ini diperiksa memakai PHP `7.4.33`. Source proxy harus kompatibel dengan PHP 7.4:

- Jangan gunakan parameter type `mixed` karena membutuhkan PHP 8.0+.
- Jangan gunakan return type `never` karena membutuhkan PHP 8.1+.
- Gunakan parameter tanpa type untuk nilai campuran dan return type `void` untuk fungsi respons yang memanggil `exit`.

Contoh kompatibel:

```php
function filterPositiveInteger($value, int $default): int
{
    // ...
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}
```

## Diagnosis artikel tidak muncul

Periksa berurutan:

1. Pastikan request proxy tidak menghasilkan `500`, `502`, atau body kosong.
2. Pastikan proxy memakai PHP yang kompatibel dengan source.
3. Pastikan `ARTIKEL_API_URL` dan `ARTIKEL_API_KEY` tersedia pada server website.
4. Pastikan API key milik tenant yang sama dengan artikel.
5. Pastikan website dan API key aktif.
6. Pastikan status artikel benar-benar `published` dan `published_at` terisi.
7. Pastikan slug pada query `category` sama persis dengan slug kategori artikel.
8. Pastikan frontend membaca bentuk response `{ data, meta }`, bukan menganggap root response sebagai array.
9. Bersihkan cache proxy, LiteSpeed, CDN, atau service worker setelah deploy perubahan.

Interpretasi respons umum:

| Gejala | Kemungkinan penyebab |
| --- | --- |
| `500` dengan body kosong dari file PHP | Fatal/parse error PHP sebelum fungsi error handler berjalan. |
| `500 SERVER_CONFIGURATION_ERROR` | API key proxy belum dikonfigurasi. |
| `401 INVALID_API_KEY` | Key salah, kedaluwarsa, atau sudah direvoke. |
| `403 SITE_INACTIVE` | Tenant website nonaktif. |
| `200` dengan `data: []` | Kategori tidak cocok, belum ada artikel published, atau key memakai tenant berbeda. |
| Artikel ada di CMS tetapi tidak tampil | Periksa slug kategori dan parsing response frontend. |

## Konteks ringkas untuk AI

Gunakan blok berikut saat meminta AI menganalisis integrasi ini:

```text
Project CMS memakai Next.js 16 dan self-hosted Supabase.
Semua data CMS berada di schema PostgreSQL `artikel`.
Website dimodelkan sebagai tenant pada `artikel.sites`.
Artikel terikat tenant melalui `site_id` dan kategori melalui `category_id`.
Public API memakai header `x-artikel-key`; key menentukan `site_id` dan tidak boleh dikirim dari browser.
Endpoint daftar artikel: GET /api/v1/articles?category={slug}&page=1&limit=50.
Endpoint hanya mengembalikan artikel status `published` milik tenant API key dan kategori dengan slug yang diminta.
Response daftar berbentuk `{ data, meta }`.
Frontend Vite memakai proxy PHP `api/articles.php` agar API key tetap server-side.
Hosting uteroindonesia.com memakai PHP 7.4.33; jangan gunakan syntax PHP 8 seperti `mixed` atau `never`.
Daftar kategori frontend saat ini dapat bersifat hardcoded. Kategori CMS baru tidak otomatis diminta frontend tanpa endpoint kategori publik atau perubahan source frontend.
Target perbaikan permanen: buat GET /api/v1/categories yang tenant-scoped, proxy kategori server-side, lalu render/fetch kategori frontend secara dinamis.
Jangan membuat schema atau tabel terpisah per website. Gunakan `site_id` dan pertahankan RLS.
```

## Rate limit

Default `120` request per `60` detik untuk setiap key valid. Baca header berikut:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 119
X-RateLimit-Reset: 1789000000
```

Saat `429 RATE_LIMITED`, tunggu detik dari header `Retry-After`. Gunakan cache website untuk menekan request berulang.

## Key lifecycle

- Set expiry saat membuat key production bila integrasi bersifat sementara.
- Rotasi key dari CMS sebelum expiry atau saat ada dugaan kebocoran. Rotasi membuat key baru dan langsung revoke key lama.
- Key hanya ditampilkan sekali saat dibuat atau dirotasi.
- Revoke key langsung bila website tidak lagi memakai API.

## Error codes

| Status | Code | Aksi website |
| --- | --- | --- |
| `401` | `INVALID_API_KEY` | Periksa key, expiry, dan revoke status. |
| `403` | `SITE_INACTIVE` | Hubungi admin CMS. |
| `404` | `NOT_FOUND` | Tampilkan halaman tidak ditemukan. |
| `429` | `RATE_LIMITED` | Tunggu `Retry-After`, gunakan cache. |
| `500` | `INTERNAL_ERROR` | Retry terbatas dengan backoff, lalu laporkan. |
