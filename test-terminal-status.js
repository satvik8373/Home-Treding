const axios = require('axios');

async function testTerminalStatus() {
    try {
        console.log('🧪 Testing Terminal Status API...');
        
        // First, get the list of brokers to find a broker ID
        const listResponse = await axios.get('http://localhost:5000/api/broker/list');
        console.log('📋 Available brokers:', listResponse.data.brokers.length);
        
        if (listResponse.data.brokers.length > 0) {
            const broker = listResponse.data.brokers[0];
            console.log('🔍 Testing with broker:', broker.clientId);
            
            // Test terminal status check
            const statusResponse = await axios.post('http://localhost:5000/api/broker/terminal-status', {
                brokerId: broker.id
            });
            
            console.log('✅ Terminal Status Result:');
            console.log('- Account Info:', statusResponse.data.accountInfo);
            console.log('- Recent Activity:', {
                orders: statusResponse.data.recentActivity?.orders?.length || 0,
                positions: statusResponse.data.recentActivity?.positions?.length || 0
            });
            
        } else {
            console.log('⚠️ No brokers found. Please connect a broker first.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testTerminalStatus();