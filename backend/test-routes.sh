#!/bin/bash
# Test script to verify all routes work

echo "🧪 Testing Backend Routes..."
echo ""

BASE_URL="http://localhost:3001"

echo "1️⃣ Testing root endpoint (/)..."
curl -s "$BASE_URL/" | jq .
echo ""

echo "2️⃣ Testing /api endpoint..."
curl -s "$BASE_URL/api" | jq .
echo ""

echo "3️⃣ Testing health check..."
curl -s "$BASE_URL/api/health" | jq .
echo ""

echo "4️⃣ Testing broker list..."
curl -s "$BASE_URL/api/broker/list?userId=test" | jq .
echo ""

echo "5️⃣ Testing market data..."
curl -s "$BASE_URL/api/market/all" | jq .
echo ""

echo "6️⃣ Testing CORS headers..."
curl -s -I -H "Origin: https://home-treding.vercel.app" "$BASE_URL/api/health" | grep -i "access-control"
echo ""

echo "✅ All tests complete!"
