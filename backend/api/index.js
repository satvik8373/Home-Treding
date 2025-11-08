// Vercel Serverless Function - Main Entry Point
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Route handling
  const { url, method } = req;

  // Health check
  if (url === '/api/health' || url === '/health') {
    return res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString()
    });
  }

  // Root endpoint
  if (url === '/' || url === '/api') {
    return res.status(200).json({
      success: true,
      message: 'AlgoRooms Trading API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        brokers: '/api/brokers',
        market: '/api/market'
      }
    });
  }

  // 404 for unknown routes
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: url
  });
};
