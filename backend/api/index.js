// Vercel Serverless Function - Main Entry Point
const express = require('express');
const cors = require('cors');

// Create Express app
const app = express();

// Enable CORS for all Vercel deployments and local development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all Vercel preview deployments and production
    if (origin.includes('vercel.app') || 
        origin.includes('localhost') ||
        origin.includes('home-treding')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma', 'Expires']
}));

// Parse JSON bodies
app.use(express.json());

// Import route handlers
const authRoutes = require('./routes/auth');
const brokerRoutes = require('./routes/brokers');
const marketRoutes = require('./routes/market');
const strategyRoutes = require('./routes/strategies');
const portfolioRoutes = require('./routes/portfolio');
const tradingRoutes = require('./routes/trading');

// Root endpoint (handles both / and /api)
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AlgoRooms Trading API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      brokers: '/api/broker/*',
      market: '/api/market/*',
      strategies: '/api/strategies/*',
      portfolio: '/api/portfolio/*'
    }
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AlgoRooms Trading API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      brokers: '/api/broker/*',
      market: '/api/market/*',
      strategies: '/api/strategies/*',
      portfolio: '/api/portfolio/*'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/trading', tradingRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.url
  });
});

// Export the Express app as a serverless function
module.exports = app;
