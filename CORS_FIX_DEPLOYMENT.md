# CORS Fix Deployment Guide

## Problem
CORS errors when frontend tries to access backend API:
```
Access to XMLHttpRequest at 'https://home-treding-api-satvik8373s-projects.vercel.app/api/broker/list' 
from origin 'https://home-treding.vercel.app' has been blocked by CORS policy
```

## Solution Applied

### 1. Backend Changes (backend/)

#### Updated `backend/api/index.js`
- Converted to Express app for better routing
- Added proper CORS middleware with specific origin whitelist
- **Allowed origin: `https://home-treding.vercel.app`**
- Also allows localhost for development
- Created modular route handlers
- All routes now properly handled

#### Created Route Files
- `backend/api/routes/auth.js` - Authentication endpoints
- `backend/api/routes/brokers.js` - Broker management
- `backend/api/routes/market.js` - Market data
- `backend/api/routes/strategies.js` - Strategy management
- `backend/api/routes/portfolio.js` - Portfolio data

#### Updated `backend/vercel.json`
- Added explicit CORS headers in routes
- Configured proper HTTP methods

### 2. Frontend Changes (frontend/)

#### Updated `frontend/.env.production`
- Changed API URL from Render to Vercel:
  ```
  REACT_APP_API_BASE_URL=https://home-treding-api-satvik8373s-projects.vercel.app
  ```

## Deployment Steps

### Step 1: Deploy Backend to Vercel

```bash
cd backend
vercel --prod
```

Or push to your GitHub repo and Vercel will auto-deploy.

### Step 2: Verify Backend is Working

Test the health endpoint:
```bash
curl https://home-treding-api-satvik8373s-projects.vercel.app/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-11-08T..."
}
```

Test the broker list endpoint:
```bash
curl https://home-treding-api-satvik8373s-projects.vercel.app/api/broker/list?userId=test
```

Expected response:
```json
{
  "success": true,
  "brokers": []
}
```

### Step 3: Deploy Frontend to Vercel

```bash
cd frontend
npm run build
vercel --prod
```

### Step 4: Test CORS

Open your frontend URL in browser:
```
https://home-treding.vercel.app
```

Check browser console - CORS errors should be gone!

## API Endpoints Available

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- POST `/api/auth/logout` - Logout user

### Brokers
- GET `/api/broker/list?userId=xxx` - Get broker list
- POST `/api/broker/add` - Add new broker
- DELETE `/api/broker/:brokerId` - Delete broker
- POST `/api/broker/terminal` - Toggle terminal
- POST `/api/broker/tradingEngine` - Toggle trading engine

### Market Data
- GET `/api/market/all` - Get all market data
- GET `/api/market/quote/:symbol` - Get specific symbol quote
- GET `/api/market/search?query=xxx` - Search symbols

### Strategies
- GET `/api/strategies?userId=xxx` - Get all strategies
- POST `/api/strategies` - Create strategy
- GET `/api/strategies/:id` - Get strategy by ID
- PUT `/api/strategies/:id` - Update strategy
- DELETE `/api/strategies/:id` - Delete strategy

### Portfolio
- GET `/api/portfolio/summary?userId=xxx` - Get portfolio summary
- GET `/api/portfolio/positions?userId=xxx` - Get positions
- GET `/api/portfolio/holdings?userId=xxx` - Get holdings

## Troubleshooting

### If CORS errors persist:

1. **Clear browser cache** - Hard refresh (Ctrl+Shift+R)

2. **Check Vercel deployment logs**:
   ```bash
   vercel logs
   ```

3. **Verify environment variables** in Vercel dashboard:
   - Go to your project settings
   - Check Environment Variables
   - Ensure `REACT_APP_API_BASE_URL` is set correctly

4. **Test with curl** to isolate frontend vs backend issues:
   ```bash
   curl -H "Origin: https://home-treding.vercel.app" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://home-treding-api-satvik8373s-projects.vercel.app/api/market/all
   ```

5. **Check Vercel function logs** in dashboard for any errors

## Notes

- The backend now uses Express for better routing and middleware support
- All routes have CORS enabled with `Access-Control-Allow-Origin: *`
- In production, you may want to restrict CORS to specific origins
- The route handlers are modular and easy to extend
- Mock data is used for now - replace with real database in production

## Next Steps

1. Deploy both frontend and backend
2. Test all endpoints
3. Replace mock data with real database (MongoDB, PostgreSQL, etc.)
4. Add proper authentication middleware
5. Restrict CORS to specific origins for security
