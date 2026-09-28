# E2E Test Suite for Artikel CMS Automation API (PowerShell)
# Usage: .\tests\e2e\test_automation_api.ps1
#
# Ditulis ulang 28 September 2026, sejalan dengan test_automation_api.sh.
# Versi sebelumnya menguji endpoint yang salah: /functions/v1/artikel-cms dengan
# header x-artikel-key dan body envelope { action, data }. Edge Function itu tidak
# pernah ter-deploy dan sudah dihapus. Endpoint yang nyata:
# /functions/v1/automation-api, header x-api-key, body flat.
# Akibatnya suite lama pasti gagal di Test 1 dan tidak pernah menguji apa pun.
#
# Perubahan lain terhadap versi lama:
#   * Test "invalid slug format" dihapus. API tidak memvalidasi bentuk slug;
#     test itu menegaskan perilaku yang tidak pernah ada.
#   * Ditambah test GET (verifikasi key), satu-satunya jalur yang berfungsi penuh.
#   * `exit 1` di tiap kegagalan diganti penghitung pass/fail supaya semua test
#     berjalan dan ringkasan akhir tetap tercetak.
#   * RPC memakai RETURNS TABLE, jadi `data` adalah list. Versi lama membaca
#     $response.data.article_id yang selalu kosong.
#   * Field `category` diganti `category_name` sesuai kontrak nyata.
#
# ⚠️ Test ini menulis artikel sungguhan ke site milik API key yang dipakai.
# JANGAN jalankan terhadap produksi. Pakai site khusus tes.
#
# Prasyarat:
#   $env:SUPABASE_URL = "https://supabase.example.test"
#   $env:TEST_API_KEY = "ak_live_..."   # buat lewat CMS: Pengaturan > API Keys

param(
    [string]$ApiUrl = $env:SUPABASE_URL + "/functions/v1/automation-api",
    [string]$ApiKey = $env:TEST_API_KEY
)

if (-not $env:SUPABASE_URL) {
    Write-Error "SUPABASE_URL environment variable not set"
    exit 1
}

if (-not $ApiKey) {
    Write-Error "TEST_API_KEY environment variable not set. Key otomasi berawalan ak_live_; buat lewat CMS: Pengaturan > API Keys."
    exit 1
}

$Prefix = "e2e-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$script:Pass = 0
$script:Fail = 0

function Write-Pass([string]$Message) {
    Write-Host "PASS $Message" -ForegroundColor Green
    $script:Pass++
}

function Write-Fail([string]$Message) {
    Write-Host "FAIL $Message" -ForegroundColor Red
    $script:Fail++
}

# Invoke-RestMethod melempar pada status bukan 2xx, dan cara membaca body error
# berbeda antara Windows PowerShell 5.1 dan PowerShell 7. Helper ini menormalkan
# keduanya jadi @{ Code = <int>; Body = <object|null>; Raw = <string> }.
function Invoke-Api {
    param(
        [string]$Method,
        [string]$Key,
        [string]$Body
    )

    $headers = @{ "x-api-key" = $Key }
    $params = @{
        Uri             = $ApiUrl
        Method          = $Method
        Headers         = $headers
        UseBasicParsing = $true
        ErrorAction     = "Stop"
    }
    if ($Body) {
        $params.ContentType = "application/json"
        $params.Body = $Body
    }

    try {
        $response = Invoke-WebRequest @params
        $raw = $response.Content
        $code = [int]$response.StatusCode
    } catch {
        $raw = $null
        $code = 0

        if ($_.Exception.Response) {
            try { $code = [int]$_.Exception.Response.StatusCode } catch { $code = 0 }
        }

        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            # PowerShell 7 menaruh body respons error di sini.
            $raw = $_.ErrorDetails.Message
        } elseif ($_.Exception.Response -and $_.Exception.Response.PSObject.Methods['GetResponseStream']) {
            # Windows PowerShell 5.1 mengharuskan stream dibaca manual.
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $raw = $reader.ReadToEnd()
                $reader.Close()
            } catch {
                $raw = $null
            }
        }
    }

    $parsed = $null
    if ($raw) {
        try { $parsed = $raw | ConvertFrom-Json } catch { $parsed = $null }
    }

    return [pscustomobject]@{ Code = $code; Body = $parsed; Raw = $raw }
}

