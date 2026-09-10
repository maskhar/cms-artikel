# Automation API - Panduan Penggunaan di Dashboard

**Last updated:** 11 September 2026

Panduan lengkap untuk mengelola dan menggunakan Automation API dari dashboard CMS Artikel.

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
- ✅ **Auto Category**: Buat kategori otomatis jika belum ada
- ✅ **Tag Sync**: Sinkronisasi tags secara otomatis
- ✅ **Status Control**: Kontrol status artikel (draft, pending, published, dll)
- ✅ **Multi-tenant**: Otomatis scope ke website yang benar berdasarkan API key

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

### Step 1: Akses Menu API Keys

1. Login ke dashboard CMS: `https://cms.carubra.com`
2. Pilih website Anda dari sidebar
3. Klik menu **"API Keys"** di sidebar

### Step 2: Create New API Key

1. Klik tombol **"Create API Key"** di pojok kanan atas
2. Isi form:
   - **Description**: Deskripsi penggunaan (contoh: "WordPress Integration")
   - **Scope**: Pilih **"Automation"** (bukan "Public Read")
   - **Expires At**: (Optional) Set tanggal expired jika diperlukan
3. Klik **"Create"**

### Step 3: Copy API Key

⚠️ **PENTING:** API key hanya ditampilkan **SEKALI**!

```
Setelah create, Anda akan melihat modal:

┌────────────────────────────────────────┐
│  API Key Created Successfully          │
│                                        │
│  Key: aut_live_abc123xyz...            │
│                                        │
│  ⚠️ Copy this key now!                 │
│  You won't be able to see it again.   │
│                                        │
│  [Copy to Clipboard]  [Close]          │
└────────────────────────────────────────┘
```

**Copy key tersebut** dan simpan di tempat aman (password manager, environment variables).

### Step 4: Simpan di Sistem Eksternal

Simpan API key sebagai environment variable di sistem yang akan push artikel:

**WordPress (wp-config.php):**
```php
define('ARTIKEL_AUTOMATION_KEY', 'aut_live_abc123xyz...');
```

**Node.js (.env):**
```env
AUTOMATION_API_KEY=aut_live_abc123xyz...
```

**Python (.env):**
```env
AUTOMATION_API_KEY=aut_live_abc123xyz...
```

---

## Testing API

### Test dari Dashboard

Sayangnya, saat ini dashboard belum memiliki built-in API tester. Gunakan salah satu metode di bawah:

### Test dengan cURL (Recommended)

**Linux/Mac/WSL:**
```bash
curl -X POST "https://supabase.maskhar.net/functions/v1/automation-api" \
  -H "x-api-key: aut_live_abc123xyz..." \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "test-001",
    "title": "Test Artikel dari cURL",
    "content": "<p>Ini adalah konten test.</p>",
    "excerpt": "Test excerpt",
    "tags": ["test", "automation"],
    "status": "draft"
  }'
```

**Windows PowerShell:**
```powershell
$headers = @{
    "x-api-key" = "aut_live_abc123xyz..."
    "Content-Type" = "application/json"
}

$body = @{
    external_id = "test-001"
    title = "Test Artikel dari PowerShell"
    content = "<p>Ini adalah konten test.</p>"
    excerpt = "Test excerpt"
    tags = @("test", "automation")
    status = "draft"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "https://supabase.maskhar.net/functions/v1/automation-api" `
    -Method Post `
    -Headers $headers `
    -Body $body
```

### Test dengan Postman

1. **Create New Request**
   - Method: `POST`
   - URL: `https://supabase.maskhar.net/functions/v1/automation-api`

2. **Headers Tab**
   - `x-api-key`: `aut_live_abc123xyz...`
   - `Content-Type`: `application/json`

3. **Body Tab** (raw JSON)
   ```json
   {
     "external_id": "postman-test-001",
     "title": "Test Artikel dari Postman",
     "content": "<p>Ini adalah konten test dari Postman.</p>",
     "excerpt": "Test excerpt",
     "tags": ["test", "automation"],
     "status": "draft"
   }
   ```

4. **Send Request**

### Expected Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "article_id": "550e8400-e29b-41d4-a716-446655440000",
    "operation": "insert",
    "message": "Article created successfully"
  }
}
```

**Error (401 - Invalid API Key):**
```json
{
  "error": "Invalid or inactive API key"
}
```

**Error (400 - Missing Fields):**
```json
{
  "error": "Missing required fields",
  "required": ["external_id", "title", "content"]
}
```

### Verifikasi di Dashboard

Setelah test berhasil:

1. Buka menu **"Articles"** di dashboard
2. Filter by status **"Draft"** (karena kita push dengan status draft)
3. Cari artikel dengan title yang Anda kirim
4. Klik artikel untuk melihat detail

✅ Artikel harus muncul dengan:
- Title sesuai yang dikirim
- Content sesuai yang dikirim
- Tags yang sudah di-assign
- Status = Draft
- Author = User pertama dengan role writer/editor

---

## Monitoring & Audit

### Menu Audit Logs

Dashboard memiliki **Audit Logs** untuk monitoring aktivitas API:

1. Klik menu **"Audit Logs"** di sidebar
2. Filter by **Action Type**: "api_request"
3. Filter by **Resource Type**: "article"

Anda akan melihat:
- Timestamp request
- User/API key yang digunakan
- Action (INSERT, UPDATE)
- Resource (article ID)
- IP address
- Details (request payload summary)

### Metrics di API Keys Page

Di halaman **API Keys**, setiap key menampilkan:
- **Status**: Active/Inactive/Expired
- **Last Used**: Kapan terakhir digunakan
- **Total Requests**: Jumlah request yang sudah dilakukan
- **Rate Limit Status**: Usage saat ini

### Alert & Notification

⚠️ **Coming Soon**: Email notification untuk:
- API key mendekati expired
- Rate limit reached
- Failed authentication attempts
- Suspicious activity

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

Gunakan API key terpisah untuk setiap environment:

```
Development:   aut_test_dev_abc123...
Staging:       aut_test_staging_xyz456...
Production:    aut_live_prod_qwe789...
```

**Cara membuat:**
1. Create 3 API keys berbeda di dashboard
2. Beri description yang jelas (contoh: "WordPress - Production")
3. Set expiration untuk test keys (contoh: 90 hari)
4. Jangan set expiration untuk production key

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
        
        if ($status_code === 429) {
            // Rate limited - wait and retry
            error_log('Rate limited. Retry after: ' . $response['headers']['retry-after']);
            // Implement retry logic
            return false;
        }
        
        if ($status_code !== 200) {
            error_log('API Error: ' . $body['error']);
            return false;
        }
        
        // Success
        update_post_meta($post_id, '_artikel_synced', true);
        update_post_meta($post_id, '_artikel_id', $body['data']['article_id']);
        return true;
        
    } catch (Exception $e) {
        error_log('Exception: ' . $e->getMessage());
        return false;
    }
}
```

