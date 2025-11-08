# Allowed CORS Domains Configuration

## Current Configuration

### ✅ Allowed Origins

Your backend API (`https://home-treding-api-satvik8373s-projects.vercel.app`) will accept requests from:

1. **Production Frontend**: `https://home-treding.vercel.app` ✅
2. **Local Development**: `http://localhost:3000` ✅
3. **Local Development**: `http://localhost:3001` ✅

### 🚫 Blocked Origins

All other domains will be blocked with CORS error.

## Configuration Files

### 1. Backend API - `backend/api/index.js`

```javascript
const allowedOrigins = [
  'https://home-treding.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];
```

### 2. Vercel Config - `backend/vercel.json`

```json
"headers": {
  "Access-Control-Allow-Origin": "https://home-treding.vercel.app",
  "Access-Control-Allow-Credentials": "true"
}
```

## How to Add More Domains

### Step 1: Update `backend/api/index.js`

Add your new domain to the `allowedOrigins` array:

```javascript
const allowedOrigins = [
  'https://home-treding.vercel.app',           // Production
  'https://staging-home-treding.vercel.app',   // NEW: Staging
  'https://custom-domain.com',                 // NEW: Custom domain
  'http://localhost:3000',
  'http://localhost:3001'
];
```

### Step 2: Redeploy Backend

```bash
cd backend
vercel --prod
```

That's it! The Express CORS middleware will automatically allow the new domains.

## Testing CORS

### Test from Browser Console

Open your frontend (`https://home-treding.vercel.app`) and run:

```javascript
fetch('https://home-treding-api-satvik8373s-projects.vercel.app/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

Should return: `{ status: "OK", timestamp: "..." }`

### Test with curl

```bash
curl -H "Origin: https://home-treding.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://home-treding-api-satvik8373s-projects.vercel.app/api/market/all
```

Should return CORS headers in response.

## Security Notes

✅ **Good**: Only specific domains are allowed (not `*`)
✅ **Good**: Credentials are enabled for authenticated requests
✅ **Good**: Localhost is allowed for development
⚠️ **Note**: Make sure to use HTTPS in production (already configured)

## Troubleshooting

### CORS error still appears?

1. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
2. **Check domain spelling**: Must match exactly (including https://)
3. **Verify deployment**: Make sure backend is redeployed after changes
4. **Check Vercel logs**: `vercel logs` to see any errors

### Need to allow all domains temporarily?

For testing only, change in `backend/api/index.js`:

```javascript
app.use(cors({
  origin: '*',  // WARNING: Not secure for production!
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
```

**Remember to change it back to the whitelist for production!**