# RETURNS TABLE membuat `data` berupa array. Beberapa klien PowerShell membongkar
# array satu elemen jadi objek tunggal, jadi keduanya ditangani.
function Get-DataField {
    param($Response, [string]$Field)

    if (-not $Response.Body) { return $null }
    $data = $Response.Body.data
    if ($null -eq $data) { return $null }
    if ($data -is [System.Array]) {
        if ($data.Count -eq 0) { return $null }
        return $data[0].$Field
    }
    return $data.$Field
}

Write-Host "=== E2E Test Suite: Automation API ===" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl"
Write-Host "Prefix external_id: $Prefix"
Write-Host ""
Write-Host "PERINGATAN: test ini menulis artikel sungguhan. Pastikan ini bukan produksi." -ForegroundColor Yellow
Write-Host ""

# ---------------------------------------------------------------------------
# Test 1: GET - verifikasi API key dan identitas site
# ---------------------------------------------------------------------------
Write-Host "Test 1: GET verifikasi API key" -ForegroundColor Yellow
$response = Invoke-Api -Method "GET" -Key $ApiKey
$siteId = $null
if ($response.Body -and $response.Body.site) { $siteId = $response.Body.site.id }

if ($response.Code -eq 200 -and $siteId) {
    Write-Pass "Test 1: key valid untuk site $($response.Body.site.name)"
} else {
    Write-Fail "Test 1: GET gagal (HTTP $($response.Code))"
    if ($response.Raw) { Write-Host $response.Raw }
    Write-Host ""
    Write-Host "Tanpa key yang valid, sisa test tidak bermakna. Berhenti." -ForegroundColor Red
    exit 1
}
Write-Host ""

# ---------------------------------------------------------------------------
# Test 2: API key salah ditolak
# ---------------------------------------------------------------------------
Write-Host "Test 2: API key salah ditolak" -ForegroundColor Yellow
$response = Invoke-Api -Method "GET" -Key "ak_live_invalid-key-12345"

if ($response.Code -eq 401) {
    Write-Pass "Test 2: key tidak dikenal ditolak 401"
} else {
    Write-Fail "Test 2: harap 401, dapat $($response.Code)"
}
Write-Host ""

# ---------------------------------------------------------------------------
# Test 3: Buat artikel baru
# ---------------------------------------------------------------------------
Write-Host "Test 3: Buat artikel baru" -ForegroundColor Yellow
$body = @{
    external_id   = "$Prefix-001"
    title         = "E2E Test Article"
    slug          = "$Prefix-article"
    content       = "<p>This is an E2E test article</p>"
    excerpt       = "E2E test excerpt"
    category_name = "E2E Testing"
    status        = "draft"
} | ConvertTo-Json -Depth 10

$response = Invoke-Api -Method "POST" -Key $ApiKey -Body $body
$articleId = Get-DataField -Response $response -Field "article_id"
$createdNew = Get-DataField -Response $response -Field "created_new"
$categoryId1 = Get-DataField -Response $response -Field "category_id"

if ($response.Code -eq 200 -and $articleId -and $createdNew -eq $true) {
    Write-Pass "Test 3: artikel dibuat, id $articleId"
} else {
    Write-Fail "Test 3: gagal membuat artikel (HTTP $($response.Code))"
    if ($response.Raw) { Write-Host $response.Raw }
}
Write-Host ""

# ---------------------------------------------------------------------------
# Test 4: Upsert idempoten lewat external_id
# ---------------------------------------------------------------------------
Write-Host "Test 4: Upsert idempoten (external_id sama)" -ForegroundColor Yellow
$body = @{
    external_id   = "$Prefix-001"
    title         = "E2E Test Article (Updated)"
    slug          = "$Prefix-article-updated"
    content       = "<p>Updated E2E test article</p>"
    excerpt       = "Updated excerpt"
    category_name = "E2E Testing"
    status        = "draft"
} | ConvertTo-Json -Depth 10

