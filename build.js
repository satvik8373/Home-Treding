#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Building AlgoRooms Trading Platform...');

try {
  // Change to frontend directory and build
  console.log('📦 Installing frontend dependencies...');
  execSync('npm install', { 
    cwd: path.join(__dirname, 'frontend'), 
    stdio: 'inherit' 
  });
  
  console.log('🔨 Building frontend application...');
  execSync('npm run build', { 
    cwd: path.join(__dirname, 'frontend'), 
    stdio: 'inherit' 
  });
  
  console.log('✅ Build completed successfully!');
  console.log('📁 Output directory: frontend/build');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}