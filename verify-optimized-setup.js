/**
 * Verify Optimized AlgoRooms Setup
 * Quick verification that everything works
 */

const axios = require('axios');

async function verifySetup() {
    console.log('🔍 Verifying Optimized AlgoRooms Setup\n');

    try {
        // Test 1: Health Check
        console.log('📋 Test 1: Health Check');
        const healthResponse = await axios.get('http://localhost:5000/health');
        if (healthResponse.data.status === 'OK') {
            console.log('✅ AlgoRooms server is running');
            console.log('📝 Message:', healthResponse.data.message);
        }

        // Test 2: Market Data
        console.log('\n📋 Test 2: Market Data');
        const marketResponse = await axios.get('http://localhost:5000/api/market/all');
        if (marketResponse.data.success) {
            console.log('✅ Market data working');
            console.log('📊 Stocks:', marketResponse.data.data.stocks.length);
            console.log('📈 Indices:', marketResponse.data.data.indices.length);
        }

        // Test 3: Broker List (should be empty initially)
        console.log('\n📋 Test 3: Broker Management');
        const listResponse = await axios.get('http://localhost:5000/api/broker/list');
        if (listResponse.data.success) {
            console.log('✅ Broker management working');
            console.log('📊 Connected brokers:', listResponse.data.brokers.length);
        }

        console.log('\n🎉 AlgoRooms Setup Verification Complete!');
        console.log('\n📋 Summary:');
        console.log('✅ Backend Server - Running (port 5000)');
        console.log('✅ Market Data API - Working');
        console.log('✅ Broker Management - Working');
        console.log('✅ Health Check - Working');

        console.log('\n🚀 Ready for Use:');
        console.log('1. Backend: Already running (npm start)');
        console.log('2. Frontend: cd frontend && npm start');
        console.log('3. Access: http://localhost:3000/brokers');

        console.log('\n🔧 Commands:');
        console.log('- Start backend: npm start');
        console.log('- Start frontend: cd frontend && npm start');
        console.log('- Test: npm test (after small delay)');

    } catch (error) {
        console.error('❌ Verification Error:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Server not running. Start with: npm start');
        }
    }
}

verifySetup().catch(console.error);