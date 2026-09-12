# PANDUAN LENGKAP CMS ARTIKEL MULTI-TENANT

**Repository:** https://github.com/maskhar/cms-artikel
**Production:** https://cms.carubra.com
**Terakhir update:** 10 September 2026

---

## 🎯 UNTUK APA CMS INI?

CMS Artikel adalah platform multi-tenant untuk membuat, mereview, menyetujui, dan menerbitkan artikel/blog ke banyak website berbeda dari satu dashboard terpusat.

**Fitur Utama:**
- ✅ Multi-website (tenant) dalam satu database
- ✅ Role-based access: Admin, Editor, Writer
- ✅ Workflow artikel: draft → review → approved → published
- ✅ Rich text editor dengan gambar
- ✅ SEO: title, meta description, Open Graph
- ✅ API untuk website konsumen
- ✅ Revision history dan audit log

---

## 👥 SIAPA SAJA YANG MENGGUNAKAN?

### 1. **Admin Global**
- Buat dan kelola website (tenant)
- Assign user ke website dengan role
- Buat kategori dan tag per website
- Generate API key per website
- Akses semua fitur

### 2. **Editor** (per website)
- Review artikel dari writer
- Minta revisi atau approve artikel
- Publish artikel ke website
- Edit artikel siapa saja di website tugasnya
- Tidak bisa hapus website atau manage user

### 3. **Writer** (per website)
- Buat artikel draft
- Submit artikel untuk review
- Edit artikel sendiri yang masih draft/revision
- Tidak bisa publish atau approve
- Tidak bisa edit artikel orang lain

### 4. **Developer Website Konsumen**
- Ambil artikel published via Public API
- Pakai API key per website
- Tampilkan artikel di website tenant

### 5. **Automation/Bot**
- Post artikel otomatis via Edge Function (upcoming)
- Retry aman dengan idempotency key
- Tidak perlu akses UI CMS

---

## 🚀 CARA MENGGUNAKAN CMS (STEP-BY-STEP)

### A. PERTAMA KALI: Setup Admin

**1. Login CMS**
```
URL: https://cms.carubra.com/login
Email: admin@example.com
Password: (dari tim DevOps)
```

**2. Buat Website Baru**
```
Menu: Websites
Klik: + Tambah website
Isi:
  - Name: Utero Indonesia
  - Domain: uteroindonesia.com
  - Slug: utero-indonesia
Simpan
```

**3. Buat Kategori Website**
```
Pilih website: Utero Indonesia
Menu kategori muncul otomatis
Klik: + Tambah kategori
Isi:
  - Name: Artikel Kesehatan
  - Slug: kesehatan (otomatis dari name)
  - Description: Artikel seputar kesehatan ibu dan anak
Simpan
```

**4. Tambah User ke Website**
```
Menu: Team
Klik: + Assign role
Isi:
  - Email: editor@example.com
  - Website: Utero Indonesia
  - Role: Editor
Simpan

Ulangi untuk writer:
  - Email: writer@example.com
  - Website: Utero Indonesia
  - Role: Writer
```

**5. Generate API Key**
```
Menu: API Keys
Klik: + Generate key
Isi:
  - Website: Utero Indonesia
  - Label: Production Website
  - Expiry: (kosongkan atau pilih tanggal)
Simpan

⚠️ COPY KEY SEKARANG! Hanya muncul sekali.
Key format: ak_live_xxxxxxxxxxxxxxxxx
Simpan di password manager atau .env server website.
```

---

### B. WORKFLOW ARTIKEL: Writer → Editor → Published

#### **ADMIN GLOBAL: Publikasi ke Semua Website**

```
1. Login menggunakan akun admin global
2. Menu: Articles
3. Klik: + Artikel baru
4. Pilih Website sumber dan Kategori
5. Centang: Tayangkan ke semua website aktif
6. Isi artikel lalu klik: Simpan draft
7. Jalankan workflow: Submit → Approve → Publish
```

Website sumber dipakai untuk kategori, tag, dan media utama. Saat artikel menjadi `Published`, CMS mendistribusikannya ke seluruh website aktif. Kategori dengan slug yang sama dibuat otomatis pada website target jika belum tersedia.

Jika website baru ditambahkan kemudian, website tersebut otomatis menerima semua artikel published yang memakai target **semua website aktif**. Artikel biasa yang hanya ditujukan ke website sumber tidak ikut disalin.

Pilihan ini hanya tersedia untuk admin global. Editor dan writer tetap bekerja dalam website yang menjadi scope mereka.

#### **WRITER: Buat Artikel Draft**

**1. Login sebagai writer**
```
URL: https://cms.carubra.com/login
Email: writer@example.com
```

