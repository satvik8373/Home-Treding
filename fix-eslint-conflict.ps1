# PowerShell script to fix ESLint conflict

Write-Host "🔧 Fixing ESLint Conflict..." -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣ Removing node_modules..." -ForegroundColor Yellow
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "2️⃣ Removing package-lock.json..." -ForegroundColor Yellow
Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue

Write-Host "3️⃣ Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force

Write-Host "4️⃣ Reinstalling dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "✅ ESLint conflict should be fixed!" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 Test the build:" -ForegroundColor Cyan
Write-Host "   npm run build"
Write-Host ""
