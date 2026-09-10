# Deployment CMS dan Integrasi Website Tenant

> Status 10 September 2026: integrasi tenant read-only `/api/v1/*` tetap aktif. Endpoint automation tulis `artikel-cms` adalah jalur terpisah dan tidak boleh mengekspos `SUPABASE_SERVICE_ROLE_KEY` ke tenant.

**Versi:** 10 September 2026  
**CMS canonical:** `https://cms.carubra.com`  
**Supabase:** `https://supabase.carubra.com`  
**Public API:** `https://cms.carubra.com/api/v1`

Dokumen ini menjadi runbook deployment CMS Docker, pendaftaran tenant, alias CMS, pembuatan API key, dan konsumsi artikel dari website tenant.

## 1. Arsitektur

```text
cms.carubra.com ───────────────┐
cms.uteroindonesia.com ────────┼─ tunnel/reverse proxy ─ cms-artikel:3000
cms.buzzerhood.com ────────────┘
                                         │
                                         ▼
                              supabase.carubra.com
                              PostgreSQL schema artikel

uteroindonesia.com ─┐
buzzerhood.com ─────┼─ HTTPS + X-Artikel-Key ─ cms.carubra.com/api/v1
website tenant lain ┘
```

- Satu container CMS melayani seluruh alias CMS.
- Seluruh tenant memakai database dan schema `artikel` yang sama.
- Tenant dipisahkan melalui `artikel.sites`, `site_id`, API key per site, dan RLS.
- Hostname CMS hanya menentukan alias dan website default. Hostname bukan batas keamanan.
- Website tenant tidak perlu mengakses PostgreSQL atau Supabase secara langsung.
- API key otomatis menentukan `site_id`; client tidak mengirim `site_id` pada public API.

## 2. Prasyarat Production

- Docker Engine dan Docker Compose tersedia pada host CMS.
- Supabase self-hosted aktif di `https://supabase.carubra.com`.
- Migration schema `artikel`, RLS, Storage, rate limit, audit log, dan CMS hostname sudah diterapkan.
- Bucket Storage `artikel-media` tersedia dengan policy yang sesuai.
- Tunnel atau reverse proxy dapat meneruskan hostname ke `127.0.0.1:3000`.
- Backup PostgreSQL dan Supabase Storage sudah dijadwalkan dan restore pernah diuji.
- Lima external Docker network pada `docker-compose.cms.yml` sudah tersedia bila memang dipakai oleh service lain.

## 3. Environment Production

Salin `.env.example` menjadi `.env.production` pada server CMS:

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.carubra.com
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=isi_publishable_key
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key
ARTIKEL_API_KEY_PEPPER=isi_random_secret_panjang
ARTIKEL_RATE_LIMIT_REQUESTS=120
ARTIKEL_RATE_LIMIT_WINDOW_SECONDS=60
CMS_CANONICAL_HOST=cms.carubra.com
CMS_PORT=3000
```

Aturan secret:

- Jangan commit `.env.production`.
- Jangan menaruh `SUPABASE_SERVICE_ROLE_KEY` pada browser atau website tenant.
- Jangan mengganti `ARTIKEL_API_KEY_PEPPER` tanpa rencana rotasi seluruh API key. Hash key lama akan tidak cocok setelah pepper berubah.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` boleh masuk bundle browser CMS.
- Public API key tenant tetap rahasia dan hanya disimpan pada environment server website tenant.

Generate pepper:

```bash
openssl rand -hex 32
```

## 4. Persiapan Docker Network

Compose memakai external network berikut:

```text
carubra-network
buzzerhood-network
soundpub-network
placers-network
maskhar-network
```

Periksa network:

```bash
docker network inspect carubra-network
docker network inspect buzzerhood-network
docker network inspect soundpub-network
docker network inspect placers-network
docker network inspect maskhar-network
```

Buat hanya network yang memang belum tersedia:

```bash
docker network create carubra-network
docker network create buzzerhood-network
docker network create soundpub-network
docker network create placers-network
docker network create maskhar-network
```

Jangan menghapus atau membuat ulang network yang sedang dipakai container lain.

## 5. Deployment Pertama

