# API Artikel: Deployment dan Integrasi

> Status 11 September 2026: panduan ini mencakup Public Read API, CMS API, dan **Automation API** yang baru saja di-deploy.

Base URL production: `https://cms.carubra.com`

## API yang Tersedia

### 1. Public Read API
Untuk membaca artikel yang sudah published. Menggunakan header `x-artikel-key`.

### 2. CMS API (Internal)
Untuk operasi CRUD di dashboard CMS. Menggunakan session authentication.

### 3. Automation API (NEW) ⚡
Untuk push artikel dari sistem eksternal (WordPress, custom CMS, dll). Menggunakan header `x-api-key`.

---

## Public Read API

API key dibuat per website pada menu **API Keys**. Tenant ditentukan otomatis dari key dan API hanya mengembalikan artikel berstatus `published`.

### Endpoint

#### Daftar artikel

```http
GET /api/v1/articles?category=teknologi&page=1&limit=10
x-artikel-key: art_live_xxxxxxxxx
```

- `category`: slug kategori, wajib.
- `page`: mulai dari 1, default 1.
- `limit`: default 10, maksimum 50.
- Response: `{ data: Article[], meta: { page, limit, total } }`.

#### Detail artikel

```http
GET /api/v1/articles/judul-artikel
x-artikel-key: art_live_xxxxxxxxx
```

Response: `{ data: Article }`. Detail menyertakan `content`, `canonical_url`, `robots`, dan `og_image_path`.

---

## Automation API ⚡

**Base URL:** `https://supabase.maskhar.net/functions/v1/automation-api`

API untuk push artikel dari sistem eksternal ke CMS Artikel secara otomatis. Mendukung create dan update artikel dengan single endpoint.

### Endpoint

```http
POST /functions/v1/automation-api
x-api-key: your_automation_api_key
Content-Type: application/json
```

### Request Body

```json
{
  "external_id": "wp-12345",
  "title": "Judul Artikel",
  "slug": "judul-artikel",
  "content": "<p>Konten artikel HTML</p>",
  "excerpt": "Ringkasan singkat",
  "category_name": "Teknologi",
  "tags": ["tech", "news"],
  "featured_image_url": "https://example.com/image.jpg",
  "status": "draft",
  "seo_title": "SEO Title",
  "meta_description": "Meta description",
  "canonical_url": "https://example.com/original",
  "robots": "index, follow",
  "og_image_url": "https://example.com/og-image.jpg",
  "published_at": "2026-09-10T10:00:00Z"
}
```

### Required Fields

- `external_id` - ID unik dari sistem eksternal (contoh: `wp-12345`, `contentful-abc`)
- `title` - Judul artikel
- `content` - Konten artikel (HTML)

### Optional Fields

