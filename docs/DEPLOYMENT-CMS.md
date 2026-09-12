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