Jalankan dari direktori repository CMS:

```bash
git pull
cp .env.example .env.production
nano .env.production
docker compose --env-file .env.production -f docker-compose.cms.yml build
docker compose --env-file .env.production -f docker-compose.cms.yml up -d
docker compose --env-file .env.production -f docker-compose.cms.yml ps
docker compose --env-file .env.production -f docker-compose.cms.yml logs --tail=100 cms-artikel
```

Container hanya bind ke loopback:

```text
127.0.0.1:${CMS_PORT:-3000}:3000
```

Jangan membuka port `3000` langsung ke internet. Publikasikan CMS melalui tunnel atau reverse proxy HTTPS.

Health check internal:

```bash
curl -I http://127.0.0.1:3000/login
```

Health check publik:

```bash
curl -I https://cms.carubra.com/login
```

## 6. Tunnel dan Alias CMS

Semua alias menunjuk origin sama:

```text
cms.carubra.com              → http://127.0.0.1:3000
cms.uteroindonesia.com       → http://127.0.0.1:3000
cms.buzzerhood.com           → http://127.0.0.1:3000
```

Tunnel harus meneruskan header `Host` atau `X-Forwarded-Host`.

Pendaftaran alias:

1. Login melalui `https://cms.carubra.com`.
2. Buka **CMS Domains**.
3. Masukkan hostname, nama tampilan, dan website default opsional.
4. Tambahkan hostname yang sama pada tunnel.
5. Buka alias CMS dan login ulang bila browser belum mempunyai cookie untuk domain tersebut.

Satu user dapat login dari alias mana pun. Hak akses tetap berasal dari Supabase Auth dan `artikel.user_roles`.

## 7. Membuat Tenant Baru

Contoh tenant `uteroindonesia.com`:

1. Buka **Website** pada CMS.
2. Buat website:
   - Nama: `Utero Indonesia`
   - Domain: `uteroindonesia.com`
   - Slug: `utero-indonesia`
3. Pilih tenant tersebut dan buat kategori.
4. Buka **Tag** dan buat tag sesuai kebutuhan tenant.
5. Buat akun pada Supabase Auth.
6. Buka **Tim dan Role** lalu beri role `editor` atau `writer` untuk tenant tersebut.
7. Opsional: daftarkan `cms.uteroindonesia.com` pada **CMS Domains**.
8. Buat API key production pada **API Keys** untuk tenant tersebut.
9. Simpan key saat tampil. Nilai penuh tidak dapat dilihat lagi.

Jangan memakai satu API key untuk beberapa tenant. Satu key selalu terikat ke satu `site_id`.

## 8. Konfigurasi Website Tenant

Tambahkan pada environment server website tenant:

```env
ARTIKEL_API_URL=https://cms.carubra.com/api/v1
ARTIKEL_API_KEY=ak_live_xxxxxxxxxxxxxxxxx
```

Jangan memakai environment berawalan `NEXT_PUBLIC_`, `VITE_`, atau nama lain yang mengirim key ke browser.

Semua request wajib membawa:

```http
X-Artikel-Key: ak_live_xxxxxxxxxxxxxxxxx
```

Key tenant Utero hanya menerima artikel published milik Utero. Key Buzzerhood hanya menerima artikel published milik Buzzerhood.

## 9. Endpoint Public API

### Daftar artikel

```http
GET /api/v1/articles?category=teknologi&page=1&limit=10
X-Artikel-Key: ak_live_...
```

Parameter:

| Parameter | Wajib | Keterangan |
| --- | --- | --- |
| `category` | Ya | Slug kategori tenant. |
| `page` | Ya | Nomor halaman, mulai dari `1`. |
| `limit` | Ya | Jumlah item. Maksimum `50`. |

Contoh:

```bash
curl --request GET \
  --url 'https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=10' \
  --header 'X-Artikel-Key: ak_live_xxxxxxxxxxxxxxxxx'
```

Response pagination:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0
  }
}
```

### Detail artikel

```http
GET /api/v1/articles/{slug}
X-Artikel-Key: ak_live_...
```

Contoh:

```bash
curl --request GET \
  --url 'https://cms.carubra.com/api/v1/articles/cara-memilih-produk' \
  --header 'X-Artikel-Key: ak_live_xxxxxxxxxxxxxxxxx'