- `slug` - URL slug (auto-generated jika kosong)
- `excerpt` - Ringkasan artikel
- `category_id` - UUID kategori yang sudah ada
- `category_name` - Nama kategori (akan dibuat jika belum ada)
- `tags` - Array tag names
- `featured_image_url` - URL featured image
- `status` - Status artikel: `draft`, `pending`, `approved`, `published`, `archived` (default: `draft`)
- `seo_title` - SEO title
- `meta_description` - Meta description
- `canonical_url` - Canonical URL
- `robots` - Robots directive (default: `index, follow`)
- `og_image_url` - Open Graph image URL
- `published_at` - Tanggal publikasi (ISO 8601)

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "article_id": "uuid-here",
    "operation": "insert",
    "message": "Article created successfully"
  }
}
```

**Error (400/401/500):**
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

### Cara Kerja

1. **Upsert Logic**: Jika artikel dengan `external_id` yang sama sudah ada, akan di-update. Jika belum ada, akan dibuat baru.
2. **Category Handling**: Jika `category_name` diberikan dan kategori belum ada, akan dibuat otomatis.
3. **Tag Handling**: Tags akan di-sync otomatis - tags baru dibuat, tags lama dihapus jika tidak ada di request.
4. **Author Assignment**: Artikel akan di-assign ke user pertama dengan role `writer` atau `editor` di site tersebut.

### Contoh Integrasi

#### WordPress Plugin

```php
function push_to_artikel_cms($post_id) {
    $post = get_post($post_id);
    
    $payload = [
        'external_id' => 'wp-' . $post_id,
        'title' => $post->post_title,
        'content' => $post->post_content,
        'excerpt' => $post->post_excerpt,
        'status' => $post->post_status === 'publish' ? 'published' : 'draft',
        'published_at' => $post->post_date_gmt,
        'tags' => wp_get_post_tags($post_id, ['fields' => 'names']),
    ];
    
    $response = wp_remote_post(
        'https://supabase.maskhar.net/functions/v1/automation-api',
        [
            'headers' => [
                'x-api-key' => ARTIKEL_AUTOMATION_KEY,
                'Content-Type' => 'application/json',
            ],
            'body' => json_encode($payload),
            'timeout' => 30,
        ]
    );
    
    if (is_wp_error($response)) {
        error_log('Artikel API Error: ' . $response->get_error_message());
        return false;
    }
    
    $body = json_decode(wp_remote_retrieve_body($response), true);
    return $body['success'] ?? false;
}

