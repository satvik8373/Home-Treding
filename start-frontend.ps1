# PowerShell script to start frontend

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Frontend Development Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting npm..." -ForegroundColor Green
Write-Host ""

npm start
