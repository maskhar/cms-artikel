# E2E Test Suite for Artikel CMS Automation API (PowerShell)
# Purpose: End-to-end testing of the automation API endpoint
# Usage: .\tests\e2e\test_automation_api.ps1

param(
    [string]$ApiUrl = $env:SUPABASE_URL + "/functions/v1/artikel-cms",
    [string]$ApiKey = $env:TEST_API_KEY
)

if (-not $ApiKey) {
    Write-Error "TEST_API_KEY environment variable not set"
    exit 1
}

if (-not $env:SUPABASE_URL) {
    Write-Error "SUPABASE_URL environment variable not set"
    exit 1
}

Write-Host "=== E2E Test Suite: Automation API ===" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl"
Write-Host ""

# Test 1: Create new article
Write-Host "Test 1: Create new article" -ForegroundColor Yellow
$body = @{
    action = "article.upsert"
    data = @{
        external_id = "test-001"
        title = "E2E Test Article"
        slug = "e2e-test-article"
        content = "<p>This is an E2E test article</p>"
        excerpt = "E2E test excerpt"
        category = "Testing"
        status = "draft"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post `
        -Headers @{"Content-Type"="application/json"; "x-artikel-key"=$ApiKey} `
        -Body $body
    
    Write-Host ($response | ConvertTo-Json -Depth 10)
    
    if ($response.data.article_id) {
        Write-Host "✓ Test 1 PASSED: Article created with ID $($response.data.article_id)" -ForegroundColor Green
    } else {
        Write-Host "✗ Test 1 FAILED" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Test 1 FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Update existing article
Write-Host "Test 2: Update existing article" -ForegroundColor Yellow
$body = @{
    action = "article.upsert"
    data = @{
        external_id = "test-001"
        title = "E2E Test Article (Updated)"
        slug = "e2e-test-article-updated"
        content = "<p>This is an updated E2E test article</p>"
        excerpt = "Updated E2E test excerpt"
        category = "Testing"
        status = "published"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post `
        -Headers @{"Content-Type"="application/json"; "x-artikel-key"=$ApiKey} `
        -Body $body
    
    Write-Host ($response | ConvertTo-Json -Depth 10)
    
    if ($response.data.created -eq $false) {
        Write-Host "✓ Test 2 PASSED: Article updated (not created)" -ForegroundColor Green
    } else {
        Write-Host "✗ Test 2 FAILED: Expected update but got creation" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Test 2 FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Invalid API key
Write-Host "Test 3: Invalid API key" -ForegroundColor Yellow
$body = @{
    action = "article.upsert"
    data = @{
        external_id = "test-002"
        title = "Should Fail"
        slug = "should-fail"
        content = "<p>Should fail</p>"
        category = "Testing"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post `
        -Headers @{"Content-Type"="application/json"; "x-artikel-key"="invalid-key-12345"} `
        -Body $body
    
    Write-Host "✗ Test 3 FAILED: Should have been rejected" -ForegroundColor Red
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✓ Test 3 PASSED: Invalid API key rejected" -ForegroundColor Green
    } else {
        Write-Host "✗ Test 3 FAILED: Expected 401, got $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Test 4: Missing required field
Write-Host "Test 4: Missing required field (title)" -ForegroundColor Yellow
$body = @{
    action = "article.upsert"
    data = @{
        external_id = "test-003"
        slug = "missing-title"
        content = "<p>Missing title</p>"
        category = "Testing"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post `
        -Headers @{"Content-Type"="application/json"; "x-artikel-key"=$ApiKey} `
        -Body $body
    
    Write-Host "✗ Test 4 FAILED: Should have been rejected" -ForegroundColor Red
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "✓ Test 4 PASSED: Missing title rejected" -ForegroundColor Green
    } else {
        Write-Host "✗ Test 4 FAILED: Expected 400, got $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Test 5: Invalid slug format
Write-Host "Test 5: Invalid slug format" -ForegroundColor Yellow
$body = @{
    action = "article.upsert"
    data = @{
        external_id = "test-004"
        title = "Invalid Slug Test"
        slug = "Invalid Slug With Spaces!"
        content = "<p>Invalid slug</p>"
        category = "Testing"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post `
        -Headers @{"Content-Type"="application/json"; "x-artikel-key"=$ApiKey} `
        -Body $body
    
    Write-Host "✗ Test 5 FAILED: Should have been rejected" -ForegroundColor Red
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "✓ Test 5 PASSED: Invalid slug rejected" -ForegroundColor Green
    } else {
        Write-Host "✗ Test 5 FAILED: Expected 400, got $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Test 6: Category reuse
Write-Host "Test 6: Category reuse" -ForegroundColor Yellow
$body1 = @{
    action = "article.upsert"
    data = @{
        external_id = "cat-test-1"
        title = "Category Test 1"
        slug = "category-test-1"
        content = "<p>Category test 1</p>"
        category = "E2E Category"
    }
} | ConvertTo-Json -Depth 10

$response1 = Invoke-RestMethod -Uri $ApiUrl -Method Post `
    -Headers @{"Content-Type"="application/json"; "x-artikel-key"=$ApiKey} `
    -Body $body1

$categoryId1 = $response1.data.category_id

$body2 = @{
    action = "article.upsert"
    data = @{
        external_id = "cat-test-2"
        title = "Category Test 2"
        slug = "category-test-2"
        content = "<p>Category test 2</p>"
        category = "E2E Category"
    }
} | ConvertTo-Json -Depth 10

$response2 = Invoke-RestMethod -Uri $ApiUrl -Method Post `
    -Headers @{"Content-Type"="application/json"; "x-artikel-key"=$ApiKey} `
    -Body $body2

$categoryId2 = $response2.data.category_id

if ($categoryId1 -eq $categoryId2) {
    Write-Host "✓ Test 6 PASSED: Category reused correctly" -ForegroundColor Green
} else {
    Write-Host "✗ Test 6 FAILED: Different category IDs ($categoryId1 vs $categoryId2)" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "=== All E2E Tests Completed Successfully ===" -ForegroundColor Green
