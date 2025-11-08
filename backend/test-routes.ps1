# PowerShell test script to verify all routes work

Write-Host "🧪 Testing Backend Routes..." -ForegroundColor Cyan
Write-Host ""

$BaseUrl = "http://localhost:3001"

Write-Host "1️⃣ Testing root endpoint (/)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/" -Method Get
    $response | ConvertTo-Json
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "2️⃣ Testing /api endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api" -Method Get
    $response | ConvertTo-Json
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "3️⃣ Testing health check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get
    $response | ConvertTo-Json
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "4️⃣ Testing broker list..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/broker/list?userId=test" -Method Get
    $response | ConvertTo-Json
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "5️⃣ Testing market data..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/market/all" -Method Get
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "6️⃣ Testing CORS headers..." -ForegroundColor Yellow
try {
    $headers = @{
        "Origin" = "https://home-treding.vercel.app"
    }
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/health" -Method Get -Headers $headers
    Write-Host "CORS Headers:"
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "*Access-Control*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "✅ All tests complete!" -ForegroundColor Green
