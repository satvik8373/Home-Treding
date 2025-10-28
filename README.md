# 🚀 AlgoRooms Trading Platform - Advanced

Professional algorithmic trading platform with real-time market data, order management, and portfolio tracking.

## ⚡ Quick Setup

### Automated Setup (Recommended)
```bash
npm run setup-advanced
```

### Manual Setup
```bash
# Install dependencies
cd backend && npm install socket.io ws @types/ws typescript @types/node
cd ../frontend && npm install socket.io-client

# Compile TypeScript
cd backend && npx tsc

# Start services
cd backend && npm start  # Terminal 1
cd frontend && npm start # Terminal 2
```

## 🎯 Access Points

- **Main Dashboard**: http://localhost:3000/dashboard
- **Trading Dashboard**: http://localhost:3000/trading-dashboard
- **Broker Management**: http://localhost:3000/brokers
- **Portfolio**: http://localhost:3000/portfolio
- **Strategies**: http://localhost:3000/strategies

## 🆕 Advanced Features

### 🔥 Real-time Trading Engine
- Live order execution and management
- Market data streaming via WebSocket
- Position tracking with real-time P&L
- Risk management and validation

### 📊 Professional Dashboard
- Live market data feeds
- Real-time order book
- Portfolio performance tracking
- Trading engine controls

### 💼 Portfolio Management
- Real-time position updates
- P&L calculation (realized & unrealized)
- Performance metrics and analytics
- Trade history and reporting

### 🤖 Strategy Framework
- Algorithm lifecycle management
- Backtesting capabilities
- Risk settings per strategy
- Performance monitoring

### 🛡️ Security & Risk Management
- Input validation and sanitization
- Position size limits
- Price deviation checks
- Real-time risk monitoring

## 🔧 API Endpoints

### Trading Engine
- `GET /api/trading/engine/status` - Engine status
- `POST /api/trading/engine/start` - Start engine
- `POST /api/trading/engine/stop` - Stop engine

### Orders
- `POST /api/trading/orders` - Place order
- `GET /api/trading/orders` - Get orders
- `DELETE /api/trading/orders/:id` - Cancel order

### Portfolio
- `GET /api/portfolio/positions` - Get positions
- `GET /api/portfolio/summary` - Portfolio summary
- `GET /api/portfolio/performance` - Performance metrics

## 🔌 WebSocket Events

Real-time updates for:
- Market data ticks
- Order status changes
- Position updates
- Portfolio changes
- Trading engine status

## 📱 Usage Guide

1. **Setup**: Run `npm run setup-advanced`
2. **Start Services**: Backend + Frontend
3. **Connect Broker**: Add Dhan credentials in /brokers
4. **Start Trading**: Access /trading-dashboard
5. **Monitor Portfolio**: View real-time P&L in /portfolio

## 🚨 Verification

```bash
node verify-setup.js  # Check setup status
```

## 🏗️ Architecture

```
Frontend (React + TypeScript + Material-UI)
├── Trading Dashboard
├── Real-time Components  
├── WebSocket Integration
└── Professional UI/UX

Backend (Node.js + TypeScript + Socket.IO)
├── Trading Engine
├── Order Management
├── Portfolio Service
├── WebSocket Service
└── Risk Management
```

## 📈 Production Ready

- ✅ Real-time market data streaming
- ✅ Professional order management
- ✅ Live portfolio tracking
- ✅ WebSocket connectivity
- ✅ Risk management system
- ✅ Scalable architecture
- ✅ Modern UI/UX
- ✅ TypeScript implementation

## 🎉 Ready to Trade!

Your platform now includes enterprise-grade algorithmic trading capabilities with real-time data processing, professional order management, and comprehensive portfolio tracking.
