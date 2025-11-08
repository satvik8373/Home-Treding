# 🔧 Production Market Data Not Showing - Fix

## Problem

Market data shows properly on localhost but not in production (Vercel).

## Root Cause Analysis

The backend API is working correctly and returning real data:
```
✅ https://home-treding-api-satvik8373s-projects.vercel.app/api/market/all
Returns: Real market data from Yahoo Finance
```

The issue is likely one of these:

### 1. Environment Variable Not Set in Vercel

The frontend needs `REACT_APP_API_BASE_URL` to be set in Vercel.

### 2. Build-time vs Runtime Configuration

React environment variables are embedded at **build time**, not runtime.

## Solution

### Step 1: Set Environment Variable in Vercel

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your **frontend** project (home-treding)
3. Go to **Settings** → **Environment Variables**
4. Add this variable:

```
Name: REACT_APP_API_BASE_URL
Value: https://home-treding-api-satvik8373s-projects.vercel.app
Environment: Production
```

5. Click **Save**

### Step 2: Redeploy Frontend

After adding the environment variable, you MUST redeploy:

```bash
cd frontend
vercel --prod
```

Or trigger a redeploy from Vercel dashboard:
- Go to Deployments tab
- Click "..." on latest deployment
- Click "Redeploy"

### Step 3: Verify

After redeployment, check browser console:

```javascript
// Should see:
🔧 API Configuration: {
  BASE_URL: 'https://home-treding-api-satvik8373s-projects.vercel.app',
  WS_URL: 'https://home-treding-api-satvik8373s-projects.vercel.app',
  ENV_VAR: 'https://home-treding-api-satvik8373s-projects.vercel.app'
}
```

## Alternative: Hardcode API URL (Quick Fix)

If you want a quick fix without environment variables:

### Edit `frontend/src/config/api.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: 'https://home-treding-api-satvik8373s-projects.vercel.app',
  WS_URL: 'https://home-treding-api-satvik8373s-projects.vercel.app',
};
```

Then rebuild and deploy:

```bash
cd frontend
npm run build
vercel --prod
```

## Debugging Steps

### 1. Check Current API URL

Open production site and check console:
```
https://home-treding.vercel.app
```

Look for the log:
```
🔧 API Configuration: { BASE_URL: '...', ... }
```

### 2. Check Network Requests

Open DevTools → Network tab:
- Look for requests to `/api/market/all`
- Check if URL is correct
- Check response status

### 3. Test API Directly

```bash
curl https://home-treding-api-satvik8373s-projects.vercel.app/api/market/all
```

Should return market data.

### 4. Check for CORS Errors

If you see CORS errors, the backend needs to allow your frontend domain.

## Common Issues

### Issue 1: Wrong API URL

**Symptom:** Requests go to `http://localhost:5000`

**Fix:** Set `REACT_APP_API_BASE_URL` in Vercel and redeploy

### Issue 2: Environment Variable Not Applied

**Symptom:** Console shows wrong URL even after setting env var

**Fix:** Redeploy after setting environment variable (env vars are build-time)

### Issue 3: CORS Errors

**Symptom:** `Access-Control-Allow-Origin` error

**Fix:** Backend already configured to allow your domain, but verify:
```javascript
// backend/api/services/realMarketData.js
allowedOrigins = [
  'https://home-treding.vercel.app',
  ...
]
```

### Issue 4: API Returns 404

**Symptom:** `/api/market/all` returns 404

**Fix:** Redeploy backend:
```bash
cd backend
vercel --prod
```

## Verification Checklist

After applying fixes:

- [ ] Environment variable set in Vercel dashboard
- [ ] Frontend redeployed after setting env var
- [ ] Console shows correct API URL
- [ ] Network tab shows requests to correct URL
- [ ] API returns 200 status
- [ ] Market data displays on page
- [ ] No CORS errors in console

## Quick Test Script

Run this in browser console on production site:

```javascript
// Test API connection
fetch('https://home-treding-api-satvik8373s-projects.vercel.app/api/market/all')
  .then(r => r.json())
  .then(data => {
    console.log('✅ API Working:', data);
    console.log('📊 Symbols:', data.data.map(d => d.symbol));
  })
  .catch(err => {
    console.error('❌ API Error:', err);
  });
```

Expected output:
```
✅ API Working: { success: true, data: [...], ... }
📊 Symbols: ['NIFTY', 'BANKNIFTY', 'SENSEX', ...]
```

## Summary

**Most Likely Issue:** Environment variable not set in Vercel

**Quick Fix:**
1. Add `REACT_APP_API_BASE_URL` to Vercel environment variables
2. Redeploy frontend
3. Verify in browser console

**Alternative:** Hardcode API URL in `frontend/src/config/api.ts`

After applying the fix, market data should display in production! 🚀
