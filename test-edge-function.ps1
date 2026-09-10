# Test Automation API Edge Function
# Usage: .\test-edge-function.ps1

$SUPABASE_URL = "https://supabase.maskhar.net"
$API_KEY = "YOUR_API_KEY_HERE"

$headers = @{
    "x-api-key" = $API_KEY
    "Content-Type" = "application/json"
}

$body = @{
    external_id = "test-20260911003244"
    title = "Test Article from PowerShell"
    content = "<p>This is a test article created via Automation API</p>"
    excerpt = "Test excerpt"
    status = "draft"
    tags = @("test", "automation")
} | ConvertTo-Json

Write-Host "Testing Automation API Edge Function..." -ForegroundColor Cyan
Write-Host "URL: $SUPABASE_URL/functions/v1/automation-api" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod 
        -Uri "$SUPABASE_URL/functions/v1/automation-api" 
        -Method Post 
        -Headers $headers 
        -Body $body

    Write-Host "
✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "
❌ ERROR!" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}
