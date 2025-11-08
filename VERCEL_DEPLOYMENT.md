# Vercel Deployment Guide - Two Projects

## Overview
This project requires TWO separate Vercel deployments:
1. **Frontend** - React app (root directory)
2. **Backend** - Express API (backend directory)

## Deployment Steps

### 1. Deploy Frontend

**In Vercel Dashboard:**
1. Create new project: "home-trading-frontend"
2. Import your GitHub repository
3. **Root Directory:** Leave empty (or set to `.`)
4. **Framework Preset:** Create React App
5. **Build Command:** `npm run build`
6. **Output Directory:** `build`
7. **Install Command:** `npm install`
8. Click **Deploy**

**Environment Variables (Frontend):**
```
REACT_APP_API_URL=https://your-backend.vercel.app
REACT_APP_WEBSOCKET_URL=https://your-backend.vercel.app
```

### 2. Deploy Backend

**In Vercel Dashboard:**
1. Create new project: "home-trading-backend"
2. Import the SAME GitHub repository
3. **Root Directory:** `backend` ← IMPORTANT!
4. **Framework Preset:** Other
5. **Build Command:** Leave empty
6. **Output Directory:** Leave empty
7. **Install Command:** `npm install`
8. Click **Deploy**

**Environment Variables (Backend):**
```
FRONTEND_URL=https://your-frontend.vercel.app
DHAN_CLIENT_ID=your_client_id
DHAN_ACCESS_TOKEN=your_access_token
NODE_ENV=production
```

## Update Frontend API URL

After backend is deployed, update frontend environment variable:

1. Go to Frontend project → Settings → Environment Variables
2. Update `REACT_APP_API_URL` with your backend URL
3. Redeploy frontend

## Project Structure

```
/
├── backend/              # Backend Express server
│   ├── algorroms-server.js
│   ├── package.json
│   └── vercel.json      # Backend Vercel config
├── src/                 # Frontend React app
├── public/
├── package.json         # Frontend package.json
└── vercel.json          # Frontend Vercel config
```

## Testing

**Frontend:** https://your-frontend.vercel.app
**Backend API:** https://your-backend.vercel.app/api/health

## Troubleshooting

### Backend 500 Error
- Check backend logs in Vercel dashboard
- Verify environment variables are set
- Check that Root Directory is set to `backend`

### Frontend Can't Connect to Backend
- Verify `REACT_APP_API_URL` is set correctly
- Check CORS settings in backend
- Ensure backend is deployed and running

### Build Fails
- Clear Vercel build cache
- Check package.json dependencies
- Review build logs for specific errors

## Important Notes

⚠️ **Two Separate Projects Required**
- You MUST create two different Vercel projects
- They share the same GitHub repository
- But use different Root Directory settings

⚠️ **Environment Variables**
- Set them in Vercel Dashboard, not in code
- Frontend needs backend URL
- Backend needs frontend URL for CORS

⚠️ **CORS Configuration**
- Backend must allow frontend domain
- Update CORS settings in `algorroms-server.js`
