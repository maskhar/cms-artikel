# API Artikel: Deployment dan Integrasi

> Diperbarui 28 September 2026 terhadap kontrak nyata. Versi sebelumnya memakai
> host `supabase.maskhar.net`, prefix key `art_live_`, daftar field wajib yang
> salah, dan bentuk respons yang tidak pernah dikembalikan API.

> ✅ **Automation API `GET` dan `POST` berfungsi di produksi** sejak 28 September
> 2026. Tiga blocker ditutup: `ARTIKEL_API_KEY_PEPPER` di-set di container Edge
> Function, migrasi perbaikan RPC diterapkan, dan Edge Function tidak lagi salah
> membaca embed `sites` sebagai array (bug yang menolak **semua** key dengan
> `401`). Terverifikasi end-to-end lewat HTTP nyata. Lihat
> [Deploy Automation API](#deploy-automation-api-edge-function).

Base URL production: `https://cms.carubra.com`
Supabase self-hosted: `https://supabase.carubra.com`

## API yang Tersedia

### 1. Public Read API
Untuk membaca artikel yang sudah published. Menggunakan header `x-artikel-key`.

### 2. CMS API (Internal)
Untuk operasi CRUD di dashboard CMS. Menggunakan session authentication.

### 3. Automation API ⚡
Untuk push artikel dari sistem eksternal (WordPress, custom CMS, dll). Menggunakan
header `x-api-key` dan berjalan sebagai Edge Function di Supabase — **bukan** di
domain `cms.carubra.com`. `POST` belum berfungsi di produksi (lihat peringatan di atas).

---

## Public Read API

API key dibuat per website pada menu **API Keys**. Tenant ditentukan otomatis dari key dan API hanya mengembalikan artikel berstatus `published`.

### Endpoint

#### Daftar artikel

```http
GET /api/v1/articles?category=teknologi&page=1&limit=10
x-artikel-key: ak_live_xxxxxxxxx
```

- `category`: slug kategori, wajib.
- `page`: mulai dari 1, default 1.
- `limit`: default 10, maksimum 50.
- Response: `{ data: Article[], meta: { page, limit, total } }`.

#### Detail artikel

```http
GET /api/v1/articles/judul-artikel
x-artikel-key: ak_live_xxxxxxxxx
```

Response: `{ data: Article }`. Detail menyertakan `content`, `canonical_url`, `robots`, dan `og_image_path`.

---

## Automation API ⚡

**Base URL:** `https://supabase.carubra.com/functions/v1/automation-api`

API untuk push artikel dari sistem eksternal ke CMS Artikel secara otomatis. Mendukung create dan update artikel dengan single endpoint.

### Endpoint

```http
GET  /functions/v1/automation-api      # verifikasi key, tidak menulis apa pun
POST /functions/v1/automation-api      # upsert artikel
x-api-key: ak_live_xxxxxxxxx
Content-Type: application/json
```

`GET` mengembalikan `{ success, site: { id, name, domain }, message }`. Pakai ini
lebih dulu untuk memisahkan masalah autentikasi dari masalah payload.

### Request Body

```json
{
  "external_id": "wp-12345",
  "title": "Judul Artikel",
  "slug": "judul-artikel",
  "content": "<p>Konten artikel HTML</p>",
  "excerpt": "Ringkasan singkat",
  "category_name": "Teknologi",
  "status": "draft",
  "meta_description": "Meta description",
  "featured_image": "sites/nama-site/articles/cover.jpg",
  "published_at": "2026-09-10T10:00:00Z"
}
```

### Required Fields

- `external_id` - ID unik dari sistem eksternal (contoh: `wp-12345`), unik per site
- `title` - Judul artikel
- `slug` - URL slug. **Tidak dibangkitkan otomatis**; unik per site
- `content` - Konten artikel (HTML)
- `category_name` - Nama kategori; dibuat otomatis bila belum ada

### Optional Fields

- `excerpt` - Ringkasan artikel
- `status` - `draft`, `review`, `scheduled`, `published`, `archived` (default: `draft`)
- `published_at` - ISO 8601. Diisi otomatis `now()` bila `status='published'` dan field ini kosong
- `meta_description` - Meta description
- `featured_image` - **Path storage**, bukan URL eksternal

### Field yang diabaikan

Dikirim boleh, tersimpan tidak: `tags`, `featured_image_url`, `category_id`,
`seo_title`, `canonical_url`, `robots`, `og_image_url`. API tidak menolaknya dan
tidak memberi peringatan — nilainya hilang diam-diam. Versi lama dokumen ini
mencantumkan semuanya sebagai field yang didukung.

`meta_keywords` diterima RPC demi kompatibilitas tanda tangan fungsi, tetapi tidak
punya kolom tujuan.

### Response

**Success (200)** — `data` berupa **array**, karena RPC memakai `RETURNS TABLE`:

```json
{
  "success": true,
  "site": { "id": "…uuid…", "name": "Nama Website" },
  "data": [
    {
      "article_id": "…uuid…",
      "revision_id": "…uuid…",
      "created_new": true,
      "category_id": "…uuid…"
    }
  ]
}
```

Baca `data[0].article_id`, bukan `data.article_id`.

**Error (400/401/500):**
```json
{ "error": "Missing required fields: slug, category_name" }
```

Bentuknya selalu datar: satu kunci `error` berisi string. Tidak ada `details`,
tidak ada kode error mesin.

### Cara Kerja

1. **Upsert Logic**: artikel dicocokkan lewat `(site_id, external_id)`. Sudah ada → update, belum → buat baru. `created_new` di respons membedakannya.
2. **Category Handling**: `category_name` dicocokkan tanpa memandang kapitalisasi; dibuat otomatis bila belum ada.
3. **Revisi**: setiap panggilan menambah satu baris `article_revisions` dengan `version` berikutnya.
4. **Author Assignment**: penulis artikel = `api_keys.created_by`, yaitu user yang menerbitkan API key. User itu **wajib** punya peran aktif di site tujuan (`artikel.user_roles`, `is_active = true`); kalau tidak, RPC menolak dengan `Author ... is not an active member of site ...`. Versi lama dokumen ini menyebut "user pertama dengan role writer/editor" — tidak pernah begitu.

### Contoh Integrasi

#### WordPress Plugin

```php
function push_to_artikel_cms($post_id) {
    $post = get_post($post_id);
    
    $categories = get_the_category($post_id);

    $payload = [
        'external_id'   => 'wp-' . $post_id,
        'title'         => $post->post_title,
        'slug'          => $post->post_name,          // wajib, tidak auto-generate
        'content'       => $post->post_content,
        'excerpt'       => $post->post_excerpt,
        'category_name' => $categories ? $categories[0]->name : 'Uncategorized',
        'status'        => $post->post_status === 'publish' ? 'published' : 'draft',
        'published_at'  => $post->post_date_gmt,
    ];
    
    $response = wp_remote_post(
        'https://supabase.carubra.com/functions/v1/automation-api',
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
  slug: string;
  content: string;
  categoryName: string;
  excerpt?: string;
  status?: "draft" | "review" | "scheduled" | "published" | "archived";
}) {
  const response = await fetch(
    'https://supabase.carubra.com/functions/v1/automation-api',
    {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ARTIKEL_AUTOMATION_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_id: article.externalId,
        title: article.title,
        slug: article.slug,
        content: article.content,
        category_name: article.categoryName,
        excerpt: article.excerpt,
        status: article.status ?? "draft",
      }),
    }
  );

  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(error);
  }

  const { data } = await response.json();
  return data[0]; // RETURNS TABLE: { article_id, revision_id, created_new, category_id }
}
```

#### Python

```python
import os
import requests

def push_to_artikel_cms(article):
    payload = {
        'external_id':   article['external_id'],
        'title':         article['title'],
        'slug':          article['slug'],           # wajib
        'content':       article['content'],
        'category_name': article['category_name'],  # wajib
        'excerpt':       article.get('excerpt'),
        'status':        article.get('status', 'draft'),
    }

    response = requests.post(
        'https://supabase.carubra.com/functions/v1/automation-api',
        headers={
            'x-api-key': os.getenv('ARTIKEL_AUTOMATION_KEY'),
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=30
    )

    if response.status_code != 200:
        raise RuntimeError(response.json().get('error', 'unknown error'))

    # data adalah list (RPC RETURNS TABLE)
    return response.json()['data'][0]
```

---

## Error dan Rate Limit

Kedua API punya bentuk error dan perilaku rate limit yang **berbeda**. Versi lama
dokumen ini menyajikan tabel Public Read API seolah berlaku untuk keduanya.

### Public Read API (`x-artikel-key`)

| HTTP | Code | Arti |
|---:|---|---|
| 400 | `INVALID_REQUEST` | Parameter tidak valid |
| 401 | `INVALID_API_KEY` | Key kosong, salah, expired, atau revoked |
| 403 | `SITE_INACTIVE` | Website tidak aktif |
| 404 | `NOT_FOUND` | Artikel tidak ditemukan atau belum published |
| 429 | `RATE_LIMITED` | Batas request tercapai |
| 500 | `INTERNAL_ERROR` | Kesalahan server |

Header rate limit: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`, dan `Retry-After`. Default: 120 request per 60 detik per key
(`ARTIKEL_RATE_LIMIT_REQUESTS` / `ARTIKEL_RATE_LIMIT_WINDOW_SECONDS`).

### Automation API (`x-api-key`)

Error selalu `{"error": "<pesan>"}` — tanpa kode mesin.

| HTTP | Arti |
|---:|---|
| 400 | Field wajib kurang, JSON tidak valid, atau `status` tidak dikenal |
| 401 | Key kosong, salah, dicabut, kedaluwarsa, atau site nonaktif |
| 429 | Batas request tercapai |
| 500 | Pepper belum ter-set, migrasi RPC belum diterapkan, atau slug bentrok |

Rate limit **aktif**: default 120 request per 60 detik per API key, dengan header
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, dan
`Retry-After` pada respons `429`. Diverifikasi pada function yang live
28 September 2026. Batas diatur lewat `ARTIKEL_RATE_LIMIT_REQUESTS` dan
`ARTIKEL_RATE_LIMIT_WINDOW_SECONDS` di container Edge Function.

---

## Deployment API

Prasyarat: Docker, Docker Compose, Supabase self-hosted aktif, network `carubra-network` dan `buzzerhood-network`, serta `.env.production` lengkap.

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.carubra.com
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ARTIKEL_API_KEY_PEPPER=...
ARTIKEL_RATE_LIMIT_REQUESTS=120
ARTIKEL_RATE_LIMIT_WINDOW_SECONDS=60
CMS_CANONICAL_HOST=cms.carubra.com
```

`ARTIKEL_API_KEY_PEPPER` harus ter-set di **dua tempat** dengan nilai identik:
aplikasi Next.js (untuk menerbitkan key) dan container `functions` Supabase
(untuk memverifikasinya). Kalau berbeda, setiap key ditolak `401` — key di-hash
dengan pepper milik penerbit, lalu diverifikasi dengan pepper milik function.

Variabel rate limit berlaku untuk **kedua** API; keduanya default 120/60 bila
tidak di-set.

### Deploy Next.js App (Public Read API & CMS)

> ⚠️ **Jangan SSH untuk ini.** Aplikasi berjalan di **workstation**, bukan di
> `20.20.20.173`. Direktori `~/apps/cms-artikel` di server sudah dihapus
> 28 September 2026 — snippet lama di tempat ini menyuruh deploy ke sana dan
> membuat dua deploy mendarat di container tanpa trafik selama 16 hari.
> Lihat `docs/DEPLOYMENT-CMS.md`.

Dijalankan di root repo, **di workstation**:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

Skrip itu menandai image rollback, build, memeriksa matcher middleware di dalam
image, menukar container, lalu memverifikasi gerbang auth lewat domain publik.

Manual:

```bash
docker tag cms-artikel-cms-artikel cms-artikel-cms-artikel:rollback-$(date +%F)
docker compose build
docker compose up -d
docker logs cms-artikel --tail 100
```

Container meneruskan `127.0.0.1:3002` ke port aplikasi `3000`; `cloudflared-tunnel`
di workstation yang mengekspos ke `cms.carubra.com` lewat `carubra-network`.

Verifikasi **wajib lewat `https://cms.carubra.com`** — bukan `127.0.0.1:3002`.

### Deploy Automation API (Edge Function)

Menyalin file saja **tidak cukup**. Function butuh `ARTIKEL_API_KEY_PEPPER` di
environment container; tanpa itu ia gagal-aman dan menjawab
`500 {"error":"Automation API is not configured"}` untuk setiap request.

> ⚠️ **Periksa versi sebelum menyalin.** File yang live di server pernah lebih
> baru daripada yang ada di branch kerja — menyalin membabi buta akan
> **menurunkan versi** produksi (misalnya menghapus rate limit yang sudah
> terpasang). Selalu `diff` dulu dan backup file yang sedang live:
>
> ```bash
> cd ~/docker/supabase/supabase-1.26.05/docker/volumes/functions/automation-api
> cp index.ts index.ts.bak-$(date +%F)
> diff -u index.ts /path/ke/repo/supabase/functions/automation-api/index.ts
> ```
>
> Kalau file live punya baris yang tidak ada di repo, selesaikan dulu selisihnya
> di repo — jangan timpa.

Periksa konfigurasi yang sedang berjalan sebelum mengubah apa pun:

```bash
ssh maskhar@supabase-server
cd ~/docker/supabase/supabase-1.26.05/docker
docker compose config
docker compose ps
```

**1. Set pepper** — nilainya harus **persis sama** dengan `ARTIKEL_API_KEY_PEPPER`
di `.env.production` aplikasi Next.js. Hash key dihitung sebagai
SHA-256 dari `"<key mentah>:<pepper>"` di kedua sisi; nilai yang berbeda membuat
semua key ditolak `401`.

Tambahkan ke `.env` Supabase Docker, lalu teruskan ke service `functions` pada
`docker-compose.yml` (pertahankan variabel lain yang sudah ada di sana):

```yaml
  functions:
    environment:
      ARTIKEL_API_KEY_PEPPER: ${ARTIKEL_API_KEY_PEPPER}
```

**2. Salin function dan jalankan ulang:**

```bash
cp -r ~/cms-artikel/supabase/functions/automation-api volumes/functions/

# 'restart' tidak memuat ulang environment — perlu recreate container
docker compose up -d functions

# Verify
docker compose logs functions --tail=50
ls -la volumes/functions/automation-api/
```

**3. Verifikasi pepper benar-benar terbaca** (harus 200, bukan 500):

```bash
curl -i -H "x-api-key: $AUTOMATION_KEY" \
  "https://supabase.carubra.com/functions/v1/automation-api"
```

### Apply Database Migrations

`POST` juga butuh RPC yang benar. Dua migrasi berikut **wajib** diterapkan, dan
**urutannya penting** — `202609190001` menulis ulang
`artikel.validate_article_write` tanpa dukungan aktor otomasi, jadi harus
diterapkan lebih dulu:

1. `202609100020_create_upsert_automation_article_function.sql` (versi perbaikan)
2. `202609190001_security_hardening.sql`
3. `202609280001_automation_article_actor.sql`

Kalau `202609280001` tidak diterapkan terakhir, `POST` dengan status selain
`draft` gagal dengan `New articles must start as draft`.

```bash
ssh maskhar@supabase-server

# Option 1: Direct psql
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < migration.sql

# Option 2: Via Supabase Studio
# Access https://supabase.carubra.com
# Go to SQL Editor → Execute migration
```

Verifikasi fungsi aktor sudah ada:

```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "\df artikel.current_article_actor"
```

Verifikasi:

```bash
# Test Public Read API
curl -i "https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=10" \
  -H "x-artikel-key: ak_live_xxxxxxxxx"

# Test Automation API — GET dulu, tidak menulis apa pun
curl -i "https://supabase.carubra.com/functions/v1/automation-api" \
  -H "x-api-key: ak_live_xxxxxxxxx"

# POST (menulis artikel sungguhan — jangan ke site produksi)
curl -X POST "https://supabase.carubra.com/functions/v1/automation-api" \
  -H "x-api-key: ak_live_xxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"external_id":"test-001","title":"Test","slug":"test-001","content":"<p>Test</p>","category_name":"Test"}'
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
define('ARTIKEL_API_KEY', 'ak_live_xxxxxxxxx');

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
- Gunakan key terpisah untuk staging dan production. Semua key berawalan
  `ak_live_`; yang membedakan environment adalah site tujuan dan label, bukan
  bentuk key-nya.
- Gunakan key berbeda untuk Public Read API (`x-artikel-key`) dan Automation API
  (`x-api-key`) meski format key-nya sama — supaya bisa dicabut terpisah.
- Rotasi key berkala lewat tombol **Rotasi**: nilai baru terbit, nilai lama
  langsung mati. Karena tidak ada masa tumpang tindih, perbarui konsumen segera
  setelah rotasi.
- Gunakan HTTPS dan batasi akses dashboard CMS.
- Automation API key harus disimpan di server-side saja, tidak boleh di frontend.
  Key ini bisa menulis artikel; Public Read API hanya membaca.
- `ARTIKEL_API_KEY_PEPPER` adalah rahasia runtime. Bocornya pepper membuat
  `secret_hash` di database bisa di-brute force — perlakukan setara service role key.
- Jejak pemakaian yang tersedia hanya `api_keys.last_used_at`. Tidak ada log
  per-request untuk Automation API.

---

## Troubleshooting

### Automation API

**`500 {"error":"Automation API is not configured"}`**
- `ARTIKEL_API_KEY_PEPPER` tidak ter-set di container `functions`. Lihat
  [Deploy Automation API](#deploy-automation-api-edge-function). Function
  gagal-aman — ini bukan auth bypass.

**`401 {"error":"Invalid or inactive API key"}`**
- Tidak ada "scope" pada API key — hanya ada satu jenis key. Yang membedakan
  Automation dari Public Read adalah header dan endpoint.
- Pastikan memakai header `x-api-key` (bukan `x-artikel-key`)
- Pastikan yang dikirim nilai penuh key, bukan `key_prefix` yang tampil di UI
- Key sah bila `revoked_at IS NULL` dan `expires_at` kosong/masih di masa depan.
  Tidak ada kolom `is_active` pada `artikel.api_keys`:

  ```bash
  docker exec -i supabase-db psql -U postgres -d postgres \
    -c "select label, key_prefix, expires_at, revoked_at from artikel.api_keys order by created_at desc limit 10;"
  ```
- Pepper di container `functions` berbeda dengan milik aplikasi → semua key ditolak

**`400 {"error":"Missing required fields: ..."}`**
- Pesan menyebut field yang kurang. Wajib: `external_id`, `title`, `slug`,
  `content`, `category_name`. Yang paling sering terlewat: `slug` dan
  `category_name` — keduanya tidak dibangkitkan otomatis.

**`500` pada `POST` padahal `GET` berhasil**
- Migrasi RPC belum diterapkan (lihat Apply Database Migrations), **atau**
- `slug` bentrok dengan artikel lain di site yang sama (`articles(site_id, slug)` unik)
- Cek log: `docker compose logs functions --tail=100`

**`Author ... is not an active member of site ...`**
- User pada `api_keys.created_by` tidak punya peran aktif di site tujuan.
  Aktifkan perannya di menu Team, atau terbitkan ulang key dengan akun yang berperan.

**Article tidak muncul di dashboard**
- Ambil `data[0].article_id` dari respons — kalau ada, artikel benar-benar tersimpan
- Pastikan melihat website yang sama dengan pemilik key (`GET` menyebut namanya)
- Periksa semua status, bukan hanya Draft

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

# Test Automation API — GET tidak menulis apa pun, aman untuk health check
curl -i "https://supabase.carubra.com/functions/v1/automation-api" \
  -H "x-api-key: ak_live_xxxxxxxxx"
```

Jangan pakai `POST` sebagai health check: setiap panggilan membuat atau
memperbarui artikel sungguhan.

---

**Last updated:** 28 September 2026
