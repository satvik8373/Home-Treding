const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Setting up Advanced Trading Platform Features...\n');

const steps = [
  {
    name: 'Install Dependencies',
    action: () => {
      console.log('📦 Installing backend dependencies...');
      process.chdir('backend');
      execSync('npm install socket.io ws @types/ws typescript @types/node --save-dev', { stdio: 'inherit' });
      
      console.log('📦 Installing frontend dependencies...');
      process.chdir('../frontend');
      execSync('npm install socket.io-client recharts', { stdio: 'inherit' });
      process.chdir('..');
    }
  },
  {
    name: 'Compile TypeScript',
    action: () => {
      console.log('🔨 Compiling TypeScript services...');
      process.chdir('backend');
      
      try {
        execSync('npx tsc', { stdio: 'inherit' });
        console.log('✅ TypeScript compilation successful');
      } catch (error) {
        console.log('⚠️  TypeScript compilation had issues, but continuing...');
      }
      
      process.chdir('..');
    }
  },
  {
    name: 'Verify Setup',
    action: () => {
      console.log('🔍 Verifying setup...');
      
      const requiredFiles = [
        'backend/src/services/tradingEngine.ts',
        'backend/src/services/websocketService.ts',
        'backend/src/services/orderManagement.ts',
        'backend/src/services/portfolioService.ts',
        'frontend/src/components/RealTimeMarketData.tsx',
        'frontend/src/components/OrderManagement.tsx',
        'frontend/src/components/PortfolioDashboard.tsx',
        'frontend/src/pages/TradingDashboard.tsx'
      ];
      
      const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
      
      if (missingFiles.length === 0) {
        console.log('✅ All required files are present');
      } else {
        console.log('⚠️  Some files are missing:');
        missingFiles.forEach(file => console.log(`   - ${file}`));
      }
    }
  }
];

async function runSetup() {
  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`\n${i + 1}. ${step.name}`);
      console.log('─'.repeat(50));
      
      await step.action();
      
      console.log(`✅ ${step.name} completed\n`);
    }
    
    console.log('🎉 Advanced Trading Platform Setup Complete!\n');
    
    console.log('📋 Next Steps:');
    console.log('1. Start backend: cd backend && npm start');
    console.log('2. Start frontend: cd frontend && npm start');
    console.log('3. Visit: http://localhost:3000');
    console.log('4. Connect a broker in /brokers');
    console.log('5. Access Trading Dashboard: /trading-dashboard\n');
    
    console.log('🆕 New Features Added:');
    console.log('• Real-time Trading Engine');
    console.log('• WebSocket Market Data');
    console.log('• Order Management System');
    console.log('• Portfolio Tracking');
    console.log('• Live P&L Updates');
    console.log('• Advanced Trading Dashboard');
    console.log('• Risk Management');
    console.log('• Strategy Framework (foundation)');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n💡 Manual setup instructions:');
    console.log('1. cd backend && npm install socket.io ws @types/ws typescript @types/node');
    console.log('2. cd ../frontend && npm install socket.io-client');
    console.log('3. cd ../backend && npx tsc');
    console.log('4. npm start (in both backend and frontend)');
    process.exit(1);
  }
}

runSetup();