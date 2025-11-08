# PowerShell deployment script for frontend with market data fix

Write-Host "🚀 Deploying Frontend with Market Data Fix..." -ForegroundColor Cyan
Write-Host ""

Set-Location frontend

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "🔨 Building production bundle..." -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "🌐 Deploying to Vercel..." -ForegroundColor Yellow
vercel --prod

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 Test your site:" -ForegroundColor Cyan
Write-Host "   https://home-treding.vercel.app"
Write-Host ""
Write-Host "📊 Check market data:" -ForegroundColor Cyan
Write-Host "   Open browser console and look for:"
Write-Host "   🔧 API Configuration: { BASE_URL: 'https://home-treding-api-satvik8373s-projects.vercel.app', ... }"
Write-Host ""
