/**
 * Final Verification Test
 * Complete test of broker status display and functionality
 */

const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

async function finalVerification() {
    console.log('🎯 Final Verification - Broker Status Display\n');

    try {
        // Test 1: Check current broker status
        console.log('📋 Test 1: Current Broker Status');
        const listResponse = await axios.get('http://localhost:5000/api/broker/list');

        if (listResponse.data.success) {
            console.log('✅ API Response Structure:');
            console.log(JSON.stringify(listResponse.data.brokers[0], null, 2));

            const broker = listResponse.data.brokers[0];
            if (broker) {
                console.log('\n📊 Status Analysis:');
                console.log(`   API Status: ${broker.status}`);
                console.log(`   Terminal Enabled: ${broker.terminalEnabled}`);
                console.log(`   Trading Engine: ${broker.tradingEngineEnabled}`);

                // Verify frontend will show correct status
                const expectedDisplay = {
                    terminalStatus: broker.terminalEnabled ? 'Active' : 'Not Active',
                    terminalColor: broker.terminalEnabled ? 'GREEN' : 'RED',
                    statusChip: broker.status,
                    statusColor: broker.status === 'Connected' ? 'GREEN' : 'RED',
                    chipLabel: broker.terminalEnabled ? 'ON' : 'OFF'
                };

                console.log('\n🎨 Expected Frontend Display:');
                console.log(`   Terminal Status: "${expectedDisplay.terminalStatus}" (${expectedDisplay.terminalColor})`);
                console.log(`   Status Chip: "${expectedDisplay.statusChip}" (${expectedDisplay.statusColor})`);
                console.log(`   Terminal Chip: "${expectedDisplay.chipLabel}" (${expectedDisplay.terminalColor})`);

                // Verify the fix worked
                if (broker.terminalEnabled && broker.status === 'Connected') {
                    console.log('\n✅ STATUS FIX SUCCESSFUL!');
                    console.log('   Broker should now show as "Active" in frontend');
                } else {
                    console.log('\n❌ Status issue detected');
                    console.log('   Check broker credentials or API connection');
                }
            }
        }

        // Test 2: Test reconnect functionality
        console.log('\n📋 Test 2: Reconnect Functionality');
        if (listResponse.data.brokers.length > 0) {
            const brokerId = listResponse.data.brokers[0].id;

            const reconnectResponse = await axios.post('http://localhost:5000/api/broker/reconnect', {
                brokerId: brokerId
            });

            if (reconnectResponse.data.success) {
                console.log('✅ Reconnect working');
                console.log(`   Status after reconnect: ${reconnectResponse.data.broker.status}`);
            } else {
                console.log('❌ Reconnect failed:', reconnectResponse.data.message);
            }
        }

        // Test 3: Verify persistence
        console.log('\n📋 Test 3: Persistence Check');
        const fs = require('fs');
        const path = require('path');
        const brokersFile = path.join(__dirname, 'backend', 'brokers-data.json');

        if (fs.existsSync(brokersFile)) {
            console.log('✅ Persistence file exists');
            const data = JSON.parse(fs.readFileSync(brokersFile, 'utf8'));
            console.log(`   Stored brokers: ${data.length}`);
        } else {
            console.log('❌ Persistence file not found');
        }

        console.log('\n🎉 Final Verification Complete!');
        console.log('\n📱 Frontend Testing Instructions:');
        console.log('1. Start frontend: cd frontend && npm start');
        console.log('2. Go to: http://localhost:3000/brokers');
        console.log('3. Expected to see:');
        console.log('   ✅ Terminal Status: "Active" (Green)');
        console.log('   ✅ Status Chip: "Connected" (Green)');
        console.log('   ✅ Terminal Chip: "ON" (Green)');
        console.log('   ✅ Auto-refresh every 30 seconds');
        console.log('   ✅ Reconnect button if needed');

    } catch (error) {
        console.error('❌ Verification Error:', error.response?.data || error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Server not running. Start with: npm start');
        }
    }
}

finalVerification().catch(console.error);