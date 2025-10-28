#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Vercel Deployment Script for AlgoRooms');

// Find the frontend directory
function findFrontendDir() {
  const possiblePaths = [
    './frontend',
    '../frontend',
    '.',
    '..'
  ];
  
  for (const p of possiblePaths) {
    const packagePath = path.join(p, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (pkg.name === 'frontend' || pkg.dependencies?.react) {
        return p;
      }
    }
  }
  
  return null;
}

try {
  const frontendDir = findFrontendDir();
  
  if (!frontendDir) {
    console.error('❌ Could not find frontend directory');
    process.exit(1);
  }
  
  console.log(`📂 Found frontend at: ${frontendDir}`);
  
  // Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm install', { 
    cwd: frontendDir, 
    stdio: 'inherit' 
  });
  
  // Build the project
  console.log('🔨 Building project...');
  execSync('npm run build', { 
    cwd: frontendDir, 
    stdio: 'inherit' 
  });
  
  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}