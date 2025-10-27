const axios = require('axios');

async function testTerminalActivation() {
    try {
        console.log('🧪 Testing Terminal Activation API (Like AlgoRooms)...');
        
        // Step 1: Connect a broker first
        console.log('\n1. Connecting broker...');
        const connectResponse = await axios.post('http://localhost:5000/api/broker/connect', {
            broker: 'DHAN',
            clientId: '1108893841',
            accessToken: 'demo_token_for_testing'
        });
        
        if (connectResponse.data.success) {
            const brokerId = connectResponse.data.broker.id;
            console.log('✅ Broker connected:', brokerId);
            
            // Step 2: Activate terminal
            console.log('\n2. Activating trading terminal...');
            const activateResponse = await axios.post('http://localhost:5000/api/broker/activate-terminal', {
                brokerId: brokerId
            });
            
            console.log('🚀 Terminal Activation Result:');
            console.log('- Success:', activateResponse.data.success);
            console.log('- Message:', activateResponse.data.message);
            console.log('- Account Info:', activateResponse.data.accountInfo);
            console.log('- Can Place Orders:', activateResponse.data.accountInfo?.canPlaceOrders);
            
            // Step 3: Check terminal status
            console.log('\n3. Checking terminal status...');
            const statusResponse = await axios.post('http://localhost:5000/api/broker/terminal-status', {
                brokerId: brokerId
            });
            
            console.log('📊 Terminal Status:');
            console.log('- Terminal Activated:', statusResponse.data.accountInfo?.terminalActivated);
            console.log('- Status:', statusResponse.data.accountInfo?.status);
            console.log('- Orders:', statusResponse.data.accountInfo?.totalOrders);
            console.log('- Positions:', statusResponse.data.accountInfo?.activePositions);
            
        } else {
            console.log('❌ Broker connection failed:', connectResponse.data.message);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testTerminalActivation();