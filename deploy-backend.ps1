# PowerShell deployment script for backend

Write-Host "🚀 Deploying Backend to Vercel..." -ForegroundColor Cyan
Write-Host ""

Set-Location backend

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "🔄 Deploying to production..." -ForegroundColor Yellow
vercel --prod

Write-Host ""
Write-Host "✅ Backend deployed!" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 Test your backend:" -ForegroundColor Cyan
Write-Host "   curl https://home-treding-api-satvik8373s-projects.vercel.app/api/health"
Write-Host ""
