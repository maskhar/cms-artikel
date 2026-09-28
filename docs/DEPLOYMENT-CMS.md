# CMS Artikel - Deployment Guide

## Masalah yang Diperbaiki

**Error:** 502 Bad Gateway pada https://cms.carubra.com/api/cms/sites

**Penyebab:** Container Docker untuk aplikasi CMS artikel tidak berjalan di server production.

**Solusi:** Build dan deploy container menggunakan docker-compose.

## Status Deployment

- **Server:** maskhar@20.20.20.173 (supabase-server)
- **Lokasi:** ~/apps/cms-artikel
- **Container:** cms-artikel
- **Port:** 127.0.0.1:3002 -> 3000 (internal)
- **Domain:** https://cms.carubra.com
- **Status:** Running & Healthy ✓

## Riwayat deploy keamanan

### 28 September 2026 — Fase 3 + Fase 5 (commit `d5bc84f`)

Sebelum deploy ini, container produksi masih menjalankan build Fase 2 lama. Itu
bukan sekadar "versi ketinggalan": `src/proxy.ts` yang live memakai matcher tanpa
batas segmen,

```
/((?!api|_next/static|_next/image|image|favicon(?:/|\.ico)).*)
```

sehingga setiap path yang *berawalan* kata yang dikecualikan ikut lolos gerbang
auth. Dibuktikan lewat probe langsung ke `127.0.0.1:3002` sebelum deploy:

| Path | Sebelum | Sesudah |
|---|---|---|
| `/api-keys` (halaman penerbitan & rotasi API key) | **200 tanpa sesi** | 307 → `/login` |
| `/api-docs` | **200 tanpa sesi** | 307 → `/login` |
| `/team`, `/sites`, `/gallery`, `/` | 307 → `/login` | 307 → `/login` |
| `/login` | 200 | 200 |
| `/api/cms/articles`, `/api/cms/sites` | 401 | 401 (JSON, bukan redirect) |

`/api-keys` cocok dengan `api` karena tidak ada penanda batas setelahnya. Jadi
halaman yang menerbitkan kredensial API justru satu-satunya yang tak berpagar.
Lubang ini hidup di produksi sampai 28 September 2026; dicatat di sini supaya
tidak terbaca sebagai temuan teoretis saat riwayat ini dibaca ulang.

Matcher yang di-deploy sudah beranotasi batas segmen dan diverifikasi pada
artefak build, bukan pada file sumber:
`.next/server/functions-config-manifest.json` → `/_middleware` berisi
`/((?!api(?:/|$)|_next/static/|_next/image/|image(?:/|$)|favicon(?:/|.ico$)).*)`.

Diverifikasi sesudah container naik:

- CSP nonce nyata, bukan sekadar header hadir: 11/11 `<script>` di `/login`
  ber-nonce dan cocok dengan header; tiga request berturut menghasilkan tiga
  nonce berbeda (kalau sama, `'strict-dynamic'` jadi hiasan).
- Tidak ada `'unsafe-eval'` di CSP produksi — kelonggaran mode dev tidak bocor.
- HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy` terpasang; `X-Powered-By` hilang.
- Log container bersih, health check `healthy`.

Cara deploy: `git archive HEAD` (hanya file terlacak — `.env*` ter-gitignore
sehingga tidak mungkin ikut terkirim; dikonfirmasi isi arsip), scp dengan
SHA256 dicocokkan dua sisi, `docker-compose.yml` dan `Dockerfile` server
di-diff dulu terhadap repo sebelum ditimpa, direktori aplikasi di-backup ke
`~/cms-artikel-pre-fase35-2026-09-28.tar.gz`, `.env` dan `.env.production`
dikonfirmasi selamat sesudah ekstrak.

## Command Reference

### Deploy/Update Aplikasi

`ash
# SSH ke server
ssh maskhar@20.20.20.173

# Masuk ke direktori aplikasi
cd ~/apps/cms-artikel

# Pull perubahan terbaru (jika ada)
git pull

# Build dan restart container
docker compose down
docker compose up -d --build

# Lihat logs
docker logs cms-artikel -f
`

### Monitoring

`ash
# Cek status container
docker ps --filter 'name=cms-artikel'

# Cek health
docker inspect cms-artikel | grep -A 5 Health

# Lihat logs
docker logs cms-artikel --tail 50

# Restart jika perlu
docker restart cms-artikel
`

## Environment Variables

File .env.production berisi:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ARTIKEL_API_KEY_PEPPER
- CMS_CANONICAL_HOST
- CMS_PORT

## Networks

Container terhubung ke:
- carubra-network (external)
- buzzerhood-network (external)

## Healthcheck

Endpoint: http://127.0.0.1:3000/login
Interval: 30s
Timeout: 5s
Retries: 3

---
Diperbaiki: 2026-09-10
