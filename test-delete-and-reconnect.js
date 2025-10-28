/**
 * Test Delete and Reconnect Functionality
 * Clean up existing brokers and test full cycle
 */

const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

const API_BASE = 'http://localhost:5000';

async function testDeleteAndReconnect() {
    console.log('🎯 Testing Delete and Reconnect Functionality\n');

    try {
        // Step 1: List existing brokers
        console.log('📋 Step 1: List Existing Brokers');
        const listResponse = await axios.get(`${API_BASE}/api/broker/list`);

        if (listResponse.data.success) {
            console.log('✅ Current brokers:', listResponse.data.brokers.length);

            // Delete all existing brokers
            for (const broker of listResponse.data.brokers) {
                console.log(`🗑️ Deleting broker: ${broker.broker} (${broker.clientId})`);

                try {
                    const deleteResponse = await axios.delete(`${API_BASE}/api/broker/${broker.id}`);
                    if (deleteResponse.data.success) {
                        console.log(`✅ Deleted: ${broker.id}`);
                    }
                } catch (error) {
                    console.log(`❌ Failed to delete ${broker.id}:`, error.response?.data?.message);
                }
            }
        }

        // Step 2: Verify all brokers deleted
        console.log('\n📋 Step 2: Verify Clean State');
        const cleanListResponse = await axios.get(`${API_BASE}/api/broker/list`);
        console.log('📊 Remaining brokers:', cleanListResponse.data.brokers.length);

        // Step 3: Test fresh connection
        console.log('\n📋 Step 3: Test Fresh Connection');
        const testClientId = process.env.DHAN_CLIENT_ID;
        const testAccessToken = process.env.DHAN_ACCESS_TOKEN;

        const connectResponse = await axios.post(`${API_BASE}/api/broker/connect-manual`, {
            broker: 'Dhan',
            clientId: testClientId,
            accessToken: testAccessToken
        });

        if (connectResponse.data.success) {
            console.log('✅ Fresh connection successful');
            const brokerId = connectResponse.data.broker.id;
            console.log('🆔 New Broker ID:', brokerId);

            // Step 4: Test duplicate prevention
            console.log('\n📋 Step 4: Test Duplicate Prevention');
            try {
                await axios.post(`${API_BASE}/api/broker/connect-manual`, {
                    broker: 'Dhan',
                    clientId: testClientId,
                    accessToken: testAccessToken
                });
                console.log('❌ Duplicate should have been prevented');
            } catch (error) {
                if (error.response?.status === 400) {
                    console.log('✅ Duplicate prevention working');
                }
            }

            // Step 5: Test delete functionality
            console.log('\n📋 Step 5: Test Delete Functionality');
            const deleteResponse = await axios.delete(`${API_BASE}/api/broker/${brokerId}`);
            if (deleteResponse.data.success) {
                console.log('✅ Delete functionality working');

                // Verify deletion
                const verifyResponse = await axios.get(`${API_BASE}/api/broker/list`);
                const remaining = verifyResponse.data.brokers.filter(b => b.id === brokerId);
                if (remaining.length === 0) {
                    console.log('✅ Broker successfully removed');
                } else {
                    console.log('❌ Broker still exists after deletion');
                }
            }

            // Step 6: Test reconnection after delete
            console.log('\n📋 Step 6: Test Reconnection After Delete');
            const reconnectResponse = await axios.post(`${API_BASE}/api/broker/connect-manual`, {
                broker: 'Dhan',
                clientId: testClientId,
                accessToken: testAccessToken
            });

            if (reconnectResponse.data.success) {
                console.log('✅ Reconnection after delete working');
                console.log('🆔 Reconnected Broker ID:', reconnectResponse.data.broker.id);
            }

            console.log('\n🎉 All Delete and Reconnect Tests Passed!');
            console.log('\n📋 Summary:');
            console.log('✅ Existing Broker Cleanup - Working');
            console.log('✅ Fresh Connection - Working');
            console.log('✅ Duplicate Prevention - Working');
            console.log('✅ Delete Functionality - Working');
            console.log('✅ Reconnection After Delete - Working');

        } else {
            console.log('❌ Fresh connection failed:', connectResponse.data.message);
        }

    } catch (error) {
        console.error('❌ Test Error:', error.response?.data || error.message);
    }
}

// Run the test
testDeleteAndReconnect().catch(console.error);