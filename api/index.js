// Vercel Serverless Function - Main Entry Point
const express = require('express');
const cors = require('cors');

// Create Express app
const app = express();

// Enable CORS for all origins & headers
app.use(cors({
  origin: true,
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
const paperRoutes = require('./routes/paper');
const riskRoutes = require('./routes/risk');

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Mavrix AlgoRooms Trading API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      market: '/api/market/all',
      trading: '/api/trading/engine/status',
      paper: '/api/paper/portfolio',
      risk: '/api/risk/status',
      brokers: '/api/brokers/list'
    }
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Mavrix AlgoRooms Trading API',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.status(200).json({
    status: 'OK',
    server: 'Mavrix Trading Production API',
    timestamp: new Date().toISOString()
  });
});

// Mount routes (support both with and without /api prefix)
['/api/auth', '/auth'].forEach(p => app.use(p, authRoutes));
['/api/broker', '/broker', '/api/brokers', '/brokers'].forEach(p => app.use(p, brokerRoutes));
['/api/market', '/market'].forEach(p => app.use(p, marketRoutes));
['/api/strategies', '/strategies'].forEach(p => app.use(p, strategyRoutes));
['/api/portfolio', '/portfolio'].forEach(p => app.use(p, portfolioRoutes));
['/api/trading', '/trading'].forEach(p => app.use(p, tradingRoutes));
['/api/paper', '/paper'].forEach(p => app.use(p, paperRoutes));
['/api/risk', '/risk'].forEach(p => app.use(p, riskRoutes));

// Graceful socket.io stub for serverless environments (prevents 404 polling errors)
app.all(['/socket.io', '/socket.io/*'], (req, res) => {
  res.status(200).json({
    status: 'serverless_mode',
    message: 'WebSockets not supported in serverless mode, using REST feed'
  });
});

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
