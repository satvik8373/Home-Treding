const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Advanced Trading Platform Setup...\n');

const requiredFiles = {
    'Backend Services': [
        'backend/src/services/tradingEngine.ts',
        'backend/src/services/websocketService.ts',
        'backend/src/services/orderManagement.ts',
        'backend/src/services/portfolioService.ts',
        'backend/src/services/strategyManager.ts'
    ],
    'Frontend Components': [
        'frontend/src/components/RealTimeMarketData.tsx',
        'frontend/src/components/OrderManagement.tsx',
        'frontend/src/components/PortfolioDashboard.tsx'
    ],
    'Frontend Pages': [
        'frontend/src/pages/TradingDashboard.tsx',
        'frontend/src/pages/Dashboard.tsx',
        'frontend/src/pages/Brokers.tsx',
        'frontend/src/pages/Portfolio.tsx',
        'frontend/src/pages/Strategies.tsx'
    ],
    'Configuration': [
        'backend/algorroms-server.js',
        'frontend/src/App.tsx',
        'ADVANCED-FEATURES.md',
        'setup-advanced-features.js'
    ]
};

let allFilesExist = true;
let totalFiles = 0;
let existingFiles = 0;

for (const [category, files] of Object.entries(requiredFiles)) {
    console.log(`📁 ${category}:`);

    for (const file of files) {
        totalFiles++;
        const exists = fs.existsSync(file);

        if (exists) {
            existingFiles++;
            console.log(`  ✅ ${file}`);
        } else {
            allFilesExist = false;
            console.log(`  ❌ ${file} - MISSING`);
        }
    }
    console.log('');
}

// Check if TypeScript is compiled
const compiledFiles = [
    'backend/dist/services/tradingEngine.js',
    'backend/dist/services/websocketService.js',
    'backend/dist/services/orderManagement.js',
    'backend/dist/services/portfolioService.js'
];

console.log('🔨 TypeScript Compilation:');
let compiledCount = 0;
for (const file of compiledFiles) {
    const exists = fs.existsSync(file);
    if (exists) {
        compiledCount++;
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ⚠️  ${file} - Not compiled`);
    }
}

console.log('\n📊 Setup Summary:');
console.log(`Files: ${existingFiles}/${totalFiles} (${Math.round(existingFiles / totalFiles * 100)}%)`);
console.log(`TypeScript: ${compiledCount}/${compiledFiles.length} compiled`);

if (allFilesExist && compiledCount === compiledFiles.length) {
    console.log('\n🎉 Setup Complete! All advanced features are ready.');
    console.log('\n🚀 Next Steps:');
    console.log('1. cd backend && npm start');
    console.log('2. cd frontend && npm start');
    console.log('3. Visit: http://localhost:3000');
    console.log('4. Connect broker: /brokers');
    console.log('5. Start trading: /trading-dashboard');
} else if (allFilesExist && compiledCount < compiledFiles.length) {
    console.log('\n⚠️  Setup Almost Complete!');
    console.log('Run: cd backend && npx tsc');
    console.log('Then start the servers.');
} else {
    console.log('\n❌ Setup Incomplete!');
    console.log('Run: npm run setup-advanced');
}

console.log('\n🆕 New Features Available:');
console.log('• Real-time Trading Engine');
console.log('• WebSocket Market Data');
console.log('• Order Management System');
console.log('• Portfolio Tracking');
console.log('• Advanced Trading Dashboard');
console.log('• Strategy Management Framework');
console.log('• Risk Management');
console.log('• Live P&L Updates');