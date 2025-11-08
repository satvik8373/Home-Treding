# PowerShell script to start frontend from frontend folder

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Frontend from frontend/" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Installing dependencies if needed..." -ForegroundColor Green
npm install
Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host ""
npm start
