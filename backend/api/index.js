// Vercel Serverless Function - Main Entry Point
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'AlgoRooms Trading API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
module.exports = app;
