#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Building AlgoRooms Trading Platform...');

// Determine the correct frontend path
let frontendPath = path.join(__dirname, 'frontend');

// Check if we're in a different context (like Vercel)
if (!fs.existsSync(frontendPath)) {
  // Try current directory
  if (fs.existsSync('./package.json')) {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    if (pkg.name === 'frontend') {
      frontendPath = './';
      console.log('📍 Detected frontend directory context');
    }
  }
  
  // Try parent directory
  if (!fs.existsSync(path.join(frontendPath, 'package.json'))) {
    frontendPath = path.join(__dirname, '..', 'frontend');
  }
}

try {
  console.log(`📂 Using frontend path: ${frontendPath}`);
  
  // Check if package.json exists
  const packagePath = path.join(frontendPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Frontend package.json not found at ${packagePath}`);
  }
  
  console.log('📦 Installing frontend dependencies...');
  execSync('npm install', { 
    cwd: frontendPath, 
    stdio: 'inherit' 
  });
  
  console.log('🔨 Building frontend application...');
  execSync('npm run build', { 
    cwd: frontendPath, 
    stdio: 'inherit' 
  });
  
  console.log('✅ Build completed successfully!');
  console.log(`📁 Output directory: ${path.join(frontendPath, 'build')}`);
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  console.error('🔍 Debug info:');
  console.error(`   Current directory: ${process.cwd()}`);
  console.error(`   Script directory: ${__dirname}`);
  console.error(`   Frontend path: ${frontendPath}`);
  console.error(`   Frontend exists: ${fs.existsSync(frontendPath)}`);
  process.exit(1);
}