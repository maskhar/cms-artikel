# Storage Structure Documentation

Tanggal: 11 September 2026

## Struktur Folder Storage

Semua file media disimpan di bucket rtikel-media dengan struktur folder yang mudah dibaca dan dikelola:

### 1. Gallery Images

**Path:** {site-slug}/galleries/{gallery-slug}/{uuid}.{ext}

**Contoh:**
- my-website/galleries/event-2026/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
- company-blog/galleries/team-photos/b2c3d4e5-f6a7-8901-bcde-f12345678901.png

**Kapan digunakan:**
- Upload gambar melalui halaman /gallery
- Membuat koleksi gambar reusable untuk digunakan di berbagai artikel

### 2. Article Images

**Path:** {site-slug}/articles/{article-slug}/{uuid}.{ext}

**Contoh:**
- my-website/articles/cara-membuat-website/c3d4e5f6-a7b8-9012-cdef-123456789012.jpg
- company-blog/articles/product-launch-2026/d4e5f6a7-b8c9-0123-def1-234567890123.webp

**Kapan digunakan:**
- Upload featured image atau OG image pada artikel
- Upload gambar di dalam konten artikel (via rich text editor)

### 3. Article Addons (PDF, dll)

**Path:** {site-slug}/articles/{article-slug}/addons/{uuid}.{ext}

**Contoh:**
- my-website/articles/annual-report-2026/addons/e5f6a7b8-c9d0-1234-ef12-345678901234.pdf
- company-blog/articles/user-manual/addons/f6a7b8c9-d0e1-2345-f123-456789012345.pdf

**Kapan digunakan:**
- Upload PDF untuk add-on PDF Viewer
- File download untuk add-on File Download

### 4. Draft Images (Artikel Baru)

**Path:** {site-slug}/articles/drafts/{uuid}.{ext}

**Contoh:**
- my-website/articles/drafts/a7b8c9d0-e1f2-3456-1234-567890123456.jpg

**Kapan digunakan:**
- Upload gambar saat membuat artikel baru (sebelum artikel disimpan pertama kali)
- Setelah artikel disimpan, path akan update ke struktur artikel normal

## Keuntungan Struktur Ini

1. **Mudah Dicari**: Nama folder menggunakan slug yang mudah dibaca manusia
2. **Organisasi Jelas**: Setiap website memiliki folder terpisah
3. **Migrasi Mudah**: Dapat dengan mudah memindahkan atau backup folder per website
4. **Debugging Lebih Cepat**: Developer dapat langsung ke folder yang tepat
5. **Konsisten**: Semua jenis upload mengikuti pola yang sama

## Integrasi dengan Gallery Page

Semua gambar yang diupload (baik melalui gallery, artikel, atau addon) akan:
- Disimpan di rtikel.media_assets table
- Tampil di halaman /gallery untuk dikelola
- Dapat dipilih ulang untuk digunakan di artikel lain

## Migration dari Struktur Lama

Jika ada file dengan struktur lama (UUID-based folders):
- File lama tetap berfungsi normal
- Upload baru akan menggunakan struktur baru
- Migration script dapat dibuat jika diperlukan untuk memindahkan file lama

## Catatan Teknis

- UUID pada nama file tetap digunakan untuk menghindari konflik nama
- Slug dijaga agar selalu URL-safe (lowercase, hanya huruf, angka, dan dash)
- Maximum length untuk path: 500 karakter
- Supported image formats: JPEG, PNG, WebP, GIF
- Maximum file size: 5 MB untuk gambar, 20 MB untuk PDF
