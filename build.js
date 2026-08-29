const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Building Mavrix Trading Platform for Vercel...');

let frontendPath = path.join(__dirname, 'frontend');

if (!fs.existsSync(frontendPath) || !fs.existsSync(path.join(frontendPath, 'package.json'))) {
  frontendPath = __dirname;
}

try {
  console.log('📂 Using frontend path: ' + frontendPath);
  
  console.log('📦 Installing frontend dependencies...');
  execSync('npm install --legacy-peer-deps', { 
    cwd: frontendPath, 
    stdio: 'inherit',
    env: { ...process.env, CI: 'false' }
  });
  
  console.log('🔨 Building frontend application...');
  execSync('npm run build', { 
    cwd: frontendPath, 
    stdio: 'inherit',
    env: { ...process.env, CI: 'false' }
  });
  
  const srcBuild = path.join(frontendPath, 'build');
  const destBuild = path.join(__dirname, 'build');

  if (srcBuild !== destBuild && fs.existsSync(srcBuild)) {
    console.log('📋 Copying build output from ' + srcBuild + ' to ' + destBuild + '...');
    fs.cpSync(srcBuild, destBuild, { recursive: true, force: true });
  }
  
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}