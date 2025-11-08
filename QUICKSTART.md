# Quick Start Guide - Vercel Deployment

## What Changed?

Your backend has been **refactored for Vercel serverless deployment**:

✅ **Before**: Express server (`backend/algorroms-server.js`) - Won't work on Vercel  
✅ **After**: Serverless functions (`/api` folder) - Works perfectly on Vercel

## Deploy in 3 Steps

### Step 1: Push to Git
```bash
git add .
git commit -m "Refactor backend for Vercel serverless"
git push
```

### Step 2: Deploy to Vercel

**Option A: Vercel Dashboard (Easiest)**
1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Add New Project"
4. Select your repository
5. Click "Deploy" (Vercel auto-detects config)

**Option B: Vercel CLI**
```bash
npm install -g vercel
vercel
```

### Step 3: Done! 🎉

Your app is live at: `https://your-app.vercel.app`

## Test Your Deployment

```bash
# Test API endpoints
curl https://your-app.vercel.app/api/health
curl https://your-app.vercel.app/api/market
```

## Local Development

```bash
# Install dependencies
npm install

# Start frontend
cd frontend
npm install
npm start

# Test API locally (if using Vercel CLI)
vercel dev
```

## Environment Variables (Optional)

Add in Vercel Dashboard → Settings → Environment Variables:

```
DHAN_CLIENT_ID=your_client_id
DHAN_ACCESS_TOKEN=your_access_token
```

## Key Changes Made

### 1. New API Structure
```
/api
├── _lib/
│   ├── brokerStore.js  # Shared broker storage
│   └── cors.js         # CORS middleware
├── auth/
│   ├── login.js        # Login endpoint
│   └── register.js     # Register endpoint
├── portfolio/
│   └── positions.js    # Portfolio data
├── brokers.js          # Broker management
├── health.js           # Health check
├── market.js           # Market data (Yahoo Finance)
├── strategies.js       # Strategy management
└── package.json        # API dependencies
```

### 2. Updated Configuration
- ✅ `vercel.json` - Vercel deployment config
- ✅ `package.json` - Added `vercel-build` script
- ✅ `.vercelignore` - Excludes old backend folder

### 3. Serverless Functions
Each API endpoint is now a separate serverless function that:
- Handles CORS automatically
- Scales automatically
- Costs nothing when not in use

## Important Notes

⚠️ **State Management**: Current implementation uses in-memory storage (resets on each function call). For production, add a database:
- MongoDB Atlas (free tier)
- Vercel Postgres
- Firebase Firestore

⚠️ **WebSockets**: Not supported on Vercel. Use polling or external service for real-time updates.

## Troubleshooting

### Build Fails
```bash
# Check logs
vercel logs

# Test build locally
npm run vercel-build
```

### API Returns 404
- Check `vercel.json` routes configuration
- Verify API files are in `/api` folder
- Check Vercel function logs

### CORS Errors
- CORS is handled in `api/_lib/cors.js`
- All endpoints use `handleCors()` wrapper

## Next Steps

1. ✅ Deploy to Vercel
2. 🔄 Add database for persistence
3. 🔄 Configure environment variables
4. 🔄 Update frontend API URL
5. 🔄 Test all features

## Need Help?

- 📖 [Full Deployment Guide](./DEPLOYMENT.md)
- 🔗 [Vercel Docs](https://vercel.com/docs)
- 🐛 Check Vercel Dashboard → Logs

---

**Ready to deploy?** Just push to Git and connect to Vercel! 🚀