$response = Invoke-Api -Method "POST" -Key $ApiKey -Body $body
$updatedId = Get-DataField -Response $response -Field "article_id"
$createdNew = Get-DataField -Response $response -Field "created_new"

if ($response.Code -eq 200 -and $createdNew -eq $false -and $updatedId -eq $articleId) {
    Write-Pass "Test 4: artikel diperbarui, bukan dibuat ulang"
} else {
    Write-Fail "Test 4: harap update pada artikel yang sama (HTTP $($response.Code), created_new=$createdNew)"
    if ($response.Raw) { Write-Host $response.Raw }
}
Write-Host ""

# ---------------------------------------------------------------------------
# Test 5: Field wajib yang hilang ditolak
# ---------------------------------------------------------------------------
# Wajib menurut supabase/functions/automation-api/index.ts:
# external_id, title, slug, content, category_name.
Write-Host "Test 5: Field wajib hilang ditolak" -ForegroundColor Yellow
foreach ($missing in @("title", "slug", "content", "category_name")) {
    $payload = @{
        external_id   = "$Prefix-missing-$missing"
        title         = "T"
        slug          = "$Prefix-missing-$missing"
        content       = "<p>c</p>"
        category_name = "E2E Testing"
    }
    $payload.Remove($missing)

    $response = Invoke-Api -Method "POST" -Key $ApiKey -Body ($payload | ConvertTo-Json -Depth 10)

    if ($response.Code -eq 400) {
        Write-Pass "Test 5: tanpa $missing ditolak 400"
    } else {
        Write-Fail "Test 5: tanpa $missing harap 400, dapat $($response.Code)"
    }
}
Write-Host ""

# ---------------------------------------------------------------------------
# Test 6: Status tidak dikenal ditolak
# ---------------------------------------------------------------------------
Write-Host "Test 6: Status tidak dikenal ditolak" -ForegroundColor Yellow
$body = @{
    external_id   = "$Prefix-bad-status"
    title         = "Bad Status"
    slug          = "$Prefix-bad-status"
    content       = "<p>x</p>"
    category_name = "E2E Testing"
    status        = "tidak-ada"
} | ConvertTo-Json -Depth 10

$response = Invoke-Api -Method "POST" -Key $ApiKey -Body $body

if ($response.Code -eq 400) {
    Write-Pass "Test 6: status tidak dikenal ditolak 400"
} else {
    Write-Fail "Test 6: harap 400, dapat $($response.Code)"
}
Write-Host ""

# ---------------------------------------------------------------------------
# Test 7: Kategori dipakai ulang
# ---------------------------------------------------------------------------
Write-Host "Test 7: Kategori dipakai ulang" -ForegroundColor Yellow
$body = @{
    external_id   = "$Prefix-cat-2"
    title         = "Category Test 2"
    slug          = "$Prefix-category-test-2"
    content       = "<p>Category test 2</p>"
    category_name = "E2E Testing"
} | ConvertTo-Json -Depth 10

$response = Invoke-Api -Method "POST" -Key $ApiKey -Body $body
$categoryId2 = Get-DataField -Response $response -Field "category_id"

if ($categoryId1 -and $categoryId1 -eq $categoryId2) {
    Write-Pass "Test 7: kategori dipakai ulang"
} else {
    Write-Fail "Test 7: category_id berbeda ($categoryId1 vs $categoryId2)"
}
Write-Host ""

# ---------------------------------------------------------------------------
Write-Host "=== Ringkasan: $script:Pass lulus, $script:Fail gagal ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Artikel tes memakai prefix external_id '$Prefix'. Bersihkan lewat CMS bila perlu."

if ($script:Fail -gt 0) {
    exit 1
}
