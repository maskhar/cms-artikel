# Integrasi Public API Artikel

**Versi:** 10 September 2026

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
