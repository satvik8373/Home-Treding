# Final Setup Steps

## ✅ Completed
- Backend deployed on Render: https://home-treding-api.onrender.com
- Frontend code updated to use production backend URL
- All hardcoded localhost URLs replaced with environment variables

## 🔧 Required Actions

### 1. Update Backend Environment Variable on Render

Go to your Render dashboard:
1. Open your service: `home-treding-api`
2. Click "Environment" tab
3. Add this variable:
   ```
   FRONTEND_URL=https://your-vercel-app-url.vercel.app
   ```
4. Click "Save Changes" (this will trigger a redeploy)

**Note**: You'll get your Vercel URL after the next step.

### 2. Deploy Frontend on Vercel

Your frontend is ready to deploy! Vercel will automatically detect the push and deploy.

1. Go to https://vercel.com/dashboard
2. Your project should auto-deploy from the latest commit
3. Once deployed, copy the Vercel URL (e.g., `https://home-treding.vercel.app`)

### 3. Update Backend CORS (Final Step)

After getting your Vercel URL:
1. Go back to Render dashboard
2. Update `FRONTEND_URL` with your actual Vercel URL
3. Save and wait for redeploy

### 4. Update Dhan Redirect URI (Optional)

If using Dhan OAuth:
1. In Render, update:
   ```
   DHAN_REDIRECT_URI=https://your-vercel-app.vercel.app/auth/callback
   ```
2. Also update this in Dhan Developer Portal

## 🎉 Testing

Once both are deployed:
1. Visit your Vercel URL
2. Try connecting a broker
3. Check if market data loads
4. Verify WebSocket connection in browser console

## 🔍 Troubleshooting

### CORS Errors
- Make sure `FRONTEND_URL` in Render matches your Vercel URL exactly
- No trailing slash in the URL

### WebSocket Not Connecting
- Check browser console for errors
- Verify backend is using `wss://` (secure WebSocket)
- Render automatically provides SSL

### API Calls Failing
- Check Network tab in browser DevTools
- Verify backend URL in frontend: `https://home-treding-api.onrender.com`
- Check Render logs for backend errors

## 📊 Current Configuration

**Backend**: https://home-treding-api.onrender.com
**Frontend**: Will be deployed on Vercel
**WebSocket**: wss://home-treding-api.onrender.com

All environment variables are configured in:
- `frontend/.env.production`
- `backend/.env.production` (template only, actual values in Render dashboard)
