const { execSync } = require('child_process');

console.log('🔧 Fixing console errors and missing dependencies...\n');

try {
  console.log('📦 Installing missing backend dependencies...');
  process.chdir('backend');
  execSync('npm install socket.io', { stdio: 'inherit' });
  
  console.log('📦 Installing missing frontend dependencies...');
  process.chdir('../frontend');
  execSync('npm install recharts', { stdio: 'inherit' });
  
  console.log('\n✅ Dependencies installed successfully!');
  console.log('\n🔧 Fixes Applied:');
  console.log('• Added missing trading API endpoints');
  console.log('• Fixed infinite re-render loops');
  console.log('• Added Socket.IO support to backend');
  console.log('• Fixed WebSocket connection errors');
  console.log('• Fixed Tooltip warnings for disabled buttons');
  console.log('• Added graceful fallback for demo mode');
  
  console.log('\n🚀 Next Steps:');
  console.log('1. Restart backend: cd backend && npm start');
  console.log('2. Restart frontend: cd frontend && npm start');
  console.log('3. Console errors should be resolved');
  
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  console.log('\n💡 Manual installation:');
  console.log('cd backend && npm install socket.io');
  console.log('cd ../frontend && npm install recharts');
}