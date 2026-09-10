# API Artikel: Deployment dan Integrasi

> Status 10 September 2026: panduan ini mencakup deployment Public Read API dan CMS API yang tetap dipertahankan. Rancangan Edge Function automation tunggal berada di `docs/UNIFIED-CMS-API-DESIGN.md`.

Base URL production: `https://cms.carubra.com`

Semua request memakai header `x-artikel-key`. API key dibuat per website pada menu **API Keys**. Tenant ditentukan otomatis dari key dan API hanya mengembalikan artikel berstatus `published`.

## Endpoint

### Daftar artikel

```http
GET /api/v1/articles?category=teknologi&page=1&limit=10
x-artikel-key: art_live_xxxxxxxxx
```

- `category`: slug kategori, wajib.
- `page`: mulai dari 1, default 1.
- `limit`: default 10, maksimum 50.
- Response: `{ data: Article[], meta: { page, limit, total } }`.

### Detail artikel

```http
GET /api/v1/articles/judul-artikel
x-artikel-key: art_live_xxxxxxxxx
```

Response: `{ data: Article }`. Detail menyertakan `content`, `canonical_url`, `robots`, dan `og_image_path`.

## Error dan rate limit

| HTTP | Code | Arti |
|---:|---|---|
| 400 | `INVALID_REQUEST` | Parameter tidak valid |
| 401 | `INVALID_API_KEY` | Key kosong, salah, expired, atau revoked |
| 403 | `SITE_INACTIVE` | Website tidak aktif |
| 404 | `NOT_FOUND` | Artikel tidak ditemukan atau belum published |
| 429 | `RATE_LIMITED` | Batas request tercapai |
| 500 | `INTERNAL_ERROR` | Kesalahan server |

Header rate limit: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, dan `Retry-After`. Default: 120 request per 60 detik per key.

## Deployment API

Prasyarat: Docker, Docker Compose, Supabase self-hosted aktif, network `carubra-network` dan `buzzerhood-network`, serta `.env.production` lengkap.

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.example.com
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ARTIKEL_API_KEY_PEPPER=...
ARTIKEL_RATE_LIMIT_REQUESTS=120
ARTIKEL_RATE_LIMIT_WINDOW_SECONDS=60
CMS_CANONICAL_HOST=cms.carubra.com
```

Deploy production:

```bash
ssh maskhar@supabase-server
cd ~/apps/cms-artikel
git pull
docker compose up -d --build
docker ps --filter name=cms-artikel
docker logs cms-artikel --tail 100
```

Container meneruskan `127.0.0.1:3002` ke port aplikasi `3000`. Reverse proxy domain harus mengarah ke `127.0.0.1:3002`.

Verifikasi:

```bash
curl -I https://cms.carubra.com/login
curl -i "https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=10" \
  -H "x-artikel-key: art_live_xxxxxxxxx"
```

## Next.js

Simpan key tanpa prefix `NEXT_PUBLIC_`. Fetch dari Server Component, Server Action, atau Route Handler.

```ts
const response = await fetch(
  `${process.env.ARTIKEL_API_URL}/api/v1/articles?category=teknologi&page=1&limit=10`,
  {
    headers: { "x-artikel-key": process.env.ARTIKEL_API_KEY! },
    next: { revalidate: 60 },
  },
);
const { data, meta } = await response.json();
```

## Vite, React SPA, Vue, atau frontend browser

Jangan taruh key pada `VITE_*` atau bundle browser. Buat backend/serverless proxy, simpan key sebagai secret server, lalu frontend memanggil proxy milik aplikasi.

```ts
const response = await fetch('/api/articles?category=teknologi');
const { data } = await response.json();
```

## Laravel

```php
$response = Http::withHeaders([
    'x-artikel-key' => config('services.artikel.key'),
])->get(config('services.artikel.url') . '/api/v1/articles', [
    'category' => 'teknologi',
    'page' => 1,
    'limit' => 10,
]);
$articles = $response->throw()->json('data');
```

Tambahkan `ARTIKEL_API_URL` dan `ARTIKEL_API_KEY` ke `.env`, lalu petakan melalui `config/services.php`.

## PHP native

```php
$ch = curl_init('https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=10');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['x-artikel-key: ' . getenv('ARTIKEL_API_KEY')],
]);
$body = json_decode(curl_exec($ch), true, 512, JSON_THROW_ON_ERROR);
curl_close($ch);
```

## WordPress

Simpan konfigurasi pada `wp-config.php`, bukan JavaScript.

```php
define('ARTIKEL_API_URL', 'https://cms.carubra.com');
define('ARTIKEL_API_KEY', 'art_live_xxxxxxxxx');

$response = wp_remote_get(ARTIKEL_API_URL . '/api/v1/articles?category=teknologi&page=1&limit=10', [
    'headers' => ['x-artikel-key' => ARTIKEL_API_KEY],
    'timeout' => 10,
]);
if (!is_wp_error($response)) {
    $articles = json_decode(wp_remote_retrieve_body($response), true)['data'] ?? [];
}
```

Gunakan Transients API untuk cache dan `esc_html`, `esc_url`, atau `wp_kses_post` saat output.

## Keamanan

- Jangan simpan key di Git, URL, browser storage, frontend bundle, atau log.
- Gunakan key terpisah untuk staging dan production.
- Rotasi key berkala. Deploy key baru sebelum revoke key lama.
- Gunakan HTTPS dan batasi akses dashboard CMS.
