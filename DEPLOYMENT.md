# Vercel Deployment Guide

## Architecture Changes

Your backend has been refactored from a traditional Express server to Vercel serverless functions:

### Before (Express Server)
- Single `backend/algorroms-server.js` running continuously
- In-memory state management
- WebSocket support
- Not compatible with Vercel

### After (Serverless Functions)
- Individual API endpoints in `/api` folder
- Each endpoint is a separate serverless function
- Stateless by design (use external DB for persistence)
- Fully compatible with Vercel

## API Endpoints

All endpoints are now serverless functions:

- `GET /api/health` - Health check
- `GET /api/market` - Market data (Yahoo Finance)
- `GET /api/brokers` - List brokers
- `POST /api/brokers` - Connect broker
- `DELETE /api/brokers?brokerId=xxx` - Delete broker
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/portfolio/positions` - Portfolio positions
- `GET /api/strategies` - List strategies
- `POST /api/strategies` - Create strategy

## Deployment Steps

### 1. Install Vercel CLI (Optional)
```bash
npm install -g vercel
```

### 2. Deploy to Vercel

#### Option A: Using Vercel Dashboard (Recommended)
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. Vercel will auto-detect the configuration
5. Click "Deploy"

#### Option B: Using Vercel CLI
```bash
vercel
```

### 3. Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

```
DHAN_CLIENT_ID=your_client_id
DHAN_ACCESS_TOKEN=your_access_token
FRONTEND_URL=https://your-app.vercel.app
```

### 4. Update Frontend API URL

Update your frontend to use the Vercel deployment URL:

```javascript
// frontend/src/config.js or similar
const API_URL = process.env.REACT_APP_API_URL || 'https://your-app.vercel.app/api';
```

## Important Notes

### State Management
⚠️ **Serverless functions are stateless!** 

The current implementation uses in-memory storage which will reset on each function invocation. For production, you need:

1. **Database** (Choose one):
   - MongoDB Atlas (Free tier available)
   - PostgreSQL (Vercel Postgres)
   - Redis (Upstash Redis)
   - Firebase Firestore

2. **Update broker storage** in `api/_lib/brokerStore.js` to use your database

### WebSocket Alternative
Vercel doesn't support WebSockets. For real-time updates:
- Use polling (simple but less efficient)
- Use Vercel's Edge Functions with Server-Sent Events
- Use external service like Pusher or Ably

### File Structure
```
project/
├── api/                    # Serverless functions
│   ├── _lib/              # Shared utilities
│   │   ├── brokerStore.js # Broker storage (needs DB)
│   │   └── cors.js        # CORS middleware
│   ├── auth/
│   │   ├── login.js       # POST /api/auth/login
│   │   └── register.js    # POST /api/auth/register
│   ├── portfolio/
│   │   └── positions.js   # GET /api/portfolio/positions
│   ├── brokers.js         # Broker management
│   ├── health.js          # Health check
│   ├── index.js           # API info
│   ├── market.js          # Market data
│   ├── strategies.js      # Strategy management
│   └── package.json       # API dependencies
├── frontend/              # React app
│   ├── build/            # Built files (generated)
│   ├── public/
│   ├── src/
│   └── package.json
├── vercel.json           # Vercel configuration
└── package.json          # Root package.json

```

## Testing Locally

```bash
# Install Vercel CLI
npm install -g vercel

# Run development server
vercel dev
```

This will start:
- Frontend: http://localhost:3000
- API: http://localhost:3000/api/*

## Troubleshooting

### Build Fails
- Check `vercel.json` configuration
- Ensure all dependencies are in `package.json`
- Check build logs in Vercel dashboard

### API Not Working
- Verify CORS headers are set
- Check function logs in Vercel dashboard
- Test endpoints individually

### State Not Persisting
- Implement database connection in `api/_lib/brokerStore.js`
- Add database credentials to environment variables

## Next Steps

1. ✅ Deploy to Vercel
2. 🔄 Add database for persistent storage
3. 🔄 Implement proper authentication with JWT
4. 🔄 Add rate limiting
5. 🔄 Set up monitoring and logging

## Support

For issues, check:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- Project logs in Vercel Dashboard
