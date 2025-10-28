/**
 * Cleanup Unused Files - AlgoRooms Optimization
 * Removes test files and unused components
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning up unused files for AlgoRooms production...\n');

// Files to delete (unused test and development files)
const filesToDelete = [
    'start-all.js',
    'test-algorooms-integration.js',
    'test-broker-api.js',
    'test-complete-oauth.js',
    'test-dhan-partner-flow.js',
    'test-oauth-flow.js',
    'test-real-connection.js',
    'test-strategy-integration.js',
    'test-terminal-activation.js',
    'test-terminal-status.js',
    'test-token-direct.js',
    'demo-oauth-integration.js',
    'DHAN_OAUTH_SETUP.md',
    'IMPLEMENTATION_SUMMARY.md',
    'RENEW_DHAN_TOKEN.md',
    'UPDATE_DHAN_CREDENTIALS.md',
    'backend/dhan-partner-integration.js',
    'backend/dhan-partner-routes.js',
    'frontend/src/components/DhanPartnerConnect.tsx'
];

// Keep these essential files
const keepFiles = [
    'test-manual-broker-connection.js',
    'test-complete-functionality.js',
    'test-delete-and-reconnect.js'
];

let deletedCount = 0;
let keptCount = 0;

filesToDelete.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ Deleted: ${file}`);
            deletedCount++;
        } else {
            console.log(`⚠️  Not found: ${file}`);
        }
    } catch (error) {
        console.log(`❌ Failed to delete ${file}: ${error.message}`);
    }
});

console.log(`\n📊 Cleanup Summary:`);
console.log(`   🗑️  Files deleted: ${deletedCount}`);
console.log(`   📁 Essential files kept: ${keepFiles.length}`);

console.log(`\n✅ AlgoRooms server optimized for production!`);
console.log(`\n🚀 Usage:`);
console.log(`   Backend: cd backend && npm start`);
console.log(`   Frontend: cd frontend && npm start`);
console.log(`   Test: npm test`);

// Update README with optimized instructions
const readmeContent = `# AlgoRooms Trading Platform - Optimized

## 🚀 Quick Start

### Backend (AlgoRooms Server)
\`\`\`bash
cd backend
npm install
npm start
\`\`\`
Server runs on: http://localhost:5000

### Frontend (React App)
\`\`\`bash
cd frontend
npm install
npm start
\`\`\`
App runs on: http://localhost:3000

## 🔧 Features

- ✅ Manual Broker Connection (Client ID + Access Token)
- ✅ Real Dhan API Integration
- ✅ Terminal Activation & Controls
- ✅ Trading Engine Management
- ✅ Broker Delete & Duplicate Prevention
- ✅ Real-time Market Data

## 📱 Usage

1. Start backend: \`cd backend && npm start\`
2. Start frontend: \`cd frontend && npm start\`
3. Go to: http://localhost:3000/brokers
4. Click "Add Broker" and enter your Dhan credentials
5. Start trading!

## 🧪 Testing

\`\`\`bash
npm test  # Test broker functionality
\`\`\`

## 🏗️ Production Ready

- Optimized backend server
- Clean codebase
- Professional UI
- Real API integration
`;

try {
    fs.writeFileSync('README.md', readmeContent);
    console.log(`\n📝 Updated README.md with optimized instructions`);
} catch (error) {
    console.log(`❌ Failed to update README: ${error.message}`);
}

console.log(`\n🎉 AlgoRooms optimization complete!`);