```

Detail memuat artikel published tenant pemilik key, konten HTML, SEO fields, kategori, tag, dan path media bila tersedia.

## 10. Implementasi Next.js Tenant

Buat wrapper server-side:

```ts
const API_URL = process.env.ARTIKEL_API_URL!;
const API_KEY = process.env.ARTIKEL_API_KEY!;

async function artikelFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "X-Artikel-Key": API_KEY,
      Accept: "application/json",
    },
    next: { revalidate: 60 },
  });

  if (response.status === 404) throw new Error("NOT_FOUND");
  if (response.status === 429) {
    throw new Error(`RATE_LIMITED:${response.headers.get("retry-after") ?? "60"}`);
  }
  if (!response.ok) throw new Error(`ARTIKEL_API_ERROR:${response.status}`);
  return response.json() as Promise<T>;
}
```

Daftar artikel:

```ts
type ArticleListResponse = {
  data: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    published_at: string;
  }>;
  meta: { page: number; limit: number; total: number };
};

export function getArticles(category: string, page = 1) {
  const query = new URLSearchParams({ category, page: String(page), limit: "10" });
  return artikelFetch<ArticleListResponse>(`/articles?${query}`);
}
```

Detail artikel:

```ts
export function getArticle(slug: string) {
  return artikelFetch<{ data: Record<string, unknown> }>(`/articles/${encodeURIComponent(slug)}`);
}
```

Jalankan request dari Server Component, Route Handler, atau backend. Jangan memanggil public API langsung dari Client Component karena API key akan terlihat di browser.

## 11. Implementasi PHP Tenant

```php
<?php

$baseUrl = rtrim(getenv('ARTIKEL_API_URL'), '/');
$apiKey = getenv('ARTIKEL_API_KEY');
$category = rawurlencode('teknologi');

$curl = curl_init("{$baseUrl}/articles?category={$category}&page=1&limit=10");
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "X-Artikel-Key: {$apiKey}",
        'Accept: application/json',
    ],
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 10,
]);

$body = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$error = curl_error($curl);
curl_close($curl);

if ($body === false || $error) {
    throw new RuntimeException("Artikel API connection error: {$error}");
}

if ($status !== 200) {
    throw new RuntimeException("Artikel API returned HTTP {$status}");
}

$payload = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
```

Simpan hasil pada cache aplikasi agar halaman tenant tidak meminta CMS pada setiap page view.

## 12. Rendering Konten dan Media

- Field `content` berisi HTML dari rich-text editor.
- Sanitasi HTML sebelum render pada website tenant.
- Jangan mengizinkan script, event handler HTML, iframe liar, atau URL berbahaya.
- Terapkan style tipografi tenant pada wrapper konten, bukan dengan mengubah HTML sumber.
- `featured_image_path` dan `og_image_path` adalah path object Storage, bukan jaminan URL publik.
- Bila bucket private, URL harus dibuat melalui mekanisme signed URL pada backend tepercaya.
- Jangan menaruh `SUPABASE_SERVICE_ROLE_KEY` pada website tenant hanya untuk membuat signed URL. Lebih aman menambahkan endpoint media/signed URL pada CMS bila dibutuhkan.

## 13. Rate Limit dan Cache

Default:

```text
120 request / 60 detik / API key
```

Header response:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 119
X-RateLimit-Reset: 1789000000
```

Saat limit habis:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

Rekomendasi tenant:

- Cache daftar artikel selama `30–300` detik.
- Cache detail berdasarkan slug.
- Gunakan stale content ketika CMS sementara tidak tersedia.
- Retry hanya untuk `429` dan `5xx`, maksimum beberapa kali dengan exponential backoff.
- Jangan retry `401`, `403`, atau `404` secara agresif.

## 14. Error API

