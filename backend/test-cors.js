// Quick test script to verify CORS and routes work
const app = require('./api/index.js');
const http = require('http');

const PORT = 3001;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`\n🧪 Test server running on http://localhost:${PORT}`);
  console.log('\n📋 Test these endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log(`   GET  http://localhost:${PORT}/api/broker/list?userId=test`);
  console.log(`   GET  http://localhost:${PORT}/api/market/all`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log('\n✅ CORS is enabled for all origins');
  console.log('🛑 Press Ctrl+C to stop\n');
});
