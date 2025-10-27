const axios = require('axios');

async function testBrokerAPI() {
    try {
        console.log('🧪 Testing Broker API...');
        
        // Test 1: List brokers (should be empty initially)
        console.log('\n1. Testing broker list...');
        const listResponse = await axios.get('http://localhost:5000/api/broker/list');
        console.log('✅ Broker list:', listResponse.data);
        
        // Test 2: Connect broker (with demo credentials)
        console.log('\n2. Testing broker connection...');
        const connectResponse = await axios.post('http://localhost:5000/api/broker/connect', {
            broker: 'DHAN',
            clientId: '1108893841',
            accessToken: 'demo_token_123'
        });
        console.log('📊 Connect result:', connectResponse.data);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testBrokerAPI();