| HTTP | Code | Tindakan |
| --- | --- | --- |
| `401` | `INVALID_API_KEY` | Periksa key, expiry, revoke, dan environment deployment. |
| `403` | `SITE_INACTIVE` | Aktifkan tenant atau hubungi admin CMS. |
| `404` | `NOT_FOUND` | Tampilkan halaman 404 tenant. |
| `429` | `RATE_LIMITED` | Tunggu sesuai `Retry-After`, lalu gunakan cache. |
| `500` | `INTERNAL_ERROR` | Retry terbatas, gunakan stale cache, dan periksa log CMS. |

Format error:

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API key tidak valid atau telah kedaluwarsa."
  }
}
```

## 15. Rotasi API Key Tanpa Downtime

Implementasi sekarang langsung revoke key lama saat tombol rotasi dijalankan. Gunakan urutan berikut:

1. Jadwalkan maintenance singkat atau siapkan perubahan environment tenant.
2. Rotasi key dari CMS.
3. Salin key baru segera.
4. Ganti `ARTIKEL_API_KEY` pada website tenant.
5. Redeploy atau restart website tenant.
6. Jalankan smoke test API.

Karena key lama langsung tidak berlaku, proses ini belum mendukung overlap dua key. Untuk zero-downtime penuh, buat key kedua baru sebagai pengganti sebelum revoke key lama.

## 16. Update Deployment CMS

```bash
git pull
docker compose --env-file .env.production -f docker-compose.cms.yml build
docker compose --env-file .env.production -f docker-compose.cms.yml up -d
docker compose --env-file .env.production -f docker-compose.cms.yml ps
docker compose --env-file .env.production -f docker-compose.cms.yml logs --tail=100 cms-artikel
```

Jalankan migration database secara terpisah dan uji pada staging lebih dahulu. Jangan menjalankan migration destructive bersamaan dengan build container tanpa backup.

## 17. Rollback

1. Catat commit aplikasi yang sedang sehat.
2. Checkout commit tersebut.
3. Build ulang image.
4. Jalankan Compose kembali.
5. Verifikasi login dan public API.

```bash
git checkout <commit-sehat>
docker compose --env-file .env.production -f docker-compose.cms.yml build
docker compose --env-file .env.production -f docker-compose.cms.yml up -d
```

Rollback aplikasi tidak otomatis me-rollback migration database. Migration rollback harus dirancang dan diuji terpisah.

## 18. Checklist Tenant Go-Live

- [ ] Tenant dibuat pada menu **Website**.
- [ ] Kategori dan tag tenant tersedia.
- [ ] User Auth dan role tenant sudah benar.
- [ ] Artikel uji melewati submit, approve, dan publish.
- [ ] API key production dibuat dan disimpan server-side.
- [ ] Request daftar artikel hanya mengembalikan tenant yang benar.
- [ ] Slug tenant lain menghasilkan `404`.
- [ ] Cache dan fallback website tenant aktif.
- [ ] HTML artikel disanitasi.
- [ ] Featured image dan OG image diuji.
- [ ] Respons `401`, `404`, `429`, dan `500` ditangani.
- [ ] API key tidak muncul pada source browser, log publik, atau analytics.
- [ ] Alias CMS dan tunnel diuji bila tenant memakai white-label CMS.

## 19. Smoke Test

```bash
curl -i \
  'https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=1' \
  -H 'X-Artikel-Key: ak_live_xxxxxxxxxxxxxxxxx'
```

Verifikasi:

- Status `200`.
- Header rate limit tersedia.
- Response hanya berisi artikel published tenant pemilik key.
- Key tenant A tidak dapat membaca artikel tenant B.
- Request tanpa key menghasilkan `401`.

## 20. Operasional

Perintah penting:

```bash
docker compose --env-file .env.production -f docker-compose.cms.yml ps
docker compose --env-file .env.production -f docker-compose.cms.yml logs -f cms-artikel
docker compose --env-file .env.production -f docker-compose.cms.yml restart cms-artikel
```

Pantau:

- Health container.
- Error `401`, `403`, `429`, dan `500`.
- Pemakaian API key melalui `last_used_at`.
- Expiry API key.
- Ukuran PostgreSQL dan Storage.
- Hasil backup dan uji restore.
- Audit log perubahan artikel, role, tenant, dan API key.
