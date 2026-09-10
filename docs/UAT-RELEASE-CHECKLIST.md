# UAT dan Release Checklist

**Status:** Belum siap deploy production pada 10 September 2026.

## Blocker sebelum staging

- Tetapkan domain CMS staging/production dan domain public API production.
- Siapkan backup PostgreSQL teruji restore dan backup bucket `artikel-media`.
- Tentukan lokasi penyimpanan backup, retensi, enkripsi, serta pemilik alert kegagalan.
- Isi environment staging: Supabase URL, publishable key, service-role key, `ARTIKEL_API_KEY_PEPPER`, dan rate-limit config.

## Database staging

1. Snapshot database dan bucket Storage sebelum migration.
2. Terapkan migration `202609100008_article_media_and_tags.sql` lalu `202609100009_rate_limits_and_audit.sql`.
3. Verifikasi bucket private `artikel-media`, MIME policy, ukuran maksimal 5 MB, dan Storage RLS tenant.
4. Verifikasi `artikel.consume_api_key_rate_limit` hanya executable oleh `service_role`.
5. Verifikasi trigger audit menghasilkan record tanpa `secret_hash` atau `last_used_at`.

## UAT alur editorial

1. Writer membuat draft, memilih tag, mengunggah featured/OG image, lalu submit review.
2. Editor meminta revisi dengan komentar, approve, lalu publish.
3. Website tenant B tidak dapat membaca, memasang tag, atau mengakses media tenant A.
4. API public tenant A hanya mengembalikan artikel `published` tenant A.
5. Key expired dan key revoke mendapat `401`; request di atas limit mendapat `429` dan `Retry-After`.
6. Rotasi key membuat key baru, revoke key lama, dan mencatat audit log.
7. Uji UI pada viewport 360 px, keyboard-only, fokus tombol, label input, dan kontras.

## Production rollout

1. Inspect Compose aktif di `/home/maskhar/docker/supabase/supabase-1.26.05/docker` sebelum perubahan.
2. Deploy aplikasi ke staging, jalankan UAT, lalu ambil approval tertulis.
3. Terapkan migration production satu per satu dengan backup tervalidasi.
4. Smoke test CMS, upload Storage, API key, API public, rate limit, dashboard, audit log.
5. Pantau error log, penggunaan database, dan kegagalan backup selama 24 jam.
