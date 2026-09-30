// Vercel Serverless Function - Main Entry Point
const express = require('express');
const cors = require('cors');
const axios = require('axios');

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
const portfolioRoutes = require('./routes/portfolio');
const paperRoutes = require('./routes/paper');
const riskRoutes = require('./routes/risk');
const backtestRoutes = require('./routes/backtest');
const strategyTestRoutes = require('./routes/strategyTest');

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
// Account, strategy, and trading requests use one backend and connection store.
if (process.env.MAVRIX_BACKTEST_ENGINE_URL) {
  app.use(['/api/auth', '/auth', '/api/broker', '/broker', '/api/brokers', '/brokers',
    '/api/strategies', '/strategies', '/api/trading', '/trading'], async (req, res) => {
    const base = process.env.MAVRIX_BACKTEST_ENGINE_URL.replace(/\/$/, '');
    const endpoint = req.originalUrl.startsWith('/api/') ? req.originalUrl : `/api${req.originalUrl}`;
    try {
      const response = await axios({
        url: `${base}${endpoint}`, method: req.method, data: req.body,
        headers: { authorization: req.headers.authorization, 'content-type': 'application/json' },
        timeout: 30000, validateStatus: () => true
      });
      res.status(response.status).json(response.data);
    } catch {
      res.status(502).json({ success: false, message: 'Trading service is unavailable.' });
    }
  });
}
['/api/auth', '/auth'].forEach(p => app.use(p, authRoutes));
['/api/broker', '/broker', '/api/brokers', '/brokers'].forEach(p => app.use(p, brokerRoutes));
['/api/market', '/market'].forEach(p => app.use(p, marketRoutes));
if (!process.env.MAVRIX_BACKTEST_ENGINE_URL) {
  app.use(['/api/strategies', '/strategies'], (_req, res) => res.status(503).json({ success: false, message: 'Strategy service is not configured.' }));
  app.use(['/api/trading', '/trading'], (_req, res) => res.status(503).json({ success: false, message: 'Trading service is not configured.' }));
}
['/api/portfolio', '/portfolio'].forEach(p => app.use(p, portfolioRoutes));
['/api/paper', '/paper'].forEach(p => app.use(p, paperRoutes));
['/api/risk', '/risk'].forEach(p => app.use(p, riskRoutes));
['/api/backtest', '/backtest'].forEach(p => app.use(p, backtestRoutes));
['/api/strategy-test', '/strategy-test'].forEach(p => app.use(p, strategyTestRoutes));

// Partner callbacks require a verified consent exchange before any connection exists.
app.all(['/api/dhan-partner/callback', '/dhan-partner/callback'], (req, res) => {
  res.status(410).json({ success: false, message: 'Use the Dhan access token connection flow.' });
});

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
