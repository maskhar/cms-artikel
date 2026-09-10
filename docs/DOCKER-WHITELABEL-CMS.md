# Docker White-Label CMS

## Topologi

```text
cms.carubra.com              ┐
cms.uteroindonesia.com       ├─ tunnel/reverse proxy ─ CMS Docker :3000
cms.buzzerhood.com           ┘

CMS Docker → https://supabase.carubra.com → Supabase self-hosted
```

Semua hostname CMS menuju container `cms-artikel` yang sama. Hostname hanya mengubah konteks tampilan dan website default. Hak akses data selalu berasal dari Supabase Auth dan RLS, bukan hostname.

## Environment production

Buat `.env.production` dari `.env.example` dan isi nilai production:

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.carubra.com
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ARTIKEL_API_KEY_PEPPER=
ARTIKEL_RATE_LIMIT_REQUESTS=120
ARTIKEL_RATE_LIMIT_WINDOW_SECONDS=60
CMS_CANONICAL_HOST=cms.carubra.com
CMS_PORT=3000
```

Jangan commit `.env.production`. `SUPABASE_SERVICE_ROLE_KEY` dan `ARTIKEL_API_KEY_PEPPER` hanya berada di server CMS.

## Build dan jalankan CMS

Jalankan dari folder project CMS. File `docker-compose.cms.yml` berdiri sendiri dan tidak mengubah Compose Supabase yang sudah ada.

```bash
docker compose --env-file .env.production -f docker-compose.cms.yml build
docker compose --env-file .env.production -f docker-compose.cms.yml up -d
docker compose --env-file .env.production -f docker-compose.cms.yml ps
```

Container hanya membuka `127.0.0.1:3000`. Tunnel atau reverse proxy menjadi satu-satunya jalur publik.

## Tunnel hostname

Tambahkan ingress hostname pada tunnel yang sudah ada. Semua hostname mengarah ke origin CMS yang sama:

```text
cms.carubra.com              → http://127.0.0.1:3000
cms.uteroindonesia.com       → http://127.0.0.1:3000
cms.buzzerhood.com           → http://127.0.0.1:3000
```

Pastikan tunnel meneruskan header `Host` atau `X-Forwarded-Host`. Jangan arahkan hostname CMS ke container Supabase.

## Konfigurasi alias dalam CMS

1. Terapkan migration sampai `202609100010_cms_hostnames.sql` di staging lebih dahulu.
2. Login melalui `cms.carubra.com`.
3. Buka menu **CMS Domains**.
4. Tambahkan `cms.uteroindonesia.com` dan pilih Utero sebagai website default bila diinginkan.
5. Tambahkan hostname yang sama pada tunnel.
6. Buka alias dan verifikasi banner hostname di sidebar.

User dapat login dari semua alias. Login pada domain berbeda memakai cookie browser berbeda, tetapi user, role, database, API keys, dan artikel tetap berasal dari satu project yang sama.

## Sebelum production

- Tetapkan backup PostgreSQL dan Storage, lalu uji restore.
- Terapkan migration di staging dan jalankan UAT tenant A/B.
- Verifikasi API memakai `cms.carubra.com/api/v1` dan setiap website menyimpan key pada environment server-side.
- Jalankan smoke test login dari setiap alias, upload media, API key, rate limit, audit log, dan RLS.
