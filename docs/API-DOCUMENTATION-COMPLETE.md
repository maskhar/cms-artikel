# Automation API - Complete Documentation

**Version:** 1.1.0  
**Last Updated:** 2026-09-10  
**Status:** Production Ready (Database Layer)

---

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Endpoint Reference](#endpoint-reference)
3. [Authentication](#authentication)
4. [Request Format](#request-format)
5. [Response Format](#response-format)
6. [Error Codes](#error-codes)
7. [Deployment Options](#deployment-options)
8. [HTML Static Deployment](#html-static-deployment)
9. [Usage Examples](#usage-examples)
10. [Testing](#testing)

---

## 📡 API Overview

Automation API memungkinkan sistem eksternal untuk membuat dan memperbarui artikel secara otomatis melalui HTTP API yang aman.

### Key Features

- ✅ **Idempotent Operations** - Gunakan `external_id` untuk operasi yang aman
- ✅ **Automatic Category Management** - Kategori dibuat otomatis jika belum ada
- ✅ **Slug Conflict Detection** - Mencegah duplikasi slug
- ✅ **Tenant Isolation** - RLS policies enforce multi-tenant security
- ✅ **Revision Tracking** - Semua perubahan tercatat
- ✅ **Rate Limiting** - 120 requests per menit per API key

### Architecture

```
External System → API Endpoint → Edge Function → PostgreSQL Function → Database
                                     ↓
                              Authentication
                              Rate Limiting
                              Validation
```

---

## 🔗 Endpoint Reference

### Base URL

**Staging:** `https://20.20.20.173:8000/functions/v1/artikel-cms`  
**Production:** `https://your-domain.com/functions/v1/artikel-cms`

### HTTP Method

```
POST /functions/v1/artikel-cms
```

### Headers

```http
Content-Type: application/json
x-artikel-key: YOUR_API_KEY
```

---

## 🔐 Authentication

API menggunakan API key authentication melalui header `x-artikel-key`.

### Mendapatkan API Key

```sql
-- Connect ke database
ssh maskhar@20.20.20.173
docker exec -i supabase-db psql -U postgres -d postgres

-- Create API key
INSERT INTO artikel.api_keys (site_id, user_id, name, key_hash, is_active)
SELECT 
  s.id as site_id,
  u.id as user_id,
  'Production API Key' as name,
  encode(digest('your-secret-key-here-' || gen_random_uuid()::text, 'sha256'), 'hex') as key_hash,
  true as is_active
FROM artikel.sites s
CROSS JOIN auth.users u
WHERE s.domain = 'your-domain.com'
  AND u.email = 'your-email@example.com'
LIMIT 1;

-- Retrieve the plain key (save this!)
SELECT 'your-secret-key-here-' || gen_random_uuid()::text as api_key;
```

### Security Best Practices

1. **Never commit API keys** ke git repository
2. **Use environment variables** untuk menyimpan API keys
3. **Rotate keys regularly** (setiap 90 hari)
4. **Monitor API usage** untuk deteksi anomali
5. **Set expiration dates** untuk temporary keys

---

## 📤 Request Format

### Article Upsert

```json
{
  "action": "article.upsert",
  "data": {
    "external_id": "unique-id-from-your-system",
    "title": "Article Title",
    "slug": "article-slug",
    "content": "<h1>Article Content</h1><p>HTML content here</p>",
    "excerpt": "Short description of the article",
    "category": "Category Name",
    "status": "draft",
    "featured_image": "https://example.com/image.jpg",
    "meta_description": "SEO meta description",
    "meta_keywords": ["keyword1", "keyword2"],
    "published_at": "2026-09-10T12:00:00Z"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | ✅ | Must be `"article.upsert"` |
| `external_id` | string | ✅ | Unique identifier dari sistem eksternal |
| `title` | string | ✅ | Judul artikel (1-500 karakter) |
| `slug` | string | ✅ | URL-friendly slug (lowercase, alphanumeric, hyphens) |
| `content` | string | ✅ | Konten artikel dalam HTML |
| `excerpt` | string | ❌ | Ringkasan artikel |
| `category` | string | ✅ | Nama kategori (dibuat otomatis jika belum ada) |
| `status` | string | ❌ | `draft`, `published`, or `archived` (default: `draft`) |
| `featured_image` | string | ❌ | URL gambar utama |
| `meta_description` | string | ❌ | Meta description untuk SEO |
| `meta_keywords` | array | ❌ | Array of keywords |
| `published_at` | string | ❌ | ISO 8601 timestamp |

### Validation Rules

- **external_id**: Unique per site, max 255 characters
- **slug**: Lowercase, alphanumeric with hyphens only, max 255 characters
- **title**: Min 1 character, max 500 characters
- **content**: Min 1 character, no max limit
- **status**: Must be one of: `draft`, `published`, `archived`
- **published_at**: Must be valid ISO 8601 timestamp

---

## 📥 Response Format

### Success Response (201/200)

```json
{
  "data": {
    "article_id": "550e8400-e29b-41d4-a716-446655440000",
    "revision_id": "660e8400-e29b-41d4-a716-446655440001",
    "created": true,
    "category_id": "770e8400-e29b-41d4-a716-446655440002",
    "message": "Article created successfully"
  },
  "timestamp": "2026-09-10T17:28:00Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `article_id` | UUID | ID artikel yang dibuat/diupdate |
| `revision_id` | UUID | ID revision baru |
| `created` | boolean | `true` jika artikel baru, `false` jika update |
| `category_id` | UUID | ID kategori |
| `message` | string | Success message |
| `timestamp` | string | Server timestamp |

---

## ❌ Error Codes

### Error Response Format

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "timestamp": "2026-09-10T17:28:00Z"
  }
}
```

### Common Error Codes

| HTTP | Code | Description | Solution |
|------|------|-------------|----------|
| 400 | `VALIDATION_ERROR` | Invalid request data | Check required fields |
| 400 | `INVALID_JSON` | Malformed JSON | Validate JSON syntax |
| 400 | `MISSING_ACTION` | Action field missing | Add `"action": "article.upsert"` |
| 400 | `UNKNOWN_ACTION` | Invalid action | Use `article.upsert` |
| 401 | `MISSING_API_KEY` | No API key provided | Add `x-artikel-key` header |
| 401 | `INVALID_API_KEY` | Invalid/expired key | Check API key validity |
| 404 | `NOT_FOUND` | Resource not found | Verify site/user exists |
| 409 | `SLUG_CONFLICT` | Slug already exists | Use different slug or same external_id |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | Wait 60 seconds or reduce rate |
| 500 | `DATABASE_ERROR` | Database operation failed | Check logs, retry |
| 500 | `INTERNAL_ERROR` | Server error | Contact support |

---

## 🚀 Deployment Options

### Option 1: Edge Function (Recommended)

**For Supabase Cloud:**
```bash
supabase functions deploy artikel-cms
```

**For Self-Hosted:**
```bash
# Copy function to server
scp supabase/functions/artikel-cms/index.ts maskhar@20.20.20.173:~/

# Deploy via Deno Deploy or configure Kong routing
```

### Option 2: HTML Static Form

Ideal untuk testing atau simple integration tanpa backend.

---

## 📄 HTML Static Deployment

### Simple HTML Form

Buat file `artikel-api-form.html`:

```html
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artikel CMS - API Form</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }
        .required { color: #e74c3c; }
        input, textarea, select {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.3s;
            font-family: inherit;
        }
        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        textarea {
            min-height: 150px;
            resize: vertical;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            width: 100%;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
        .btn:active {
            transform: translateY(0);
        }
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .alert {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .alert-success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .alert-error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
            color: #667eea;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .help-text {
            font-size: 12px;
            color: #999;
            margin-top: 4px;
        }
        .response-box {
            display: none;
            margin-top: 20px;
            padding: 16px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .response-box pre {
            margin: 0;
            font-size: 12px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📝 Artikel CMS - API Form</h1>
        <p class="subtitle">Create or update artikel via Automation API</p>

        <div id="alertBox"></div>
        <div id="loadingBox" class="loading">
            <div class="spinner"></div>
            <p>Sending request...</p>
        </div>

        <form id="artikelForm">
            <!-- API Configuration -->
            <div class="form-group">
                <label for="apiUrl">API Endpoint <span class="required">*</span></label>
                <input type="url" id="apiUrl" required 
                       value="https://20.20.20.173:8000/functions/v1/artikel-cms"
                       placeholder="https://your-domain.com/functions/v1/artikel-cms">
                <div class="help-text">URL endpoint Automation API</div>
            </div>

            <div class="form-group">
                <label for="apiKey">API Key <span class="required">*</span></label>
                <input type="password" id="apiKey" required 
                       placeholder="your-api-key-here">
                <div class="help-text">API key dari database artikel.api_keys</div>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 2px solid #f0f0f0;">

            <!-- Article Data -->
            <div class="form-group">
                <label for="externalId">External ID <span class="required">*</span></label>
                <input type="text" id="externalId" required 
                       placeholder="unique-id-001">
                <div class="help-text">Unique identifier dari sistem Anda</div>
            </div>

            <div class="form-group">
                <label for="title">Title <span class="required">*</span></label>
                <input type="text" id="title" required 
                       placeholder="Judul Artikel Anda">
            </div>

            <div class="form-group">
                <label for="slug">Slug <span class="required">*</span></label>
                <input type="text" id="slug" required 
                       pattern="[a-z0-9-]+"
                       placeholder="judul-artikel-anda">
                <div class="help-text">Lowercase, alphanumeric dengan hyphens only</div>
            </div>

            <div class="form-group">
                <label for="content">Content <span class="required">*</span></label>
                <textarea id="content" required 
                          placeholder="<h1>Judul</h1><p>Konten artikel dalam HTML...</p>"></textarea>
            </div>

            <div class="form-group">
                <label for="excerpt">Excerpt</label>
                <textarea id="excerpt" rows="3" 
                          placeholder="Ringkasan singkat artikel..."></textarea>
            </div>

            <div class="form-group">
                <label for="category">Category <span class="required">*</span></label>
                <input type="text" id="category" required 
                       placeholder="Technology">
                <div class="help-text">Kategori akan dibuat otomatis jika belum ada</div>
            </div>

            <div class="form-group">
                <label for="status">Status</label>
                <select id="status">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            <div class="form-group">
                <label for="featuredImage">Featured Image URL</label>
                <input type="url" id="featuredImage" 
                       placeholder="https://example.com/image.jpg">
            </div>

            <div class="form-group">
                <label for="metaDescription">Meta Description (SEO)</label>
                <textarea id="metaDescription" rows="2" 
                          placeholder="Deskripsi untuk search engines..."></textarea>
            </div>

            <div class="form-group">
                <label for="metaKeywords">Meta Keywords (comma separated)</label>
                <input type="text" id="metaKeywords" 
                       placeholder="keyword1, keyword2, keyword3">
            </div>

            <button type="submit" class="btn">🚀 Submit Article</button>
        </form>

        <div id="responseBox" class="response-box">
            <strong>Response:</strong>
            <pre id="responseContent"></pre>
        </div>
    </div>

    <script>
        const form = document.getElementById('artikelForm');
        const alertBox = document.getElementById('alertBox');
        const loadingBox = document.getElementById('loadingBox');
        const responseBox = document.getElementById('responseBox');
        const responseContent = document.getElementById('responseContent');

        // Auto-generate slug from title
        document.getElementById('title').addEventListener('input', (e) => {
            const slug = e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .substring(0, 100);
            document.getElementById('slug').value = slug;
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Clear previous alerts
            alertBox.innerHTML = '';
            responseBox.style.display = 'none';
            loadingBox.style.display = 'block';

            // Get form data
            const apiUrl = document.getElementById('apiUrl').value;
            const apiKey = document.getElementById('apiKey').value;
            
            const metaKeywords = document.getElementById('metaKeywords').value
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);

            const payload = {
                action: 'article.upsert',
                data: {
                    external_id: document.getElementById('externalId').value,
                    title: document.getElementById('title').value,
                    slug: document.getElementById('slug').value,
                    content: document.getElementById('content').value,
                    excerpt: document.getElementById('excerpt').value || null,
                    category: document.getElementById('category').value,
                    status: document.getElementById('status').value,
                    featured_image: document.getElementById('featuredImage').value || null,
                    meta_description: document.getElementById('metaDescription').value || null,
                    meta_keywords: metaKeywords.length > 0 ? metaKeywords : null
                }
            };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-artikel-key': apiKey
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                loadingBox.style.display = 'none';
                responseBox.style.display = 'block';
                responseContent.textContent = JSON.stringify(data, null, 2);

                if (response.ok) {
                    showAlert('success', `✅ Success! Article ${data.data.created ? 'created' : 'updated'} with ID: ${data.data.article_id}`);
                } else {
                    showAlert('error', `❌ Error: ${data.error.message} (${data.error.code})`);
                }
            } catch (error) {
                loadingBox.style.display = 'none';
                showAlert('error', `❌ Network Error: ${error.message}`);
                console.error('Error:', error);
            }
        });

        function showAlert(type, message) {
            alertBox.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
            alertBox.scrollIntoView({ behavior: 'smooth' });
        }
    </script>
</body>
</html>
```

### Deployment HTML Form

**Option 1: Direct File**
```bash
# Upload ke server via FTP/SCP
scp artikel-api-form.html user@your-server:/var/www/html/

# Access via browser
https://your-domain.com/artikel-api-form.html
```

**Option 2: GitHub Pages**
```bash
# Create repository
git init
git add artikel-api-form.html
git commit -m "Add API form"
git branch -M main
git remote add origin https://github.com/yourusername/artikel-api-form.git
git push -u origin main

# Enable GitHub Pages in repository settings
# Access: https://yourusername.github.io/artikel-api-form/
```

**Option 3: Netlify Drop**
1. Visit https://app.netlify.com/drop
2. Drag `artikel-api-form.html`
3. Get instant URL

**Option 4: Vercel**
```bash
npm i -g vercel
vercel --prod
```

### Security Notes for HTML Deployment

⚠️ **IMPORTANT:**
- Jangan hardcode API key di HTML untuk production
- Gunakan environment variables atau backend proxy
- Enable CORS di Edge Function untuk allow HTML origin
- Consider adding CAPTCHA untuk prevent abuse
- Monitor API usage untuk detect anomali

---

## 💡 Usage Examples

### cURL

```bash
curl -X POST "https://20.20.20.173:8000/functions/v1/artikel-cms" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: your-api-key" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "curl-test-001",
      "title": "Test Article from cURL",
      "slug": "test-article-curl",
      "content": "<p>Test content</p>",
      "category": "Testing",
      "status": "draft"
    }
  }'
```

### JavaScript (Fetch)

```javascript
const response = await fetch('https://your-api.com/functions/v1/artikel-cms', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-artikel-key': 'your-api-key'
  },
  body: JSON.stringify({
    action: 'article.upsert',
    data: {
      external_id: 'js-test-001',
      title: 'Test Article',
      slug: 'test-article',
      content: '<p>Content here</p>',
      category: 'Technology'
    }
  })
});

const data = await response.json();
console.log(data);
```

### Python (requests)

```python
import requests

response = requests.post(
    'https://your-api.com/functions/v1/artikel-cms',
    headers={
        'Content-Type': 'application/json',
        'x-artikel-key': 'your-api-key'
    },
    json={
        'action': 'article.upsert',
        'data': {
            'external_id': 'python-test-001',
            'title': 'Test Article',
            'slug': 'test-article',
            'content': '<p>Content</p>',
            'category': 'Technology'
        }
    }
)

print(response.json())
```

### PHP (cURL)

```php
$ch = curl_init('https://your-api.com/functions/v1/artikel-cms');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-artikel-key: your-api-key'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'action' => 'article.upsert',
    'data' => [
        'external_id' => 'php-test-001',
        'title' => 'Test Article',
        'slug' => 'test-article',
        'content' => '<p>Content</p>',
        'category' => 'Technology'
    ]
]));

$response = curl_exec($ch);
$data = json_decode($response, true);
print_r($data);
```

---

## 🧪 Testing

### Test Database Function Directly

```sql
-- Connect to database
ssh maskhar@20.20.20.173
docker exec -i supabase-db psql -U postgres -d postgres

-- Test function
SELECT artikel.upsert_automation_article(
  (SELECT id FROM artikel.sites LIMIT 1),
  'test-direct-001',
  'Test Direct Function Call',
  'test-direct-function',
  '<p>Testing database function directly</p>',
  'Test excerpt',
  'Direct Test Category',
  (SELECT id FROM auth.users LIMIT 1),
  'draft'::artikel.article_status
);
```

### Expected Result

```
 article_id                           | revision_id                          | created_new | category_id
--------------------------------------+--------------------------------------+-------------+-------------
 550e8400-e29b-41d4-a716-446655440000 | 660e8400-e29b-41d4-a716-446655440001 | t           | 770e8400...
```

### Verify in Database

```sql
-- Check artikel created
SELECT id, external_id, title, slug, status 
FROM artikel.articles 
WHERE external_id = 'test-direct-001';

-- Check category created
SELECT id, name, slug 
FROM artikel.categories 
WHERE name = 'Direct Test Category';

-- Check revision
SELECT id, revision_number, change_summary 
FROM artikel.article_revisions 
WHERE article_id = (SELECT id FROM artikel.articles WHERE external_id = 'test-direct-001');
```

---

## 📊 Monitoring & Analytics

### Check API Usage

```sql
-- API key usage stats
SELECT 
  ak.name,
  COUNT(*) as request_count,
  MAX(ak.last_used_at) as last_request
FROM artikel.api_keys ak
WHERE ak.last_used_at > NOW() - INTERVAL '24 hours'
GROUP BY ak.name;

-- Article creation via API
SELECT 
  DATE(created_at) as date,
  COUNT(*) as articles_created
FROM artikel.articles
WHERE external_id IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Monitor Performance

```sql
-- Slow operations (if you have pg_stat_statements)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%upsert_automation_article%'
ORDER BY mean_exec_time DESC;
```

---

## 🔧 Troubleshooting

### Common Issues

**Issue: CORS Error in Browser**
```
Solution: Add CORS headers to Edge Function or use server-side proxy
```

**Issue: SSL Certificate Error**
```bash
# For testing only (NOT for production)
curl -k https://...  # Skip SSL verification
```

**Issue: Rate Limit Hit**
```
Solution: Wait 60 seconds or implement exponential backoff
```

**Issue: Slug Conflict**
```
Solution: Use same external_id to update, or choose different slug
```

---

## 📞 Support

**Documentation:**
- Full Guide: `docs/DEPLOYMENT-AUTOMATION-API.md`
- Quick Reference: `docs/QUICK-REFERENCE-AUTOMATION-API.md`
- Examples: `examples/README.md`

**Database Access:**
```bash
ssh maskhar@20.20.20.173
docker exec -it supabase-db psql -U postgres -d postgres
```

**Check Logs:**
```bash
# Supabase logs
docker logs supabase-db -f

# Edge Function logs (if deployed)
supabase functions logs artikel-cms --follow
```

---

**Last Updated:** 2026-09-10 17:28 UTC  
**Version:** 1.1.0  
**Status:** ✅ Production Ready (Database Layer)
