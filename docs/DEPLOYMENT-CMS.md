# CMS Artikel - Deployment Guide

## Masalah yang Diperbaiki

**Error:** 502 Bad Gateway pada https://cms.carubra.com/api/cms/sites

**Penyebab:** Container Docker untuk aplikasi CMS artikel tidak berjalan.

**Solusi:** Build dan deploy container menggunakan docker-compose.

## Status Deployment

> ⚠️ **Baca ini sebelum deploy.** Sampai 28 September 2026 bagian ini menyebut
> `20.20.20.173` sebagai tempat aplikasi berjalan. **Itu salah**, dan kesalahan
> itu menyebabkan satu deploy penuh mendarat di container yang tidak melayani
> siapa-siapa — lihat "28 September 2026 — koreksi topologi" di bawah.

Aplikasi dan database berada di **dua mesin berbeda**:

| | Aplikasi CMS | Database Supabase |
|---|---|---|
| Mesin | **Workstation lokal** (tempat repo ini berada) | `maskhar@20.20.20.173` |
| Container | `cms-artikel` | `supabase-db` dkk |
| Domain | `https://cms.carubra.com` | `https://supabase.carubra.com` |
| Dibuka lewat | `cloudflared-tunnel` di mesin yang sama, via `carubra-network` | Kong → `8000/8443` |
| Deploy | `docker compose build && docker compose up -d` **di workstation** | `docker exec -i supabase-db psql` lewat SSH |

Jalur trafik yang sebenarnya:

```
cms.carubra.com → Cloudflare → cloudflared-tunnel (workstation)
                                     ↓ carubra-network
                               cms-artikel:3000     ← container di workstation
                                     ↓
                     https://supabase.carubra.com → 20.20.20.173
```

`cloudflared-tunnel` dan `cms-artikel` berbagi network `carubra-network` **di
workstation**. Tunnel meneruskan ke container lokal, bukan ke server.

Cara membuktikannya kalau ragu (jangan percaya dokumen ini begitu saja —
dokumen inilah yang dulu keliru): hentikan container lokal, lalu panggil domain
publiknya. Kalau jadi 502, container lokal itulah yang melayani produksi.

- **Port:** `127.0.0.1:3002 -> 3000` (sama di kedua mesin — inilah yang membuat
  probe `curl 127.0.0.1:3002` di server tampak "berhasil" padahal salah sasaran)
- **Status:** Running & Healthy ✓

### Container `cms-artikel` di `20.20.20.173`

Ada, sehat, dan **tidak menerima trafik apa pun**. Sisa deploy 28 September 2026
yang salah sasaran. Jangan dijadikan acuan status produksi; verifikasi apa pun
di sana tidak membuktikan apa-apa tentang `cms.carubra.com`.

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

### 28 September 2026 — migrasi #280003 + app (commit `0aa89cc`)

Migrasi database dan aplikasi naik **bersama**, dan itu wajib: route
`DELETE /api/cms/sites/[siteId]` mencabut penolakan 409 `SITE_NOT_EMPTY`-nya,
jadi app duluan berakhir di galat FK mentah, migrasi duluan membuat UI
melaporkan `orphanedArticles` yang tidak dikirim server.

Perubahan perilaku yang terlihat pengguna: menghapus website **tidak lagi
ditolak** saat masih berisi. Artikelnya jadi draf tak bertuan yang hanya
terlihat admin global; kategori dan tag miliknya ikut terhapus.

Dry-run terhadap produksi menangkap satu bug yang uji lokal lewatkan: artikel
multi-site tetap terbit di website lain sesudah pemiliknya dihapus, karena
CASCADE hanya membuang distribusi milik site yang dihapus. Diperbaiki sebelum
`COMMIT`; rinciannya di `docs/MIGRATION-LEDGER.md`.

Urutan yang dijalankan:

1. Inspeksi `docker compose ps` di stack Supabase bersama — 11 service sehat.
2. `pg_dump -Fc` → `~/db-backups/pre-280003-2026-09-28.dump` (4.3M), diverifikasi
   terbaca lewat `pg_restore -l` (3245 objek) — bukan sekadar file yang ada.
3. Dry-run migrasi penuh di produksi dalam `begin … rollback`, termasuk benar-benar
   memanggil `delete_site` pada website berisi lalu membatalkannya.
4. `COMMIT` + `NOTIFY`, lalu 9 marker diverifikasi — termasuk marker #280001 dan
   #280002 untuk memastikan tidak ada yang teregresi.
5. Deploy app: `git archive HEAD` (297 berkas; satu-satunya yang cocok pola `.env`
   adalah `.env.example`, templat berisi placeholder), SHA256 dicocokkan dua sisi,
   `docker-compose.yml` dan `Dockerfile` di-diff dulu (identik), direktori app
   di-backup ke `~/cms-artikel-pre-280003-2026-09-28.tar.gz`, `.env` dan
   `.env.production` dicek md5 sebelum **dan** sesudah ekstrak (identik).

Diverifikasi sesudah container naik:

- Gerbang auth utuh: `/api-keys`, `/api-docs`, `/team`, `/sites`, `/gallery`, `/`
  semua 307 → `/login`; `/login` 200; `/api/cms/sites` tanpa sesi 401.
- 3 request → 3 nonce CSP unik; HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy` terpasang; `X-Powered-By` tidak ada.
- Data utuh: 4 site, 4 artikel, 0 yatim, 10 baris distribusi — persis seperti
  sebelum migrasi. Skema aplikasi lain (`utero_academy`) tidak tersentuh.

### 28 September 2026 — koreksi topologi: dua deploy sebelumnya salah sasaran

Deploy Fase 3+5 (`d5bc84f`) dan #280003 (`0aa89cc`) dikirim ke
`~/apps/cms-artikel` di `20.20.20.173`, lalu diverifikasi lewat
`curl 127.0.0.1:3002` **di server itu**. Keduanya dilaporkan "terpasang di
produksi". Keduanya tidak.

Dua hal membuat kekeliruan ini lolos:

1. Bagian "Status Deployment" di dokumen ini menulis server + domain dalam satu
   blok, sehingga terbaca seolah aplikasi berjalan di sana.
2. **Kedua mesin memakai port yang sama**, `127.0.0.1:3002`. Probe dari server
   menjawab 200 dari container yang benar-benar ada di server — hanya saja
   container itu tidak menerima trafik. Verifikasi lewat localhost tidak pernah
   bisa membedakan keduanya.

Dampaknya bukan teoretis. Selama 16 hari `cms.carubra.com` tetap menjalankan
build 12 September, dan gerbang auth yang dicatat "sudah ditutup" masih terbuka:

| Path | Klaim di dokumen ini | Keadaan sebenarnya di `cms.carubra.com` |
|---|---|---|
| `/api-keys` | 307 → `/login` sejak 28 Sep | **200 tanpa sesi** |
| `/api-docs` | 307 → `/login` sejak 28 Sep | **200 tanpa sesi** |
| Header keamanan | HSTS, CSP nonce, X-Frame-Options | **tidak ada satu pun**; `X-Powered-By: Next.js` |

Halaman yang menerbitkan dan merotasi API key adalah yang tak berpagar.

Migrasi database **tidak** terpengaruh: keduanya memakai database yang sama di
`20.20.20.173`, jadi #280002 dan #280003 memang benar-benar terpasang.

Deploy ulang ke sasaran yang benar dilakukan hari yang sama di workstation:

1. Image lama ditandai `cms-artikel-cms-artikel:rollback-2026-09-28` sebagai
   titik pulang sebelum apa pun dibangun.
2. `docker compose build` — container lama tetap melayani trafik selama build.
3. Matcher diverifikasi **di dalam image baru**, bukan di file sumber:
   `.next/server/functions-config-manifest.json` → `/_middleware` →
   `originalSource` = `/((?!api(?:/|$)|_next/static/|_next/image/|image(?:/|$)|favicon(?:/|.ico$)).*)`.
   Batas segmen `api(?:/|$)` inilah yang berhenti menangkap `/api-keys`.
4. `docker compose up -d` — healthy dalam ~10 detik. `.env.production` dicek md5
   sebelum dan sesudah (identik).

Diverifikasi **lewat `https://cms.carubra.com`**, bukan localhost:

- `/api-keys`, `/api-docs`, `/team`, `/sites`, `/gallery`, `/` → 307 `/login`;
  `/login` → 200; `/api/cms/sites` dan `/api/cms/articles` tanpa sesi → 401.
- 3 request → 3 nonce CSP berbeda; 11/11 `<script>` ber-nonce dan cocok dengan
  header (0 tanpa nonce, 0 salah nonce) — hydration React hidup.
- HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy` terpasang; `X-Powered-By` hilang; `unsafe-eval` nol.

**Aturan verifikasi sesudah ini:** status produksi hanya sah kalau diprobe lewat
`https://cms.carubra.com`. `curl 127.0.0.1:3002` tidak membuktikan apa pun —
port itu ada di dua mesin.

## Command Reference

### Deploy/Update Aplikasi

Dijalankan **di workstation**, di root repo ini. Jangan SSH — aplikasi tidak
berjalan di `20.20.20.173`.

```bash
# Titik pulang dulu, sebelum apa pun dibangun
docker tag cms-artikel-cms-artikel cms-artikel-cms-artikel:rollback-$(date +%F)

# Build. Container lama tetap melayani trafik selama proses ini.
docker compose build

# Tukar. Di sinilah downtime terjadi (~10 detik).
docker compose up -d

# Lihat logs
docker logs cms-artikel -f
```

Rollback kalau ada yang salah:

```bash
docker tag cms-artikel-cms-artikel:rollback-2026-09-28 cms-artikel-cms-artikel:latest
docker compose up -d
```

Verifikasi **wajib lewat domain publik**, bukan `127.0.0.1:3002`:

```bash
for p in /api-keys /api-docs /team /sites /gallery / /login; do
  echo "$p -> $(curl -sS -o /dev/null -w '%{http_code}' https://cms.carubra.com$p)"
done
```

Harap: semua 307 kecuali `/login` yang 200.

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
