const fs = require('fs');

const files = {
  'frontend/src/pages/Dashboard.tsx': [
    { old: "axios.get('http://localhost:5000/api/broker/list')", new: "axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/list`)" }
  ],
  'frontend/src/pages/Brokers.tsx': [
    { old: "axios.get('http://localhost:5000/api/broker/list')", new: "axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/list`)" }
  ],
  'frontend/src/pages/TradingDashboard.tsx': [
    { old: "axios.get('http://localhost:5000/api/trading/engine/status')", new: "axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/engine/status`)" },
    { old: "axios.get('http://localhost:5000/api/broker/list')", new: "axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/list`)" }
  ],
  'frontend/src/pages/Strategies.tsx': [
    { old: "axios.get('http://localhost:5000/api/strategies')", new: "axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/strategies`)" },
    { old: "axios.get('http://localhost:5000/api/broker/list')", new: "axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/list`)" },
    { old: "axios.post('http://localhost:5000/api/strategies', createForm)", new: "axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/strategies`, createForm)" }
  ],
  'frontend/src/pages/Reports.tsx': [
    { old: "axios.get('http://localhost:5000/api/portfolio/trades?limit=100')", new: "axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/portfolio/trades?limit=100`)" },
    { old: "axios.get('http://localhost:5000/api/portfolio/performance')", new: "axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/portfolio/performance`)" }
  ],
  'frontend/src/pages/DhanCallback.tsx': [
    { old: "axios.post('http://localhost:5000/api/dhan-partner/callback', {", new: "axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/dhan-partner/callback`, {" }
  ],
  'frontend/src/components/AddBrokerForm.tsx': [
    { old: "axios.post('http://localhost:5000/api/broker/connect-manual', {", new: "axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/connect-manual`, {" }
  ],
  'frontend/src/components/BrokerageForm.tsx': [
    { old: "axios.post('http://localhost:5000/api/broker/connect', {", new: "axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/connect`, {" }
  ],
  'frontend/src/components/BrokerCard.tsx': [
    { old: "axios.post('http://localhost:5000/api/broker/dhan-login-url', {", new: "axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/dhan-login-url`, {" },
    { old: "axios.post('http://localhost:5000/api/broker/terminal-status', {", new: "axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/terminal-status`, {" }
  ],
  'frontend/src/components/OrderManagement.tsx': [
    { old: "axios.get('http://localhost:5000/api/trading/orders', {", new: "axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/orders`, {" },
    { old: "axios.post('http://localhost:5000/api/trading/orders', orderForm)", new: "axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/trading/orders`, orderForm)" }
  ]
};

Object.entries(files).forEach(([file, replacements]) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    replacements.forEach(({ old, new: newStr }) => {
      if (content.includes(old)) {
        content = content.replace(old, newStr);
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(file, content);
      console.log(`✅ Fixed: ${file}`);
    }
  }
});

console.log('\n✅ All API URLs updated!');
