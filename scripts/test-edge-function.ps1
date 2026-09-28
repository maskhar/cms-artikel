# Smoke test Automation API Edge Function
# Usage:
#   $env:SUPABASE_URL = "https://supabase.carubra.com"
#   $env:TEST_API_KEY = "ak_live_..."
#   .\scripts\test-edge-function.ps1            # hanya GET (tidak menulis apa pun)
#   .\scripts\test-edge-function.ps1 -Post      # GET lalu POST artikel uji
#
# Diperbaiki 28 September 2026. Versi sebelumnya tidak bisa dijalankan sama sekali:
# backtick penyambung baris pada Invoke-RestMethod hilang. Skrip itu tetap lolos
# parse, tapi saat dijalankan 'Invoke-RestMethod' dipanggil tanpa argumen dan
# '-Uri' berikutnya dieksekusi sebagai nama perintah tersendiri -> CommandNotFound.
# Selain itu URL-nya supabase.maskhar.net (yang terkonfigurasi:
# supabase.carubra.com), API key di-hardcode, dan payload-nya kehilangan field
# wajib 'slug' dan 'category_name' sambil mengirim 'tags' yang tidak pernah
# diproses API -> pasti 400.

param(
    [string]$SupabaseUrl = $env:SUPABASE_URL,
    [string]$ApiKey = $env:TEST_API_KEY,
    [switch]$Post
)

if (-not $SupabaseUrl) {
    Write-Error "SUPABASE_URL belum di-set. Contoh: `$env:SUPABASE_URL = 'https://supabase.carubra.com'"
    exit 1
}

if (-not $ApiKey) {
    Write-Error "TEST_API_KEY belum di-set. Key berawalan ak_live_; buat lewat CMS: menu API keys."
    exit 1
}

$Endpoint = "$SupabaseUrl/functions/v1/automation-api"
$headers = @{ "x-api-key" = $ApiKey }

function Show-ErrorResponse($ErrorRecord) {
    $code = 0
    if ($ErrorRecord.Exception.Response) {
        try { $code = [int]$ErrorRecord.Exception.Response.StatusCode } catch { $code = 0 }
    }
    Write-Host "HTTP $code" -ForegroundColor Red

    $raw = $null
    if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
        # PowerShell 7
        $raw = $ErrorRecord.ErrorDetails.Message
    } elseif ($ErrorRecord.Exception.Response -and $ErrorRecord.Exception.Response.PSObject.Methods['GetResponseStream']) {
        # Windows PowerShell 5.1
        try {
            $reader = New-Object System.IO.StreamReader($ErrorRecord.Exception.Response.GetResponseStream())
            $raw = $reader.ReadToEnd()
            $reader.Close()
        } catch {
            $raw = $null
        }
    }

    if ($raw) { Write-Host $raw -ForegroundColor Red }

    if ($code -eq 500 -and $raw -like "*not configured*") {
        Write-Host ""
        Write-Host "ARTIKEL_API_KEY_PEPPER belum ter-set di container supabase-edge-functions." -ForegroundColor Yellow
        Write-Host "Lihat docs/API-DEPLOYMENT.md bagian Deploy Automation API." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# GET: verifikasi API key. Tidak menulis apa pun.
# ---------------------------------------------------------------------------
Write-Host "GET  $Endpoint" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $Endpoint -Method Get -Headers $headers
    Write-Host "OK - key valid untuk site: $($response.site.name) ($($response.site.id))" -ForegroundColor Green
} catch {
    Write-Host "GAGAL" -ForegroundColor Red
    Show-ErrorResponse $_
    exit 1
}

if (-not $Post) {
    Write-Host ""
    Write-Host "Lewati POST. Jalankan dengan -Post untuk menguji penulisan artikel." -ForegroundColor Gray
    exit 0
}

# ---------------------------------------------------------------------------
# POST: menulis artikel sungguhan.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "PERINGATAN: POST menulis artikel sungguhan ke site di atas. Jangan jalankan terhadap produksi." -ForegroundColor Yellow
Write-Host ""

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

# Field wajib: external_id, title, slug, content, category_name.
$body = @{
    external_id   = "smoke-$stamp"
    title         = "Smoke Test $stamp"
    slug          = "smoke-test-$stamp"
    content       = "<p>Artikel uji dari scripts/test-edge-function.ps1</p>"
    excerpt       = "Artikel uji"
    category_name = "Smoke Test"
    status        = "draft"
} | ConvertTo-Json

Write-Host "POST $Endpoint" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $headers -ContentType "application/json" -Body $body

    # RPC memakai RETURNS TABLE, jadi data adalah array.
    $row = if ($response.data -is [System.Array]) { $response.data[0] } else { $response.data }

    Write-Host "OK - article_id $($row.article_id), created_new=$($row.created_new)" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "Hapus artikel 'smoke-$stamp' lewat CMS bila tidak diperlukan." -ForegroundColor Gray
} catch {
    Write-Host "GAGAL" -ForegroundColor Red
    Show-ErrorResponse $_
    exit 1
}
