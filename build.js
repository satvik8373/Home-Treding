#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Building Home Trading Platform...');
console.log('Current directory:', process.cwd());
console.log('Directory contents:', fs.readdirSync('.'));

try {
  const frontendPath = path.join(__dirname, 'frontend');
  console.log('Frontend path:', frontendPath);
  
  // Check if frontend directory exists
  if (!fs.existsSync(frontendPath)) {
    console.error('❌ Frontend directory not found!');
    console.log('Available directories:', fs.readdirSync('.').filter(item => 
      fs.statSync(item).isDirectory()
    ));
    process.exit(1);
  }
  
  // Change to frontend directory and build
  process.chdir(frontendPath);
  console.log('📦 Installing frontend dependencies...');
  execSync('npm ci', { stdio: 'inherit' });
  
  console.log('🔨 Building frontend...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}