**2. Buat artikel baru**
```
Menu: Articles
Klik: + Artikel baru
Website otomatis: Utero Indonesia (sesuai assignment)

Isi form:
  - Judul: 7 Tips Menjaga Kesehatan Ibu Hamil
  - Slug: (otomatis dari judul, bisa diedit)
  - Kategori: Artikel Kesehatan
  - Ringkasan: Panduan lengkap menjaga kesehatan selama kehamilan
  - Konten: (gunakan rich text editor)
  
Featured Image:
  - Upload gambar cover (JPG/PNG/WebP, max 5 MB)
  
SEO (opsional, atau klik "Generate dengan AI"):
  - SEO Title: 7 Tips Kesehatan Ibu Hamil | Utero Indonesia
  - Meta Description: Panduan lengkap menjaga kesehatan...
  
Tag (opsional):
  - Centang tag relevan: kehamilan, kesehatan, tips

Status otomatis: Draft
```

**3. Submit untuk review**
```
Scroll ke bawah: Workflow dan Review
Komentar: (opsional) "Artikel siap direview"
Klik: Submit untuk Review

Status berubah: Draft → In Review
```

#### **EDITOR: Review dan Approve**

**1. Login sebagai editor**
```
URL: https://cms.carubra.com/login
Email: editor@example.com
```

**2. Lihat artikel in review**
```
Menu: Articles
Filter status: In review
Klik artikel: 7 Tips Menjaga Kesehatan Ibu Hamil
```

**3. Review konten**
```
Baca artikel
Cek gambar, SEO, kategori

Opsi A: Minta Revisi
  Komentar: "Tambahkan sumber referensi di poin 3"
  Klik: Request Revision
  Status: In Review → Revision Requested

Opsi B: Approve
  Komentar: "Konten sudah bagus, siap publish"
  Klik: Approve
  Status: In Review → Approved
```

**4. Publish artikel**
```
Setelah status Approved:
Komentar: (opsional)
Klik: Publish
Status: Approved → Published
Artikel langsung tersedia di Public API
```

#### **WRITER: Perbaiki Revisi**

```
Jika editor minta revisi:
1. Menu: Articles
2. Filter status: Revision Requested
3. Klik artikel yang diminta revisi
4. Edit konten sesuai komentar editor
5. Klik: Simpan Perubahan
6. Scroll ke workflow
7. Klik: Submit untuk Review (lagi)
8. Status: Revision Requested → In Review
```

---

### C. WEBSITE KONSUMEN: Ambil Artikel via API

**1. Simpan API Key di Server**
```bash
# File: .env (JANGAN commit ke git)
ARTIKEL_API_URL=https://cms.carubra.com/api/v1
ARTIKEL_API_KEY=ak_live_xxxxxxxxxxxxxxxxx
```

**2. Daftar Artikel (PHP contoh)**
```php
<?php
// File: api/articles.php
$apiUrl = getenv('ARTIKEL_API_URL');
$apiKey = getenv('ARTIKEL_API_KEY');

$category = $_GET['category'] ?? 'kesehatan';
$page = (int)($_GET['page'] ?? 1);
$limit = 10;

$url = "$apiUrl/articles?category=$category&page=$page&limit=$limit";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-Artikel-Key: $apiKey"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    header('Content-Type: application/json');
    echo $response;
} else {
    http_response_code($httpCode);
    echo json_encode(['error' => 'API error']);
}
```

**3. Detail Artikel (PHP contoh)**
```php
<?php
// File: api/article-detail.php
$apiUrl = getenv('ARTIKEL_API_URL');
$apiKey = getenv('ARTIKEL_API_KEY');

$slug = $_GET['slug'] ?? '';

$url = "$apiUrl/articles/$slug";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-Artikel-Key: $apiKey"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    header('Content-Type: application/json');
    echo $response;
} elseif ($httpCode === 404) {
    http_response_code(404);
    echo json_encode(['error' => 'Article not found']);
} else {
    http_response_code($httpCode);
    echo json_encode(['error' => 'API error']);
}
```

