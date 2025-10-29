const fs = require('fs');
const path = require('path');

const API_BASE = "process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'";
const WS_URL = "process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:5000'";

const files = [
  'frontend/src/components/OrderManagement.tsx',
  'frontend/src/components/DhanTerminal.tsx',
  'frontend/src/components/BrokerCard.tsx',
  'frontend/src/components/BrokerageForm.tsx',
  'frontend/src/components/AddBrokerForm.tsx',
  'frontend/src/pages/Reports.tsx',
  'frontend/src/pages/TradingDashboard.tsx',
  'frontend/src/pages/Strategies.tsx',
  'frontend/src/pages/DhanCallback.tsx',
  'frontend/src/pages/Dashboard.tsx',
  'frontend/src/pages/Brokers.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace all hardcoded localhost:5000 URLs
    content = content.replace(/'http:\/\/localhost:5000'/g, `(${API_BASE})`);
    content = content.replace(/`http:\/\/localhost:5000/g, `\`\${${API_BASE}}`);
    
    fs.writeFileSync(file, content);
    console.log(`✅ Fixed: ${file}`);
  }
});

console.log('\n✅ All API URLs updated!');
