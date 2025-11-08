#!/bin/bash
# Quick deployment script for backend

echo "🚀 Deploying Backend to Vercel..."
echo ""

cd backend

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔄 Deploying to production..."
vercel --prod

echo ""
echo "✅ Backend deployed!"
echo ""
echo "🧪 Test your backend:"
echo "   curl https://home-treding-api-satvik8373s-projects.vercel.app/api/health"
echo ""
