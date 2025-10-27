# Home Trading Platform

A professional algorithmic trading platform with real-time market data, DhanHQ broker integration, and advanced trading strategies.

## 🚀 Features

### ✅ **Real-Time Market Data**
- Live NSE stock prices (RELIANCE, TCS, INFY, HDFCBANK)
- Real-time NIFTY 50 and NIFTY BANK indices
- Auto-refresh every 2 seconds
- Yahoo Finance API integration

### ✅ **DhanHQ Broker Integration**
- Professional API integration with DhanHQ
- Real-time order placement (LIMIT, MARKET, STOP_LOSS)
- Live portfolio and positions tracking
- WebSocket streaming for instant updates
- Secure authentication with Client ID + Access Token

### ✅ **Trading Features**
- Algorithmic trading strategies
- First Candle Breakout strategy
- Strategy backtesting and optimization
- Risk management and position sizing
- Real-time P&L tracking

### ✅ **Professional UI**
- Modern React + Material-UI interface
- Responsive design for all devices
- Real-time charts and market data
- Professional trading dashboard
- Portfolio management interface

## 🛠️ Technology Stack

### **Frontend**
- **React 18** with TypeScript
- **Material-UI (MUI)** for professional UI components
- **Axios** for API communication
- **React Router** for navigation
- **WebSocket** for real-time updates

### **Backend**
- **Node.js** with Express.js
- **DhanHQ API** integration for live trading
- **Yahoo Finance API** for market data
- **WebSocket** server for real-time communication
- **Firebase** for authentication and data storage

## 📦 Installation & Setup

### **Prerequisites**
- Node.js 16+ installed
- DhanHQ trading account (for live trading)
- Git installed

### **1. Clone Repository**
```bash
git clone https://github.com/satvik8373/Home-Treding.git
cd Home-Treding
```

### **2. Backend Setup**
```bash
cd backend
npm install
```

Create `.env` file:
```env
DHAN_CLIENT_ID=your_dhan_client_id
DHAN_ACCESS_TOKEN=your_dhan_access_token
PORT=5000
```

Start backend server:
```bash
npm start
# or for development
node algorroms-server.js
```

### **3. Frontend Setup**
```bash
cd frontend
npm install
npm start
```

The app will open at `http://localhost:3000`

## 🔧 DhanHQ Integration Setup

### **Step 1: Get DhanHQ Credentials**
1. Login to your Dhan trading account
2. Go to **Profile → DhanHQ Trading APIs**
3. Generate **Access Token**
4. Copy your **Client ID** and **Access Token**

### **Step 2: Connect via UI**
1. Open the app at `http://localhost:3000`
2. Go to **"Link Brokerage Account"**
3. Enter your **Client ID** and **Access Token**
4. Click **"Connect to DhanHQ"**
5. Start live trading!

## 📊 API Endpoints

### **Market Data**
- `GET /api/market/all` - Get all live market data
- `GET /api/dhan/market/ltp/:symbol` - Get live price for specific symbol

### **Trading**
- `POST /api/dhan/orders/place` - Place new order
- `GET /api/dhan/orders/:clientId` - Get all orders
- `GET /api/dhan/portfolio/:clientId` - Get portfolio and positions

### **Authentication**
- `POST /api/dhan/auth/login` - Connect to DhanHQ
- `GET /api/dhan/status/:clientId` - Check connection status

## 🎯 Usage Examples

### **Live Market Data**
```javascript
// Get real-time market data
const response = await fetch('http://localhost:5000/api/market/all');
const data = await response.json();
console.log(data.data.stocks); // Live stock prices
```

### **Place Order via DhanHQ**
```javascript
const order = {
  clientId: 'your_client_id',
  symbol: 'RELIANCE',
  quantity: 10,
  orderType: 'LIMIT',
  price: 2850,
  exchange: 'NSE_EQ'
};

const response = await fetch('http://localhost:5000/api/dhan/orders/place', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(order)
});
```

## 🔒 Security Features

- Secure DhanHQ API authentication
- Environment variables for sensitive data
- HTTPS support for production
- Rate limiting and error handling
- Input validation and sanitization

## 📈 Trading Strategies

### **First Candle Breakout**
- Automated strategy implementation
- Real-time signal generation
- Risk management integration
- Backtesting capabilities

## 🚀 Deployment

### **Vercel Deployment (Frontend)**
The React frontend is automatically deployed to Vercel:

1. **Automatic Deployment:** Connected to GitHub for auto-deploy
2. **Build Command:** `cd frontend && npm run build`
3. **Output Directory:** `frontend/build`
4. **Live URL:** Will be provided after successful deployment

### **Backend Deployment**
For the backend API server, you can deploy to:

**Option 1: Railway/Render**
```bash
# Deploy backend to Railway or Render
# Set environment variables:
# - DHAN_CLIENT_ID
# - DHAN_ACCESS_TOKEN
# - PORT=5000
```

**Option 2: Traditional VPS**
1. Set up environment variables
2. Configure HTTPS certificates  
3. Set up reverse proxy (Nginx)
4. Configure PM2 for process management
5. Set up monitoring and logging

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is for educational and research purposes. Trading involves substantial risk of loss. Use at your own risk and ensure compliance with local regulations.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Email: support@hometrading.com

## 🎉 Acknowledgments

- DhanHQ for providing professional trading APIs
- Yahoo Finance for market data
- Material-UI for beautiful components
- React community for excellent documentation

---

**Built with ❤️ for algorithmic traders**