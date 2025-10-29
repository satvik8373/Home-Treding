# Backend Environment Variables Setup

## Required Environment Variables for Render/Railway

Copy these to your deployment platform's environment variables section:

### 1. Server Configuration
```
NODE_ENV=production
PORT=10000
```

### 2. CORS Configuration
```
FRONTEND_URL=https://your-app.vercel.app
```
**⚠️ UPDATE THIS** after deploying frontend to Vercel

### 3. Rate Limiting
```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

### 4. Firebase Configuration
Get these from Firebase Console:
1. Go to Firebase Console > Project Settings
2. Click "Service Accounts" tab
3. Click "Generate New Private Key"
4. Copy values from the downloaded JSON:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour-Key-Here\n-----END PRIVATE KEY-----
```

**Important**: For `FIREBASE_PRIVATE_KEY`, keep the `\n` characters as-is.

### 5. Dhan API Configuration
```
DHAN_ACCESS_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzYxNjUzNTkxLCJpYXQiOjE3NjE1NjcxOTEsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTA4ODkzODQxIn0.8IMH_F0w2tLtMfyhygARc3a__t9cdlEnRHhds9hOh2sDrPCyi64pm9Yc8wBXwVnc722BFLFdyp_0VoIA33qxKQ

DHAN_CLIENT_ID=1108893841

DHAN_CLIENT_SECRET=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJwYXJ0bmVySWQiOiIiLCJkaGFuQ2xpZW50SWQiOiIyNTEwMjExNzQwIiwid2ViaG9va1VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2NhbGxiYWNrIiwiaXNzIjoiZGhhbiIsImV4cCI6MTc2MzY0MzY2MH0.tMT8ZfE_AvJPQ2XCUPUZE26tQ6UkhqBp__6Vz20fXLvS-IASBuoS_Jx5eJpIuTEmicIWyPzYKXWN-v9rpOT7ug

DHAN_REDIRECT_URI=https://your-app.vercel.app/auth/callback

DHAN_PARTNER_CLIENT_ID=1108893841

DHAN_PARTNER_CLIENT_SECRET=cf40c913-ea06-4b46-8ed5-c0589c8a540a
```

**⚠️ UPDATE** `DHAN_REDIRECT_URI` after deploying frontend

---

## Quick Copy-Paste for Render.com

1. Go to your Render service dashboard
2. Click "Environment" tab
3. Add these variables one by one:

```
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://your-app.vercel.app
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour-Key\n-----END PRIVATE KEY-----
DHAN_ACCESS_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzYxNjUzNTkxLCJpYXQiOjE3NjE1NjcxOTEsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTA4ODkzODQxIn0.8IMH_F0w2tLtMfyhygARc3a__t9cdlEnRHhds9hOh2sDrPCyi64pm9Yc8wBXwVnc722BFLFdyp_0VoIA33qxKQ
DHAN_CLIENT_ID=1108893841
DHAN_CLIENT_SECRET=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJwYXJ0bmVySWQiOiIiLCJkaGFuQ2xpZW50SWQiOiIyNTEwMjExNzQwIiwid2ViaG9va1VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2NhbGxiYWNrIiwiaXNzIjoiZGhhbiIsImV4cCI6MTc2MzY0MzY2MH0.tMT8ZfE_AvJPQ2XCUPUZE26tQ6UkhqBp__6Vz20fXLvS-IASBuoS_Jx5eJpIuTEmicIWyPzYKXWN-v9rpOT7ug
DHAN_REDIRECT_URI=https://your-app.vercel.app/auth/callback
DHAN_PARTNER_CLIENT_ID=1108893841
DHAN_PARTNER_CLIENT_SECRET=cf40c913-ea06-4b46-8ed5-c0589c8a540a
```

---

## After Deployment

1. Get your backend URL from Render (e.g., `https://algorooms-backend.onrender.com`)
2. Update `frontend/.env.production` with:
   ```
   REACT_APP_API_URL=https://algorooms-backend.onrender.com
   ```
3. Redeploy frontend on Vercel
4. Update `FRONTEND_URL` and `DHAN_REDIRECT_URI` in backend env vars
5. Restart backend service on Render
