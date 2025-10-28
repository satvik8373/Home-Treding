const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Compiling TypeScript services...');

try {
  // Check if TypeScript is installed
  process.chdir('backend');
  
  if (!fs.existsSync('node_modules/typescript')) {
    console.log('📦 Installing TypeScript...');
    execSync('npm install typescript @types/node --save-dev', { stdio: 'inherit' });
  }
  
  // Compile TypeScript
  console.log('🔨 Compiling TypeScript files...');
  execSync('npx tsc', { stdio: 'inherit' });
  
  console.log('✅ TypeScript compilation completed!');
  
  // Check if compiled files exist
  const compiledFiles = [
    'dist/services/tradingEngine.js',
    'dist/services/websocketService.js',
    'dist/services/orderManagement.js',
    'dist/services/portfolioService.js'
  ];
  
  const missingFiles = compiledFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    console.log('⚠️  Some files may not have compiled correctly:');
    missingFiles.forEach(file => console.log(`   - ${file}`));
  } else {
    console.log('✅ All TypeScript services compiled successfully!');
  }
  
} catch (error) {
  console.error('❌ TypeScript compilation failed:', error.message);
  console.log('\n💡 Try running manually:');
  console.log('   cd backend');
  console.log('   npm install typescript @types/node --save-dev');
  console.log('   npx tsc');
}