**4. Tampilkan di Frontend (React contoh)**
```jsx
// File: src/pages/ArticleList.jsx
import { useEffect, useState } from 'react';

export default function ArticleList({ category }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/articles.php?category=${category}&page=1&limit=10`)
      .then(res => res.json())
      .then(data => {
        setArticles(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="article-list">
      {articles.map(article => (
        <article key={article.id}>
          <h2>{article.title}</h2>
          <p>{article.excerpt}</p>
          <a href={`/artikel/${article.slug}`}>Baca selengkapnya</a>
        </article>
      ))}
    </div>
  );
}
```

**5. Sanitasi HTML Konten**
```jsx
// File: src/pages/ArticleDetail.jsx
import DOMPurify from 'dompurify';

export default function ArticleDetail({ article }) {
  const cleanContent = DOMPurify.sanitize(article.content);
  
  return (
    <article className="article-detail">
      <h1>{article.title}</h1>
      <img src={article.featured_image_url} alt={article.title} />
      <div 
        className="content"
        dangerouslySetInnerHTML={{ __html: cleanContent }}
      />
    </article>
  );
}
```

---

### D. FITUR LANJUTAN

#### **1. Rotasi API Key (Tanpa Downtime)**

```
Scenario: Key production mau expire atau bocor

Step 1: Buat key baru
  Menu: API Keys
  Klik: Generate key (key baru)
  Copy: ak_live_yyyyyyyyyyyyyyyy
  
Step 2: Update website tenant
  Edit .env server:
    ARTIKEL_API_KEY=ak_live_yyyyyyyyyyyyyyyy
  Restart/redeploy website
  
Step 3: Test API baru
  curl -H "X-Artikel-Key: ak_live_yyyyyyyyyyyyyyyy" \
    https://cms.carubra.com/api/v1/articles?category=kesehatan&page=1&limit=1
  
Step 4: Revoke key lama
  Menu: API Keys
  Key lama → Klik: Revoke
  Key lama langsung tidak berlaku
```

#### **2. Archive Artikel Lama**

```
Writer/Editor bisa archive artikel yang sudah tidak relevan:

1. Menu: Articles
2. Klik artikel yang mau diarchive
3. Scroll ke workflow
4. Klik: Archive
5. Status: Published → Archived
6. Artikel tidak muncul di Public API lagi

Restore dari archive:
1. Filter status: Archived
2. Klik artikel
3. Klik: Reopen
4. Status: Archived → Draft
5. Submit → Approve → Publish lagi
```

#### **3. Revision History**

```
Setiap kali artikel disimpan, snapshot otomatis:

1. Buka artikel apa saja
2. Scroll ke bawah: Revision History
3. Lihat semua versi dengan tanggal dan catatan perubahan
4. Klik versi lama untuk lihat isi (upcoming feature)
```

#### **4. Audit Log**

```
Admin bisa lihat semua aktivitas:

1. Menu: Audit
2. Filter:
   - User: siapa yang melakukan
   - Action: create, update, delete, publish, etc.
   - Entity: article, site, user_role, api_key
   - Date range
3. Export untuk compliance atau investigation
```

#### **5. Multi-Domain CMS Alias**

```
Scenario: Tenant mau akses CMS dari domain sendiri

Admin setup:
1. Menu: CMS Domains
2. Klik: + Tambah domain
3. Isi:
   - Hostname: cms.uteroindonesia.com
   - Display Name: CMS Utero Indonesia
   - Website Default: Utero Indonesia
4. Simpan

Infrastructure (DevOps):
1. DNS: CNAME cms.uteroindonesia.com → cms.carubra.com
2. Reverse proxy/tunnel arahkan ke container CMS
3. User akses cms.uteroindonesia.com otomatis scope ke website Utero Indonesia
```

---

## 📊 MONITORING & TROUBLESHOOTING

### Rate Limit API

```
Default: 120 request / 60 detik per API key

Jika kena 429 Too Many Requests:
1. Cek header response:
   X-RateLimit-Remaining: 0
   Retry-After: 30
2. Tunggu sesuai Retry-After
3. Implementasi cache di website (30-300 detik)
4. Jangan polling terlalu sering
```

### Artikel Tidak Muncul di API

```
Checklist:
1. Status artikel = Published? (bukan draft/approved)
2. API key aktif? (tidak revoked/expired)
3. Website aktif? (tidak disabled admin)
4. Kategori slug benar? (harus exact match)
5. API key milik website target distribusi artikel?
6. Jika artikel global, distribusi untuk website tersebut berhasil dibuat?

Test langsung dari CMS:
curl -i \
  -H "X-Artikel-Key: ak_live_xxx" \
  https://cms.carubra.com/api/v1/articles?category=kesehatan&page=1&limit=1

Expected: 200 OK dengan array artikel
```

### Error 401 Unauthorized

```
Penyebab:
- API key salah/typo
- API key expired
- API key revoked
- Header X-Artikel-Key tidak dikirim

Fix:
1. Cek .env website: ARTIKEL_API_KEY benar
2. Cek CMS menu API Keys: key masih aktif
3. Generate key baru jika perlu
4. Verify request pakai curl dulu
```

### Error 403 Forbidden

```
Penyebab:
- Website inactive (disabled admin)

Fix:
1. Login CMS sebagai admin
2. Menu: Websites
3. Cek status website: harus Active (toggle hijau)
4. Aktifkan jika disabled
```

---

## 🔒 SECURITY BEST PRACTICES

### ✅ DO (LAKUKAN)

```
1. Simpan API key di environment variable server
2. JANGAN commit API key ke git repository
3. Rotasi API key berkala (setiap 3-6 bulan)
4. Revoke key lama segera setelah rotasi
5. Sanitasi HTML artikel sebelum render (DOMPurify)
6. Implementasi cache di website tenant
7. Monitor rate limit usage
8. Backup database dan storage rutin
9. Test restore backup berkala
10. Assign user hanya ke website yang relevan
```

### ❌ DON'T (JANGAN)

```
1. JANGAN kirim API key dari browser frontend
2. JANGAN hardcode API key di JavaScript bundle
3. JANGAN share API key antar website berbeda
4. JANGAN render HTML artikel tanpa sanitasi
5. JANGAN expose SUPABASE_SERVICE_ROLE_KEY
6. JANGAN beri role admin ke semua orang
7. JANGAN skip approval workflow untuk artikel penting
8. JANGAN lupa set expiry untuk API key temporary
9. JANGAN deploy ke production tanpa UAT
10. JANGAN ubah database manual tanpa migration
```

---

## 📞 SUPPORT & DOKUMENTASI

### Dokumentasi Teknis

```
Repository: https://github.com/maskhar/cms-artikel

Docs lengkap:
- README.md (overview)
- docs/PRD.md (product requirements)
- docs/SDD.md (system design)
- docs/API-INTEGRATION.md (panduan integrasi website)
- docs/DEPLOYMENT-TENANT-API.md (deployment runbook)
- docs/UNIFIED-CMS-API-DESIGN.md (automation API upcoming)
- docs/TODO.md (development checklist)

Session logs:
- SESSION-SUMMARY-2026-09-10.txt (detail lengkap)
- HANDOFF-2026-09-10.txt (status production)
- NEXT-SESSION-QUICKSTART.md (implementasi berikutnya)
```

### Kontak DevOps

```
SSH: maskhar@20.20.20.173
CMS Path: ~/apps/cms-artikel
Supabase: ~/docker/supabase/supabase-1.26.05/docker
Domain: cms.carubra.com (port 3002)
Database: PostgreSQL schema artikel
```

### Common Questions

**Q: Berapa lama artikel pending review?**
A: Tidak ada timeout otomatis. Editor manual approve/reject.

**Q: Bisa auto-publish tanpa approval?**
A: Tidak di MVP. Workflow wajib: draft → review → approved → published.

**Q: Kategori bisa lintas website?**
A: Setiap kategori tetap terikat ke satu website. Untuk artikel global, CMS membuat kategori dengan slug yang sama pada website target jika belum tersedia.

**Q: Artikel bisa diterbitkan ke semua website sekaligus?**
A: Bisa untuk admin global. Centang **Tayangkan ke semua website aktif** saat membuat artikel, lalu selesaikan workflow sampai Published.

**Q: Apakah website baru menerima artikel lama?**
A: Ya, tetapi hanya artikel published dengan scope semua website aktif. Artikel dengan scope satu website tidak ikut didistribusikan.

**Q: API key bisa dipakai untuk website lain?**
A: Tidak. Satu key hanya bisa akses artikel website yang sama.

**Q: Storage limit per website?**
A: Saat ini unlimited, tapi monitor usage. Rekomendasi < 10 GB per tenant.

**Q: Multi-bahasa artikel?**
A: Belum support. Satu artikel satu bahasa. Buat artikel terpisah untuk bahasa lain.

**Q: Scheduled publish?**
A: Belum ada. Publish langsung saat tombol diklik. Scheduled upcoming feature.

---

## 🎓 TRAINING CHECKLIST

### Admin Baru
- [ ] Login CMS pertama kali
- [ ] Buat website baru
- [ ] Buat minimal 3 kategori
- [ ] Assign 1 editor dan 2 writer
- [ ] Generate API key
- [ ] Test API dengan curl

### Editor Baru
- [ ] Login dan lihat dashboard
- [ ] Baca artikel in review
- [ ] Minta revisi ke writer
- [ ] Approve artikel yang sudah OK
- [ ] Publish artikel approved
- [ ] Lihat revision history dan audit log

### Writer Baru
- [ ] Login dan buat artikel draft
- [ ] Upload featured image
- [ ] Generate SEO dengan AI
- [ ] Submit untuk review
- [ ] Perbaiki artikel yang diminta revisi
- [ ] Submit ulang setelah revisi

### Developer Website
- [ ] Setup .env dengan API key
- [ ] Buat proxy PHP/Node.js
- [ ] Request daftar artikel
- [ ] Request detail artikel by slug
- [ ] Implementasi cache response
- [ ] Sanitasi HTML sebelum render
- [ ] Handle error 401, 404, 429

---

Generated: 2026-09-10T16:44:00Z
Repository: https://github.com/maskhar/cms-artikel