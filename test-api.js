// Simple API test script
// Run with: node test-api.js

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testEndpoint(name, method, url, data = null) {
  try {
    console.log(`\n🧪 Testing ${name}...`);
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (data) config.data = data;
    
    const response = await axios(config);
    console.log(`✅ ${name}: ${response.status}`);
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ${error.response?.status || 'ERROR'}`);
    console.log(error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...');
  console.log(`Base URL: ${BASE_URL}\n`);

  const tests = [
    ['Health Check', 'GET', '/health'],
    ['API Info', 'GET', '/'],
    ['Market Data', 'GET', '/market'],
    ['List Brokers', 'GET', '/brokers'],
    ['Connect Broker', 'POST', '/brokers', {
      broker: 'Dhan',
      clientId: '1234567890',
      accessToken: 'test_token'
    }],
    ['Login', 'POST', '/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    }],
    ['Portfolio Positions', 'GET', '/portfolio/positions'],
    ['List Strategies', 'GET', '/strategies']
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, method, url, data] of tests) {
    const result = await testEndpoint(name, method, url, data);
    if (result) passed++;
    else failed++;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
}

runTests().catch(console.error);
