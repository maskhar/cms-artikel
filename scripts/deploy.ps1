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

# Stempel memuat jam: dua deploy di hari yang sama tidak boleh saling menimpa
# titik pulang. Versi lama memakai tanggal saja, sehingga deploy kedua
# membuang satu-satunya image yang bisa dipulihkan.
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'

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
#
# `docker run` mengembalikan ARRAY baris, bukan satu string. Pada array,
# `-match`/`-notmatch` di PowerShell adalah FILTER, bukan uji benar/salah:
# keduanya mengembalikan daftar baris, dan daftar tak kosong selalu truthy.
# Versi pertama skrip ini memakai `if ($manifest -notmatch ...)` sehingga
# gerbangnya gagal 100% dari waktu, apa pun isi manifesnya. Karena itu
# array digabung dulu jadi satu string dengan -join.
$manifest = (docker run --rm --entrypoint sh cms-artikel-cms-artikel:latest `
    -c 'cat .next/server/functions-config-manifest.json') -join "`n"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($manifest)) {
    throw "Tidak bisa membaca functions-config-manifest.json dari image. Deploy dibatalkan."
}

# Dicocokkan ke originalSource milik /_middleware, bukan sekadar "ada
# substring api(?: di suatu tempat dalam berkas" — regexp hasil kompilasi
# juga memuatnya, jadi cek longgar bisa lulus walau matcher sumbernya salah.
$src = [regex]::Match($manifest, '"/_middleware".*?"originalSource"\s*:\s*"([^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $src.Success) {
    throw "Middleware tidak terdaftar di manifes image (/_middleware tidak ada). Deploy dibatalkan."
}
$matcher = $src.Groups[1].Value
Write-Host "    matcher: $matcher"

# Tanpa batas segmen, /api-keys cocok dengan pengecualian `api` lalu lolos
# gerbang auth — halaman penerbit & perotasi API key jadi yang tak berpagar.
if ($matcher -notlike '*api(?:/|$)*') {
    throw "Matcher tidak punya batas segmen setelah 'api'. /api-keys akan lolos gerbang auth. Deploy dibatalkan."
}
Write-Host "    Batas segmen ada." -ForegroundColor Green

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
    # -o NUL, bukan /dev/null: curl.exe di Windows gagal menulis ke path Unix
    # dan memuntahkan "curl: (23) client returned ERROR on write" tiap baris.
    $kode = (curl.exe -sS -o NUL -w '%{http_code}' --max-time 25 "https://cms.carubra.com$path")
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