### 5. Rate Limiting

Default rate limit: **120 requests per 60 seconds**

**Tips:**
- Batch operations jika memungkinkan
- Implement exponential backoff untuk retry
- Check header `X-RateLimit-Remaining` sebelum request
- Respect `Retry-After` header saat 429

**Example Batch Strategy:**
```php
// Instead of syncing on every save:
add_action('save_post', 'queue_article_for_sync');

// Batch sync every 5 minutes via cron:
add_action('artikel_batch_sync', 'process_sync_queue');
if (!wp_next_scheduled('artikel_batch_sync')) {
    wp_schedule_event(time(), 'every_5_minutes', 'artikel_batch_sync');
}
```

### 6. Data Validation

Validate data sebelum push ke API:

```php
function validate_artikel_data($post) {
    $errors = [];
    
    // Required fields
    if (empty($post->post_title)) {
        $errors[] = 'Title is required';
    }
    
    if (empty($post->post_content)) {
        $errors[] = 'Content is required';
    }
    
    // Length validation
    if (strlen($post->post_title) > 255) {
        $errors[] = 'Title too long (max 255 chars)';
    }
    
    // HTML validation
    if (!preg_match('/<p>/', $post->post_content)) {
        // Wrap in paragraph if needed
        $post->post_content = '<p>' . $post->post_content . '</p>';
    }
    
    return [
        'valid' => empty($errors),
        'errors' => $errors,
        'data' => $post
    ];
}
```

---

## Troubleshooting

### Error: Invalid or inactive API key

**Penyebab:**
- API key salah
- API key sudah expired
- API key sudah di-revoke
- Menggunakan header yang salah

**Solusi:**
1. Cek di dashboard: Menu **API Keys** → Pastikan status = Active
2. Pastikan menggunakan header `x-api-key` (bukan `x-artikel-key`)
3. Copy API key lagi dari dashboard (atau generate new key)
4. Cek expiration date

### Error: Missing required fields

**Penyebab:**
- Request body tidak lengkap
- Field name salah
- JSON format tidak valid

**Solusi:**
1. Pastikan ada `external_id`, `title`, dan `content` di request body
2. Cek spelling field names (case-sensitive)
3. Validate JSON format sebelum send

### Artikel tidak muncul di dashboard

**Penyebab:**
- Artikel ter-create tapi di site yang berbeda
- Status artikel = archived
- RLS policy blocking

**Solusi:**
1. Cek di **Audit Logs** apakah request berhasil
2. Cek response API: ambil `article_id`
3. Search artikel by ID di database
4. Pastikan site_id sesuai dengan API key yang digunakan
5. Check artikel di semua status (Draft, Pending, Published, Archived)

### Rate Limit Exceeded (429)

**Penyebab:**
- Terlalu banyak request dalam waktu singkat
- Default limit: 120 req/60s

**Solusi:**
1. Implement retry dengan exponential backoff
2. Batch operations jika memungkinkan
3. Check header `Retry-After` untuk tau kapan bisa retry
4. Contact admin untuk increase rate limit jika diperlukan

### Category tidak otomatis dibuat

**Penyebab:**
- Menggunakan `category_id` yang tidak valid
- Tidak menggunakan `category_name`

**Solusi:**
- Gunakan `category_name` untuk auto-create
- Atau pastikan `category_id` yang dikirim valid (UUID yang ada di database)

### Tags tidak sync

**Penyebab:**
- Format tags tidak valid
- Tags tidak di-send sebagai array

**Solusi:**
```json
// ✅ Correct
{
  "tags": ["tech", "news", "web"]
}

// ❌ Wrong
{
  "tags": "tech, news, web"
}
```

### Featured image tidak muncul

**Penyebab:**
- `featured_image_url` tidak valid
- URL tidak accessible dari server

**Solusi:**
1. Pastikan URL publicly accessible
2. Gunakan HTTPS
3. Test URL di browser dulu
4. Format supported: jpg, png, webp, gif

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
- API Endpoint: https://supabase.maskhar.net/functions/v1/automation-api
- API Keys: https://cms.carubra.com/api-keys
- Audit Logs: https://cms.carubra.com/audit

---

**Last updated:** 11 September 2026
