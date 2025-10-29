# Backend Deployment Guide

## Deploy Backend to Render.com (FREE)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub

### Step 2: Deploy Backend
1. Click "New +" → "Web Service"
2. Connect your GitHub repository: `satvik8373/Home-Treding`
3. Configure:
   - **Name**: `algorooms-backend`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Runtime**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: Free

### Step 3: Add Environment Variables
In Render dashboard, add these environment variables:
```
NODE_ENV=production
PORT=10000
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
DHAN_CLIENT_ID=your_dhan_client_id
DHAN_ACCESS_TOKEN=your_dhan_token
```

### Step 4: Get Backend URL
After deployment, Render will give you a URL like:
`https://algorooms-backend.onrender.com`

### Step 5: Update Frontend
Update `frontend/.env.production`:
```
REACT_APP_API_URL=https://algorooms-backend.onrender.com
```

Then redeploy frontend on Vercel.

---

## Alternative: Railway.app

1. Go to https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Add environment variables
5. Railway auto-detects Node.js and deploys

---

## Alternative: Heroku

1. Install Heroku CLI: `npm install -g heroku`
2. Login: `heroku login`
3. Create app: `heroku create algorooms-backend`
4. Add buildpack: `heroku buildpacks:set heroku/nodejs`
5. Set root: `heroku config:set PROJECT_PATH=backend`
6. Deploy: `git push heroku main`

---

## Important Notes

- **Free tier limitations**: 
  - Render: Spins down after 15 min inactivity (cold starts)
  - Railway: 500 hours/month free
  - Heroku: No longer has free tier

- **WebSocket support**: All three platforms support WebSockets

- **Database**: You'll need to set up PostgreSQL separately (all platforms offer free PostgreSQL add-ons)
