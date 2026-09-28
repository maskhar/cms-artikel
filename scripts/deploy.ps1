# Deploy CMS Artikel
#
# Aplikasi ini berjalan di WORKSTATION INI, bukan di 20.20.20.173.
# cms.carubra.com dilayani container `cms-artikel` lokal lewat cloudflared-tunnel
# yang berbagi network `carubra-network`. Server 20.20.20.173 hanya menjalankan
# Supabase (database, auth, storage) di https://supabase.carubra.com.
#
# Versi lama skrip ini mem-push kode ke ~/apps/cms-artikel di 20.20.20.173 dan
# membangunnya di sana. Container itu memang naik dan sehat — tapi tidak menerima
# trafik sama sekali, sehingga dua deploy keamanan (Fase 3+5 dan #280003) hanya
# tampak berhasil selama 16 hari sementara produksi nyata tetap menjalankan build
# lama dengan /api-keys terbuka tanpa sesi. Rinciannya di docs/DEPLOYMENT-CMS.md.
#
# Skrip lama juga rsync SELURUH direktori tanpa mengecualikan .env*, sehingga
# rahasia produksi ikut tersalin ke server.

$ErrorActionPreference = 'Stop'

Push-Location (Split-Path -Parent $PSScriptRoot)
try {

$stamp = Get-Date -Format 'yyyy-MM-dd'

Write-Host "==> Menandai image sekarang sebagai titik pulang..." -ForegroundColor Cyan
docker tag cms-artikel-cms-artikel "cms-artikel-cms-artikel:rollback-$stamp"
if ($LASTEXITCODE -ne 0) { throw "Gagal menandai image rollback." }
Write-Host "    cms-artikel-cms-artikel:rollback-$stamp"

Write-Host "`n==> Membangun image baru (container lama masih melayani trafik)..." -ForegroundColor Cyan
docker compose build
if ($LASTEXITCODE -ne 0) { throw "Build gagal. Produksi tidak tersentuh." }

Write-Host "`n==> Memeriksa matcher middleware DI DALAM image baru..." -ForegroundColor Cyan
# Diperiksa pada artefak build, bukan file sumber: matcher tanpa batas segmen
# membuat /api-keys cocok dengan pengecualian `api` dan lolos gerbang auth.
$manifest = docker run --rm --entrypoint sh cms-artikel-cms-artikel:latest -c 'cat .next/server/functions-config-manifest.json'
if ($manifest -notmatch 'api\(\?:') {
    throw "Matcher middleware tidak punya batas segmen `api(?:/|`$)`. Deploy dibatalkan."
}
Write-Host "    Batas segmen ada."

Write-Host "`n==> Menukar container (downtime ~10 detik)..." -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "Gagal menukar container. Jalankan rollback." }

Write-Host "`n==> Menunggu healthy..." -ForegroundColor Cyan
$healthy = $false
foreach ($i in 1..24) {
    $st = docker inspect cms-artikel --format '{{.State.Health.Status}}' 2>$null
    Write-Host "    [$i] $st"
    if ($st -eq 'healthy') { $healthy = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $healthy) { throw "Container tidak pernah healthy. Jalankan rollback." }

# Verifikasi wajib lewat domain publik. `curl 127.0.0.1:3002` TIDAK sah:
# port itu ada di workstation DAN di 20.20.20.173, jadi 200 dari localhost
# tidak membuktikan yang mana yang melayani cms.carubra.com.
Write-Host "`n==> Memverifikasi gerbang auth lewat https://cms.carubra.com..." -ForegroundColor Cyan
$gagal = @()
$harap = @{
    '/api-keys' = 307; '/api-docs' = 307; '/team' = 307
    '/sites'    = 307; '/gallery'  = 307; '/'     = 307
    '/login'    = 200
}
foreach ($path in $harap.Keys | Sort-Object) {
    $kode = (curl.exe -sS -o /dev/null -w '%{http_code}' --max-time 25 "https://cms.carubra.com$path")
    $ok = ([int]$kode -eq $harap[$path])
    $warna = if ($ok) { 'Green' } else { 'Red' }
    Write-Host ("    {0,-12} -> {1}  (harap {2})" -f $path, $kode, $harap[$path]) -ForegroundColor $warna
    if (-not $ok) { $gagal += $path }
}

if ($gagal.Count -gt 0) {
    Write-Host "`n!! Gerbang auth TIDAK sesuai pada: $($gagal -join ', ')" -ForegroundColor Red
    Write-Host "   Rollback:" -ForegroundColor Yellow
    Write-Host "     docker tag cms-artikel-cms-artikel:rollback-$stamp cms-artikel-cms-artikel:latest" -ForegroundColor Yellow
    Write-Host "     docker compose up -d" -ForegroundColor Yellow
    throw "Verifikasi produksi gagal."
}

Write-Host "`n==> Deploy selesai & terverifikasi di cms.carubra.com." -ForegroundColor Green
Write-Host "    Rollback tersedia: cms-artikel-cms-artikel:rollback-$stamp"

} finally {
    Pop-Location
}
