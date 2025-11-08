#!/bin/bash
# Quick deployment script for frontend with market data fix

echo "🚀 Deploying Frontend with Market Data Fix..."
echo ""

cd frontend

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Building production bundle..."
npm run build

echo ""
echo "🌐 Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Test your site:"
echo "   https://home-treding.vercel.app"
echo ""
echo "📊 Check market data:"
echo "   Open browser console and look for:"
echo "   🔧 API Configuration: { BASE_URL: 'https://home-treding-api-satvik8373s-projects.vercel.app', ... }"
echo ""
