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
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    server: 'Mavrix Trading Production API',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/brokers', brokerRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/paper', paperRoutes);
app.use('/api/risk', riskRoutes);

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
