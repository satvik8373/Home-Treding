/**
 * Test Dashboard Broker Status Integration
 * Verify Dashboard shows correct broker connection status
 */

const axios = require('axios');

async function testDashboardBrokerStatus() {
    console.log('🎯 Testing Dashboard Broker Status Integration\n');

    try {
        // Test 1: Check AlgoRooms API that Dashboard will call
        console.log('📋 Test 1: AlgoRooms Broker API (Dashboard Data Source)');
        const brokersResponse = await axios.get('http://localhost:5000/api/broker/list');

        if (brokersResponse.data.success) {
            console.log('✅ AlgoRooms API working');
            console.log('📊 Brokers found:', brokersResponse.data.brokers.length);

            const connectedBrokers = brokersResponse.data.brokers.filter(b => b.status === 'Connected');
            console.log('🔗 Connected brokers:', connectedBrokers.length);

            brokersResponse.data.brokers.forEach((broker, index) => {
                console.log(`   ${index + 1}. ${broker.broker} (${broker.clientId})`);
                console.log(`      Status: ${broker.status}`);
                console.log(`      Terminal: ${broker.terminalEnabled ? 'Active' : 'Inactive'}`);
            });

            // Test 2: Simulate Dashboard Logic
            console.log('\n📋 Test 2: Dashboard Logic Simulation');
            const hasAlgoRoomsBroker = brokersResponse.data.brokers.length > 0;
            const hasBrokerConnected = hasAlgoRoomsBroker && connectedBrokers.length > 0;

            console.log('🧮 Dashboard Calculations:');
            console.log(`   hasAlgoRoomsBroker: ${hasAlgoRoomsBroker}`);
            console.log(`   connectedBrokers: ${connectedBrokers.length}`);
            console.log(`   hasBrokerConnected: ${hasBrokerConnected}`);

            // Test 3: Expected Dashboard Display
            console.log('\n📋 Test 3: Expected Dashboard Display');

            if (hasBrokerConnected) {
                console.log('✅ DASHBOARD SHOULD SHOW:');
                console.log(`   Welcome Message: "${connectedBrokers.length} broker${connectedBrokers.length > 1 ? 's' : ''} connected and ready to trade"`);
                console.log('   Success Alert: "✅ X broker(s) connected! Dhan (ClientID) - Ready for trading."');
                console.log('   Broker Status Card: "X Connected" (GREEN)');
                console.log('   Status Chip: "Active" (GREEN)');
                console.log('   No Warning Alert');
                console.log('   Button: "Manage Brokers"');
            } else {
                console.log('❌ DASHBOARD SHOULD SHOW:');
                console.log('   Welcome Message: "Connect your broker to start trading"');
                console.log('   Warning Alert: "No broker connected! Please link your Dhan account to start trading."');
                console.log('   Broker Status Card: "Not Connected" (GRAY)');
                console.log('   Status Chip: "Inactive" (GRAY)');
                console.log('   Button: "Add Broker"');
            }

            console.log('\n🎉 Dashboard Integration Test Complete!');
            console.log('\n📱 Frontend Testing:');
            console.log('1. Start frontend: cd frontend && npm start');
            console.log('2. Go to: http://localhost:3000/dashboard');
            console.log('3. Should show connected broker status');
            console.log('4. Auto-refreshes every 30 seconds');

        } else {
            console.log('❌ AlgoRooms API failed:', brokersResponse.data.message);
        }

    } catch (error) {
        console.error('❌ Test Error:', error.response?.data || error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 AlgoRooms server not running');
            console.log('   Start with: npm start');
            console.log('   Dashboard will show "No broker connected" if API is down');
        }
    }
}

// Test API endpoint directly
async function testAPIEndpoint() {
    console.log('\n🔍 Testing API Endpoint Directly\n');

    try {
        const response = await axios.get('http://localhost:5000/api/broker/list', {
            timeout: 5000
        });

        console.log('✅ API Response Status:', response.status);
        console.log('📊 Response Data:');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('❌ API Error:', error.message);
        console.log('💡 This is what Dashboard will see if API fails');
    }
}

// Run tests
async function runTests() {
    console.log('🚀 Starting Dashboard Broker Status Tests\n');

    await testAPIEndpoint();
    await testDashboardBrokerStatus();
}

runTests().catch(console.error);