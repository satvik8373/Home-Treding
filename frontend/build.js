#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Building AlgoRooms Frontend...');

try {
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  console.log('🔨 Building React application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('✅ Frontend build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}