// Hook ke WordPress
add_action('save_post', 'push_to_artikel_cms', 10, 1);
```

#### Node.js/Next.js

```typescript
async function pushToArtikelCMS(article: {
  externalId: string;
  title: string;
  content: string;
  // ... other fields
}) {
  const response = await fetch(
    'https://supabase.maskhar.net/functions/v1/automation-api',
    {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ARTIKEL_AUTOMATION_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_id: article.externalId,
        title: article.title,
        content: article.content,
        // ... map other fields
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return await response.json();
}
```

#### Python

```python
import requests

def push_to_artikel_cms(article):
    payload = {
        'external_id': article['external_id'],
        'title': article['title'],
        'content': article['content'],
        # ... other fields
    }
    
    response = requests.post(
        'https://supabase.maskhar.net/functions/v1/automation-api',
        headers={
            'x-api-key': os.getenv('ARTIKEL_AUTOMATION_KEY'),
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=30
    )
    
    response.raise_for_status()
    return response.json()
```

---

## Error dan Rate Limit

| HTTP | Code | Arti |
|---:|---|---|
| 400 | `INVALID_REQUEST` | Parameter tidak valid |
| 401 | `INVALID_API_KEY` | Key kosong, salah, expired, atau revoked |
| 403 | `SITE_INACTIVE` | Website tidak aktif |
| 404 | `NOT_FOUND` | Artikel tidak ditemukan atau belum published |
| 429 | `RATE_LIMITED` | Batas request tercapai |
| 500 | `INTERNAL_ERROR` | Kesalahan server |

Header rate limit: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, dan `Retry-After`. Default: 120 request per 60 detik per key.

---

## Deployment API

Prasyarat: Docker, Docker Compose, Supabase self-hosted aktif, network `carubra-network` dan `buzzerhood-network`, serta `.env.production` lengkap.

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.maskhar.net
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ARTIKEL_API_KEY_PEPPER=...
ARTIKEL_RATE_LIMIT_REQUESTS=120
ARTIKEL_RATE_LIMIT_WINDOW_SECONDS=60
CMS_CANONICAL_HOST=cms.carubra.com
```

### Deploy Next.js App (Public Read API & CMS)

```bash
ssh maskhar@supabase-server
cd ~/apps/cms-artikel
git pull
docker compose up -d --build
docker ps --filter name=cms-artikel
docker logs cms-artikel --tail 100
```

Container meneruskan `127.0.0.1:3002` ke port aplikasi `3000`. Reverse proxy domain harus mengarah ke `127.0.0.1:3002`.

### Deploy Automation API (Edge Function)

```bash
ssh maskhar@supabase-server
cd ~/docker/supabase/supabase-1.26.05/docker

# Copy function ke volumes
cp -r ~/cms-artikel/supabase/functions/automation-api volumes/functions/

# Restart Edge Functions container
docker compose restart functions

# Verify
docker compose logs functions --tail=50
ls -la volumes/functions/automation-api/
```

### Apply Database Migrations

```bash
ssh maskhar@supabase-server

# Option 1: Direct psql
docker exec -i supabase-db psql -U postgres -d postgres < migration.sql

# Option 2: Via Supabase Studio
# Access https://supabase.maskhar.net
# Go to SQL Editor → Execute migration
```

Verifikasi:

```bash
# Test Public Read API
curl -i "https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=10" \
  -H "x-artikel-key: art_live_xxxxxxxxx"

# Test Automation API
curl -X POST "https://supabase.maskhar.net/functions/v1/automation-api" \
  -H "x-api-key: your_automation_key" \
  -H "Content-Type: application/json" \
  -d '{"external_id":"test-001","title":"Test","content":"<p>Test</p>"}'
```

---

## Integrasi dengan Platform

### Next.js

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

### Vite, React SPA, Vue, atau frontend browser

Jangan taruh key pada `VITE_*` atau bundle browser. Buat backend/serverless proxy, simpan key sebagai secret server, lalu frontend memanggil proxy milik aplikasi.

```ts
const response = await fetch('/api/articles?category=teknologi');
const { data } = await response.json();
```

### Laravel

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

### PHP native

```php
$ch = curl_init('https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=10');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['x-artikel-key: ' . getenv('ARTIKEL_API_KEY')],
]);
$body = json_decode(curl_exec($ch), true, 512, JSON_THROW_ON_ERROR);
curl_close($ch);
```

### WordPress

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

---

## Keamanan

- Jangan simpan key di Git, URL, browser storage, frontend bundle, atau log.
- Gunakan key terpisah untuk staging dan production.
- Gunakan API key berbeda untuk Public Read API (`x-artikel-key`) dan Automation API (`x-api-key`).
- Rotasi key berkala. Deploy key baru sebelum revoke key lama.
- Gunakan HTTPS dan batasi akses dashboard CMS.
- Automation API key harus disimpan di server-side saja, tidak boleh di frontend.
- Monitor penggunaan API key melalui dashboard Audit Logs.

---

## Troubleshooting

### Automation API

**Error: Invalid or inactive API key**
- Pastikan API key sudah dibuat di dashboard dengan scope `automation`
- Pastikan API key dalam status `active`
- Pastikan menggunakan header `x-api-key` (bukan `x-artikel-key`)

**Error: Missing required fields**
- Pastikan `external_id`, `title`, dan `content` ada di request body

**Error: Database operation failed**
- Check logs: `docker compose logs functions --tail=100`
- Pastikan RLS policies sudah applied
- Pastikan user dengan role writer/editor ada di site

**Article tidak muncul di dashboard**
- Check status artikel (default: `draft`)
- Check apakah artikel ter-assign ke site yang benar
- Check RLS policies apakah user bisa akses

---

## Monitoring

### Check Logs

```bash
# CMS App logs
docker logs cms-artikel --tail=100 -f

# Edge Functions logs
cd ~/docker/supabase/supabase-1.26.05/docker
docker compose logs functions --tail=100 -f

# Database logs
docker compose logs db --tail=100 -f
```

### Check API Status

```bash
# Health check
curl -I https://cms.carubra.com/login

# Test Public Read API
curl "https://cms.carubra.com/api/v1/articles?category=test&page=1&limit=1" \
  -H "x-artikel-key: your_key"

# Test Automation API
curl -X POST "https://supabase.maskhar.net/functions/v1/automation-api" \
  -H "x-api-key: your_automation_key" \
  -H "Content-Type: application/json" \
  -d '{"external_id":"health-check","title":"Health Check","content":"Test"}'
```

---

**Last updated:** 11 September 2026
