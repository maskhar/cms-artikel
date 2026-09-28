# Automation API - Panduan Penggunaan di Dashboard

**Last updated:** 28 September 2026

Panduan lengkap untuk mengelola dan menggunakan Automation API dari dashboard CMS Artikel.

> ⚠️ **`POST` masih 500 di produksi saat ini.** Penyebabnya bukan dokumen ini:
> `ARTIKEL_API_KEY_PEPPER` belum ter-set di container Edge Function, dan migrasi
> perbaikan RPC (`202609100014` versi baru + `202609280001`) belum diterapkan ke
> produksi. `GET` (verifikasi key) berfungsi normal. Peringatan ini dicabut setelah
> produksi benar-benar diperbaiki.
>
> Dokumen ini disamakan dengan kontrak nyata pada 28 September 2026. Versi
> sebelumnya menyebut prefix key `aut_live_`, host `supabase.maskhar.net`, form
> "Scope: Automation", sinkronisasi `tags`, dan rate limit 120 req/60s — tak satu
> pun dari itu ada.

---

## 📋 Daftar Isi

1. [Apa itu Automation API?](#apa-itu-automation-api)
2. [Membuat API Key](#membuat-api-key)
3. [Testing API](#testing-api)
4. [Monitoring & Audit](#monitoring--audit)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Apa itu Automation API?

Automation API memungkinkan Anda untuk **push artikel dari sistem eksternal** (WordPress, custom CMS, aplikasi lain) ke CMS Artikel secara otomatis.

### Fitur Utama

- ✅ **Upsert Logic**: Create artikel baru atau update yang sudah ada dengan `external_id`
- ✅ **Auto Category**: Buat kategori otomatis jika belum ada (cocok tanpa memandang kapitalisasi)
- ✅ **Status Control**: `draft`, `review`, `scheduled`, `published`, `archived`
- ✅ **Revisi otomatis**: setiap panggilan menambah satu baris `article_revisions`
- ✅ **Multi-tenant**: Otomatis scope ke website yang benar berdasarkan API key

**Tidak ada sinkronisasi tag.** Versi lama dokumen ini menjanjikan "Tag Sync";
Automation API tidak pernah memproses field `tags` — nilainya diabaikan diam-diam.
Kelola tag lewat CMS.

### Kapan Menggunakan Automation API?

**Gunakan Automation API jika:**
- Anda ingin sync artikel dari WordPress ke CMS Artikel
- Anda punya custom CMS dan ingin push artikel ke sini
- Anda ingin automate content publishing dari berbagai sumber
- Anda ingin integrate dengan content pipeline Anda

**Jangan gunakan jika:**
- Anda hanya ingin membaca artikel (gunakan Public Read API)
- Anda ingin manage artikel manual via dashboard (gunakan CMS UI)

---

## Membuat API Key

> **Tidak ada pilihan scope.** CMS ini hanya punya satu jenis API key. Key yang
> sama dipakai Public Read API (header `x-artikel-key`) dan Automation API
> (header `x-api-key`); yang membedakan hanya header dan endpoint, bukan
> key-nya. Versi lama dokumen ini menyuruh memilih scope "Automation" — form itu
> tidak pernah ada.

### Step 1: Akses Menu API Keys

1. Login ke dashboard CMS: `https://cms.carubra.com`
2. Klik menu **"API keys"** di sidebar (`https://cms.carubra.com/api-keys`)

### Step 2: Generate API key

Isi form **Generate API key** di panel kanan:

| Field | Wajib | Keterangan |
|---|---|---|
| **Website** | Ya | Menentukan tenant tujuan. Artikel yang di-push key ini selalu masuk ke website ini. |
| **Label** | Ya | 2–80 karakter. Contoh: `WordPress Production`. |
| **Expiry** | Tidak | Harus di masa depan bila diisi. Kosongkan untuk key tanpa kedaluwarsa. |

Klik **Generate key**.

### Step 3: Salin API key

⚠️ **PENTING:** nilai penuh key hanya ditampilkan **SEKALI**, di panel kuning
"Simpan key sekarang" tepat di atas daftar key. Setelah halaman di-reload, yang
tersisa hanya `key_prefix` (15 karakter pertama) — nilai penuhnya di-hash dan
tidak dapat diambil kembali dari database.

Bentuk key: `ak_live_` + 32 karakter base64url, misalnya
`ak_live_ZmFrZS1jb250b2gtYnVrYW4ta2V5`.

Kalau key hilang, pakai tombol **Rotasi** pada key tersebut: nilai baru terbit,
nilai lama langsung tidak berlaku, dan record key tetap sama.

### Step 4: Simpan di Sistem Eksternal

Simpan API key sebagai environment variable di sistem yang akan push artikel:

**WordPress (wp-config.php):**
```php
define('ARTIKEL_AUTOMATION_KEY', 'ak_live_xxxxxxxxxxxxxxxxxxxxxxxx');
```

**Node.js (.env):**
```env
AUTOMATION_API_KEY=ak_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

**Python (.env):**
```env
AUTOMATION_API_KEY=ak_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Alternatif: lewat API

Perlu sesi login CMS (cookie), bukan API key:

```bash
curl -X POST "https://cms.carubra.com/api/cms/api-keys" \
  -H "Content-Type: application/json" \
  -H "Cookie: $CMS_SESSION_COOKIE" \
  -d '{"siteId":"<uuid website>","label":"WordPress Production"}'
```

Respons `201` memuat `data.key` — nilai mentah, hanya dikirim sekali.

### Jangan buat API key lewat SQL

`artikel.api_keys.secret_hash` berisi SHA-256 dari
`"<key mentah>:<ARTIKEL_API_KEY_PEPPER>"`. Pepper adalah rahasia runtime yang
tidak ada di repo, jadi key yang disisipkan langsung lewat `INSERT` akan selalu
ditolak `401`. Tabel ini juga tidak punya kolom `name`, `key_hash`, `user_id`,
maupun `is_active` — kolom yang nyata: `label`, `key_prefix`, `secret_hash`,
`expires_at`, `revoked_at`, `created_by`.

### `created_by` menentukan penulis artikel

Automation API memakai `api_keys.created_by` sebagai `author_id` artikel yang
dibuat. User itu **wajib** punya peran aktif di website tujuan
(`artikel.user_roles`, `is_active = true`). Kalau tidak, RPC menolak dengan
`Author ... is not an active member of site ...`. Jadi jangan membuat key dengan
akun yang perannya kemudian dicabut.

---

## Testing API

### Test dari Dashboard

Sayangnya, saat ini dashboard belum memiliki built-in API tester. Gunakan salah satu metode di bawah:

### Langkah 0: verifikasi key dulu dengan `GET`

`GET` tidak menulis apa pun dan langsung memberi tahu key ini milik site mana:

```bash
curl -i -H "x-api-key: $AUTOMATION_API_KEY" \
  "https://supabase.carubra.com/functions/v1/automation-api"
```

Respons `200`:

```json
{
  "success": true,
  "site": { "id": "…uuid…", "name": "Nama Website", "domain": "contoh.test" },
  "message": "API key is valid"
}
```

Kalau ini saja gagal, `POST` tidak akan berhasil. Lihat Troubleshooting.

### Test dengan cURL

**Linux/Mac/WSL:**
```bash
curl -X POST "https://supabase.carubra.com/functions/v1/automation-api" \
  -H "x-api-key: $AUTOMATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "test-001",
    "title": "Test Artikel dari cURL",
    "slug": "test-artikel-dari-curl",
    "content": "<p>Ini adalah konten test.</p>",
    "excerpt": "Test excerpt",
    "category_name": "Teknologi",
    "status": "draft"
  }'
```

**Windows PowerShell:**
```powershell
$headers = @{
    "x-api-key" = $env:AUTOMATION_API_KEY
    "Content-Type" = "application/json"
}

$body = @{
    external_id   = "test-001"
    title         = "Test Artikel dari PowerShell"
    slug          = "test-artikel-dari-powershell"
    content       = "<p>Ini adalah konten test.</p>"
    excerpt       = "Test excerpt"
    category_name = "Teknologi"
    status        = "draft"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "https://supabase.carubra.com/functions/v1/automation-api" `
    -Method Post `
    -Headers $headers `
    -Body $body
```

### Field yang diterima

| Field | Wajib | Catatan |
|---|---|---|
| `external_id` | Ya | Kunci upsert, unik per site |
| `title` | Ya | |
| `slug` | Ya | Tidak dibangkitkan otomatis; unik per site |
| `content` | Ya | HTML |
| `category_name` | Ya | Dibuat otomatis bila belum ada |
| `excerpt` | Tidak | |
| `status` | Tidak | Default `draft` |
| `published_at` | Tidak | Diisi otomatis `now()` bila `status='published'` |
| `featured_image` | Tidak | Path storage, bukan URL eksternal |
| `meta_description` | Tidak | |

Field lain diabaikan diam-diam — termasuk `tags`, `featured_image_url`,
`category_id`, `seo_title`, `canonical_url`, `robots`, dan `og_image_url`.
Mengirimnya tidak error, tapi juga tidak tersimpan.

### Respons yang benar

**Success (200)** — `data` adalah **array**, karena RPC memakai `RETURNS TABLE`:

```json
{
  "success": true,
  "site": { "id": "…uuid…", "name": "Nama Website" },
  "data": [
    {
      "article_id": "550e8400-e29b-41d4-a716-446655440000",
      "revision_id": "…uuid…",
      "created_new": true,
      "category_id": "…uuid…"
    }
  ]
}
```

Baca `data[0].article_id`, bukan `data.article_id`. `created_new` membedakan
insert dari update.

**Error (401):**
```json
{ "error": "Invalid or inactive API key" }
```

**Error (400):**
```json
{ "error": "Missing required fields: slug, category_name" }
```

Semua error berbentuk `{"error": "<pesan>"}` — datar, tanpa objek bersarang dan
tanpa kode error mesin.

### Verifikasi di Dashboard

Setelah test berhasil:

1. Buka menu **"Articles"** di dashboard
2. Filter status sesuai yang dikirim
3. Cari artikel dengan title yang Anda kirim

✅ Artikel harus muncul dengan title, content, kategori, dan status sesuai
payload, serta **Author = user yang membuat API key** (`api_keys.created_by`).

---

## Monitoring & Audit

### Yang tersedia di halaman API Keys

Setiap key pada daftar menampilkan: **Label**, **Website**, **Prefix**
(`key_prefix`, 15 karakter pertama), **Status** (Aktif / Revoked), **Expiry**,
dan **Terakhir dipakai** (`last_used_at`).

Aksi per key: **Rotasi** (terbitkan nilai baru, nilai lama mati) dan **Cabut**
(`revoked_at` diisi, key langsung ditolak).

Tidak ada penghitung "Total Requests" maupun indikator "Rate Limit Status" di
halaman ini — versi lama dokumen ini menjanjikan keduanya; tidak pernah ada.

### Yang belum tersedia

- Tidak ada log per-request untuk Automation API. `last_used_at` adalah satu-satunya
  jejak pemakaian key.
- Tidak ada notifikasi email untuk key mendekati kedaluwarsa atau gagal autentikasi.

Untuk investigasi yang lebih dalam, log Edge Function ada di server:

```bash
docker logs --tail 200 supabase-edge-functions
```

---

## Best Practices

### 1. Naming Convention

Beri nama API key yang jelas:

✅ **Good:**
- "WordPress Main Blog Integration"
- "Contentful CMS Sync"
- "News Aggregator Bot"

❌ **Bad:**
- "Test key"
- "API Key 1"
- "My key"

### 2. Environment Separation

Semua key berawalan `ak_live_` — tidak ada varian `ak_test_`. Yang membedakan
environment adalah **site tujuan** dan **label**, bukan bentuk key-nya.

**Cara membuat:**
1. Buat site khusus tes bila perlu, lalu terbitkan key terpisah per environment
2. Beri label yang jelas (contoh: `WordPress - Production`, `WordPress - Staging`)
3. Set expiry untuk key tes (contoh: 90 hari)
4. Biarkan expiry kosong untuk key produksi, tapi rotasi berkala

⚠️ Karena key tes tetap menulis artikel sungguhan ke site-nya, **jangan** pakai key
produksi untuk uji coba.

### 3. Security

**DO:**
- ✅ Simpan key di environment variables
- ✅ Gunakan HTTPS selalu
- ✅ Rotate key setiap 6-12 bulan
- ✅ Revoke key yang tidak digunakan
- ✅ Monitor audit logs secara berkala
- ✅ Set expiration untuk test keys

**DON'T:**
- ❌ Jangan commit key ke Git
- ❌ Jangan hardcode key di source code
- ❌ Jangan share key via email/chat
- ❌ Jangan expose key di frontend/browser
- ❌ Jangan gunakan 1 key untuk semua environment

### 4. Error Handling

Implementasikan proper error handling di sistem Anda:

**WordPress Example:**
```php
function push_to_artikel_cms($post_id) {
    try {
        $response = wp_remote_post(/* ... */);
        
        if (is_wp_error($response)) {
            error_log('Artikel API Error: ' . $response->get_error_message());
            // Optional: Save to queue for retry
            return false;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code !== 200) {
            // Semua error berbentuk {"error": "<pesan>"}
            error_log('API Error: ' . ($body['error'] ?? 'unknown'));
            return false;
        }

        // data adalah array (RPC RETURNS TABLE)
        update_post_meta($post_id, '_artikel_synced', true);
        update_post_meta($post_id, '_artikel_id', $body['data'][0]['article_id']);
        return true;

    } catch (Exception $e) {
        error_log('Exception: ' . $e->getMessage());
        return false;
    }
}
```

### 5. Rate Limiting

**Automation API yang ter-deploy belum punya rate limit.** Tidak ada header
`X-RateLimit-*`, tidak ada respons `429`, dan tidak ada `Retry-After`. Versi lama
dokumen ini menyebut "120 requests per 60 seconds" — angka itu milik Public Read
API (`x-artikel-key`), bukan Automation API.

Perlakukan ini sebagai **kewajiban Anda, bukan izin**: tanpa rem di sisi server,
klien yang mengulang tanpa jeda bisa membebani database. Batasi sendiri.

**Contoh strategi batch:**
```php
// Jangan sync di setiap save:
add_action('save_post', 'queue_article_for_sync');

// Batch sync tiap 5 menit lewat cron:
add_action('artikel_batch_sync', 'process_sync_queue');
if (!wp_next_scheduled('artikel_batch_sync')) {
    wp_schedule_event(time(), 'every_5_minutes', 'artikel_batch_sync');
}
```

### 6. Data Validation

Validasi sebelum push — API menolak payload tidak lengkap dengan `400`, dan
`slug` bentrok dengan `500`:

```php
function validate_artikel_data($post, $slug, $category_name) {
    $errors = [];

    // Field wajib API: external_id, title, slug, content, category_name
    if (empty($post->post_title))   { $errors[] = 'Title is required'; }
    if (empty($post->post_content)) { $errors[] = 'Content is required'; }
    if (empty($slug))               { $errors[] = 'Slug is required'; }
    if (empty($category_name))      { $errors[] = 'Category name is required'; }

    if (strlen($post->post_title) > 255) {
        $errors[] = 'Title too long (max 255 chars)';
    }

    return ['valid' => empty($errors), 'errors' => $errors];
}
```

Slug **tidak** dibangkitkan otomatis oleh API. Bangkitkan sendiri, pastikan unik
per site, dan pakai slug yang sama saat update artikel yang sama.

---

## Troubleshooting

Mulailah selalu dari `GET` — memisahkan masalah autentikasi dari masalah payload:

```bash
curl -i -H "x-api-key: $AUTOMATION_API_KEY" \
  "https://supabase.carubra.com/functions/v1/automation-api"
```

### `500 {"error":"Automation API is not configured"}`

Variabel `ARTIKEL_API_KEY_PEPPER` tidak ter-set di container
`supabase-edge-functions`. Function sengaja gagal-aman: tanpa pepper ia tidak bisa
memverifikasi key, jadi menolak semua request. **Ini bukan auth bypass.**

Perbaikan ada di sisi server, bukan di klien. Lihat `docs/API-DEPLOYMENT.md`
bagian variabel lingkungan Edge Function.

### `401 {"error":"Invalid or inactive API key"}`

**Penyebab:**
- Key salah ketik, atau yang dipakai `key_prefix` (potongan 15 karakter di UI),
  bukan nilai penuh
- Key sudah dicabut (`revoked_at` terisi) atau kedaluwarsa
- Site milik key itu dinonaktifkan
- Header salah: Automation API memakai `x-api-key`. Header `x-artikel-key` milik
  Public Read API (`/api/v1/articles`) dan tidak berlaku di sini

**Solusi:** cek status key di halaman **API keys**, lalu **Rotasi** untuk
mendapat nilai baru. Nilai lama tidak bisa dipulihkan.

### `400 {"error":"Missing required fields: ..."}`

Pesan error menyebutkan persis field mana yang kurang. Yang wajib:
`external_id`, `title`, `slug`, `content`, `category_name`. Nama field
case-sensitive. Yang paling sering terlewat: **`slug`** dan **`category_name`** —
keduanya tidak dibangkitkan otomatis.

### `500` pada `POST` padahal `GET` berhasil

Autentikasi beres, masalahnya di database. Dua kemungkinan utama:

1. **Migrasi belum diterapkan.** RPC `artikel.upsert_automation_article` versi
   lama merujuk tabel `artikel.site_users` yang tidak pernah ada. Perlu
   `202609100014` versi perbaikan **dan** `202609280001_automation_article_actor.sql`.
2. **Slug bentrok.** `articles(site_id, slug)` unik. Pakai slug lain, atau
   perbarui artikel yang sudah ada lewat `external_id` yang sama.

Cek log untuk membedakan:

```bash
docker logs --tail 100 supabase-edge-functions
```

### `Author ... is not an active member of site ...`

User pada `api_keys.created_by` tidak punya peran aktif di site tujuan. Aktifkan
kembali perannya lewat menu **Team**, atau terbitkan ulang key dengan akun yang
masih berperan di site tersebut.

### Artikel tidak muncul di dashboard

1. Ambil `data[0].article_id` dari respons — kalau ada, artikel benar-benar tersimpan
2. Pastikan Anda melihat website yang sama dengan pemilik API key (`GET` menyebut namanya)
3. Periksa semua status, bukan hanya Draft

### Kategori tidak otomatis dibuat

Kategori dibuat dari `category_name` dan dicocokkan tanpa memandang kapitalisasi.
`category_id` diabaikan — mengirimnya tidak akan memilih kategori mana pun.

### Tags tidak muncul

Tidak akan muncul. Automation API tidak memproses `tags` sama sekali. Kelola tag
lewat CMS.

### Featured image tidak muncul

`featured_image` diisi **path storage** (contoh:
`sites/<slug-site>/articles/cover.jpg`), bukan URL eksternal. Field
`featured_image_url` diabaikan. Unggah gambarnya lewat CMS lebih dulu, lalu pakai
path-nya.

---

## Need Help?

### Documentation
- Full API docs: `/api-docs` di dashboard
- Deployment guide: `docs/API-DEPLOYMENT.md`

### Support
- Create issue di repository
- Contact: maskhar@example.com

### Quick Links
- Dashboard: https://cms.carubra.com
- API Endpoint: https://supabase.carubra.com/functions/v1/automation-api
- API Keys: https://cms.carubra.com/api-keys

---

**Last updated:** 28 September 2026
