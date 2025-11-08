# 🚀 Deployment Checklist

## Pre-Deployment

- [x] CORS configured for `https://home-treding.vercel.app`
- [x] Backend routes created and tested
- [x] Frontend `.env.production` updated with correct API URL
- [ ] All changes committed to Git

## Backend Deployment

### Option 1: Deploy via Vercel CLI

```bash
cd backend
vercel --prod
```

### Option 2: Deploy via Git Push

```bash
git add .
git commit -m "Fix CORS and update API routes"
git push origin main
```

Vercel will auto-deploy if connected to your GitHub repo.

### Verify Backend

Test these endpoints after deployment:

```bash
# Health check
curl https://home-treding-api-satvik8373s-projects.vercel.app/api/health

# Broker list
curl https://home-treding-api-satvik8373s-projects.vercel.app/api/broker/list?userId=test

# Market data
curl https://home-treding-api-satvik8373s-projects.vercel.app/api/market/all
```

Expected: All should return JSON responses (not CORS errors)

## Frontend Deployment

### Build and Deploy

```bash
cd frontend
npm run build
vercel --prod
```

Or push to Git for auto-deployment.

### Verify Frontend

1. Open `https://home-treding.vercel.app` in browser
2. Open DevTools Console (F12)
3. Check for CORS errors - **should be GONE!** ✅
4. Test broker list loading
5. Test market data loading

## Post-Deployment Checks

- [ ] No CORS errors in browser console
- [ ] API endpoints responding correctly
- [ ] Broker list loads successfully
- [ ] Market data loads successfully
- [ ] Authentication works (if implemented)
- [ ] All features working as expected

## If Issues Occur

### CORS errors still present?

1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check Vercel deployment logs: `vercel logs`
4. Verify environment variables in Vercel dashboard
5. Check that backend redeployed successfully

### API not responding?

1. Check Vercel function logs in dashboard
2. Verify `backend/api/index.js` deployed correctly
3. Test with curl to isolate issue
4. Check Vercel build logs for errors

### Frontend not connecting?

1. Verify `REACT_APP_API_BASE_URL` in Vercel environment variables
2. Check browser Network tab for actual URL being called
3. Ensure frontend was rebuilt after `.env.production` changes

## Environment Variables to Set in Vercel

### Frontend Project

Go to Vercel Dashboard → Your Frontend Project → Settings → Environment Variables

Add:
```
REACT_APP_API_BASE_URL=https://home-treding-api-satvik8373s-projects.vercel.app
REACT_APP_FIREBASE_API_KEY=AIzaSyBQLsyKBjUPr3CNPKjVeTCPXTkasFIOAhE
REACT_APP_FIREBASE_AUTH_DOMAIN=mine-treding.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=mine-treding
```

### Backend Project

No environment variables needed for basic CORS fix.

## Success Criteria

✅ Frontend loads without errors
✅ No CORS errors in console
✅ API calls succeed
✅ Data displays correctly
✅ All features functional

## Quick Commands Reference

```bash
# Deploy backend
cd backend && vercel --prod

# Deploy frontend
cd frontend && npm run build && vercel --prod

# View logs
vercel logs

# Check deployment status
vercel ls

# Test API
curl https://home-treding-api-satvik8373s-projects.vercel.app/api/health
```

## Need Help?

- Check `CORS_FIX_DEPLOYMENT.md` for detailed explanation
- Check `ALLOWED_DOMAINS.md` for CORS configuration
- Review Vercel logs for specific errors
- Test endpoints with curl to isolate issues
