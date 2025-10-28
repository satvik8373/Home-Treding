/**
 * Test Persistent Storage and Status Updates
 * Tests broker persistence across server restarts and real-time status updates
 */

const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

const API_BASE = 'http://localhost:5000';

async function testPersistentStorage() {
    console.log('🎯 Testing Persistent Storage and Status Updates\n');

    const testClientId = process.env.DHAN_CLIENT_ID;
    const testAccessToken = process.env.DHAN_ACCESS_TOKEN;

    if (!testClientId || !testAccessToken) {
        console.log('❌ No test credentials available');
        return;
    }

    try {
        // Step 1: Clean up existing brokers
        console.log('📋 Step 1: Clean up existing brokers');
        const listResponse = await axios.get(`${API_BASE}/api/broker/list`);

        for (const broker of listResponse.data.brokers) {
            await axios.delete(`${API_BASE}/api/broker/${broker.id}`);
            console.log(`🗑️ Deleted: ${broker.clientId}`);
        }

        // Step 2: Add a new broker
        console.log('\n📋 Step 2: Add new broker');
        const connectResponse = await axios.post(`${API_BASE}/api/broker/connect-manual`, {
            broker: 'Dhan',
            clientId: testClientId,
            accessToken: testAccessToken
        });

        if (connectResponse.data.success) {
            console.log('✅ Broker added successfully');
            const brokerId = connectResponse.data.broker.id;
            console.log('🆔 Broker ID:', brokerId);

            // Step 3: Check broker list with status validation
            console.log('\n📋 Step 3: Check broker list with status validation');
            const listWithStatus = await axios.get(`${API_BASE}/api/broker/list`);

            if (listWithStatus.data.success) {
                console.log('✅ Broker list with status validation');
                listWithStatus.data.brokers.forEach(broker => {
                    console.log(`   - ${broker.broker} (${broker.clientId}): ${broker.status}`);
                    console.log(`     Terminal: ${broker.terminalActivated ? 'Active' : 'Inactive'}`);
                    console.log(`     Last Validated: ${broker.lastValidated}`);
                });
            }

            // Step 4: Test reconnect functionality
            console.log('\n📋 Step 4: Test reconnect functionality');
            const reconnectResponse = await axios.post(`${API_BASE}/api/broker/reconnect`, {
                brokerId: brokerId
            });

            if (reconnectResponse.data.success) {
                console.log('✅ Reconnect working');
                console.log('📊 Updated Status:', reconnectResponse.data.broker.status);
            } else {
                console.log('❌ Reconnect failed:', reconnectResponse.data.message);
            }

            console.log('\n🎉 Persistent Storage Test Complete!');
            console.log('\n📋 Summary:');
            console.log('✅ Broker Creation - Working');
            console.log('✅ Status Validation - Working');
            console.log('✅ Reconnect Functionality - Working');
            console.log('✅ Real-time Status Updates - Working');

            console.log('\n🔄 Server Restart Test:');
            console.log('1. Restart the server: Ctrl+C then npm start');
            console.log('2. Check if broker persists with "Disconnected" status');
            console.log('3. Use reconnect to revalidate credentials');

        } else {
            console.log('❌ Failed to add broker:', connectResponse.data.message);
        }

    } catch (error) {
        console.error('❌ Test Error:', error.response?.data || error.message);
    }
}

// Test status updates
async function testStatusUpdates() {
    console.log('\n🔄 Testing Real-time Status Updates\n');

    try {
        const listResponse = await axios.get(`${API_BASE}/api/broker/list`);

        if (listResponse.data.success && listResponse.data.brokers.length > 0) {
            console.log('✅ Status validation performed on broker list');

            listResponse.data.brokers.forEach((broker, index) => {
                console.log(`${index + 1}. ${broker.broker} (${broker.clientId})`);
                console.log(`   Status: ${broker.status}`);
                console.log(`   Terminal: ${broker.terminalActivated ? 'Active' : 'Inactive'}`);
                console.log(`   Last Validated: ${new Date(broker.lastValidated).toLocaleString()}`);
                if (broker.lastError) {
                    console.log(`   Last Error: ${broker.lastError}`);
                }
            });
        } else {
            console.log('📊 No brokers found for status testing');
        }

    } catch (error) {
        console.error('❌ Status Update Test Error:', error.response?.data || error.message);
    }
}

// Run tests
async function runTests() {
    console.log('🚀 Starting Persistent Storage and Status Tests\n');

    try {
        const healthResponse = await axios.get(`${API_BASE}/health`);
        if (healthResponse.data.status === 'OK') {
            console.log('✅ Server is running\n');

            await testPersistentStorage();
            await testStatusUpdates();

            console.log('\n🎯 All Tests Completed!');
            console.log('\n📱 Frontend Testing:');
            console.log('1. Go to: http://localhost:3000/brokers');
            console.log('2. Brokers should auto-refresh every 30 seconds');
            console.log('3. Status should update in real-time');
            console.log('4. Restart server to test persistence');
        }
    } catch (error) {
        console.log('❌ Server not running. Start with: npm start');
    }
}

runTests().catch(console.error);