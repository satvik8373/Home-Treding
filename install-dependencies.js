const { execSync } = require('child_process');

console.log('📦 Installing missing dependencies for advanced trading features...');

// Backend dependencies
const backendDeps = [
  'socket.io',
  'ws',
  '@types/ws'
];

// Frontend dependencies  
const frontendDeps = [
  'socket.io-client'
];

try {
  console.log('🔧 Installing backend dependencies...');
  process.chdir('backend');
  execSync(`npm install ${backendDeps.join(' ')}`, { stdio: 'inherit' });
  
  console.log('🔧 Installing frontend dependencies...');
  process.chdir('../frontend');
  execSync(`npm install ${frontendDeps.join(' ')}`, { stdio: 'inherit' });
  
  console.log('✅ All dependencies installed successfully!');
  
  console.log('\n📋 Next steps:');
  console.log('1. Compile TypeScript: cd backend && npx tsc');
  console.log('2. Start backend: cd backend && npm start');
  console.log('3. Start frontend: cd frontend && npm start');
  console.log('4. Visit: http://localhost:3000/trading-dashboard');
  
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}