# Design Document

## Overview

This document outlines the technical design for the algorithmic trading platform that integrates with the Dhan brokerage API. The platform is built as a full-stack web application with a React frontend and Node.js backend, enabling users to create, backtest, and deploy automated trading strategies.

### Key Design Principles

- **Modularity**: Clear separation between frontend, backend, and external API integrations
- **Security**: Encrypted credential storage, secure API communication, audit logging
- **Scalability**: Asynchronous job processing for backtests, WebSocket for real-time data
- **Reliability**: Error handling, retry mechanisms, graceful degradation
- **User Experience**: Responsive design, real-time updates, clear feedback

### Technology Stack

**Frontend:**
- React 19.2.0 (existing)
- React Router for navigation
- Axios for HTTP requests
- Chart.js or Recharts for data visualization
- WebSocket client for real-time updates
- TailwindCSS or Material-UI for styling

**Backend:**
- Node.js with Express.js
- PostgreSQL for relational data (users, strategies, trades)
- Redis for caching and session management
- Bull Queue for background job processing
- WebSocket (Socket.io) for real-time communication
- JWT for authentication

**External Integrations:**
- Dhan API for brokerage operations
- Email service (SendGrid/AWS SES) for notifications


## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         React SPA (Browser)                          │   │
│  │  - UI Components  - State Management  - WebSocket    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS / WebSocket
                            │
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    Express.js Server                                 │   │
│  │  - Authentication  - Rate Limiting  - Validation     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│  Application   │  │   Strategy  │  │   Data Ingestion│
│    Services    │  │   Execution │  │     Service     │
│                │  │   Engine    │  │                 │
│ - User Mgmt    │  │             │  │ - Market Data   │
│ - Strategy Mgmt│  │ - Signal    │  │ - WebSocket     │
│ - Portfolio    │  │   Generation│  │ - Historical    │
│ - Notifications│  │ - Order     │  │   Data Fetch    │
└────────┬───────┘  │   Placement │  └────────┬────────┘
         │          └──────┬──────┘           │
         │                 │                  │
┌────────▼─────────────────▼──────────────────▼────────┐
│              Data & Queue Layer                       │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  PostgreSQL  │  │  Redis   │  │  Bull Queue    │  │
│  │  (Primary DB)│  │  (Cache) │  │  (Jobs)        │  │
│  └──────────────┘  └──────────┘  └────────────────┘  │
└───────────────────────────────────────────────────────┘
                            │
                    External API Calls
                            │
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dhan API    │  │  Email       │  │  SMS         │      │
│  │  (Trading)   │  │  Service     │  │  Service     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

**User Authentication Flow:**
1. User submits credentials → API Gateway validates → JWT token issued
2. Token stored in browser (httpOnly cookie or localStorage)
3. Subsequent requests include token in Authorization header

**Strategy Deployment Flow:**
1. User clicks "Deploy" → Frontend sends POST /api/deployments
2. Backend validates brokerage link → Creates deployment record
3. Strategy Execution Engine subscribes to market data
4. On signal generation → Order placed via Dhan API
5. Order status synced back → User notified via WebSocket

**Backtesting Flow:**
1. User initiates backtest → Job added to Bull Queue
2. Worker fetches historical data → Simulates strategy execution
3. Results computed → Stored in database
4. User notified via WebSocket → Results displayed

## Components and Interfaces

### Frontend Components

#### 1. Authentication Components
- **LoginForm**: Email/password input, validation, error display
- **SignupForm**: Registration fields with validation
- **ForgotPassword**: Password reset flow
- **TwoFactorAuth**: OTP input and verification

#### 2. Dashboard Components
- **DashboardLayout**: Main layout with sidebar navigation
- **DashboardSummary**: Cards showing key metrics (P&L, active strategies, linked accounts)
- **QuickActions**: Buttons for common actions (create strategy, view portfolio)

#### 3. Brokerage Components
- **BrokerageLink**: Form for API credentials with instructions
- **BrokerageStatus**: Display connection status and account details
- **BrokerageList**: Manage multiple linked accounts

#### 4. Strategy Components
- **StrategyBuilder**: Form for creating/editing strategies
  - InstrumentSelector: Dropdown for equity/futures/options
  - RuleEditor: Text area or visual builder for entry/exit rules
  - RiskParameters: Inputs for stop-loss, target, position size
- **StrategyList**: Table with filters and actions
- **StrategyCard**: Individual strategy display with status badge

#### 5. Backtesting Components
- **BacktestForm**: Date range picker, granularity selector
- **BacktestProgress**: Progress bar and status updates
- **BacktestResults**: Charts and metrics display
  - EquityCurve: Line chart of portfolio value over time
  - TradeDistribution: Histogram of trades
  - MetricsPanel: Win rate, profit factor, drawdown stats

#### 6. Trading Components
- **DeploymentModal**: Confirmation dialog with risk warnings
- **LiveStrategyMonitor**: Real-time status of deployed strategies
- **OrderBook**: Table of orders with filters
- **TradeHistory**: Detailed trade log with export

#### 7. Portfolio Components
- **PortfolioSummary**: Cards for total value, P&L, returns
- **PositionsList**: Table of current positions
- **PerformanceChart**: Historical portfolio value chart

#### 8. Analytics Components
- **StrategyAnalytics**: Detailed performance metrics
- **ComparisonView**: Side-by-side strategy comparison
- **HeatMap**: Time-based performance visualization

#### 9. Notification Components
- **NotificationBell**: Icon with unread count
- **NotificationList**: Inbox-style list with filters
- **NotificationToast**: Pop-up for real-time alerts

#### 10. Settings Components
- **ProfileSettings**: Edit user information
- **SecuritySettings**: Password change, 2FA management
- **BillingSettings**: Plan details, upgrade options
- **PreferencesSettings**: Notification preferences, display options

### Backend API Endpoints

#### Authentication Endpoints
```
POST   /api/auth/register          - Create new user account
POST   /api/auth/login             - Authenticate user
POST   /api/auth/logout            - Invalidate session
POST   /api/auth/refresh           - Refresh JWT token
POST   /api/auth/forgot-password   - Initiate password reset
POST   /api/auth/reset-password    - Complete password reset
POST   /api/auth/enable-2fa        - Enable two-factor auth
POST   /api/auth/verify-2fa        - Verify 2FA code
```

#### User Endpoints
```
GET    /api/user/profile           - Get user profile
PUT    /api/user/profile           - Update user profile
PUT    /api/user/password          - Change password
GET    /api/user/preferences       - Get user preferences
PUT    /api/user/preferences       - Update preferences
```

#### Brokerage Endpoints
```
GET    /api/brokerages             - List linked brokerage accounts
POST   /api/brokerages/link        - Link new brokerage account
PUT    /api/brokerages/:id         - Update brokerage credentials
DELETE /api/brokerages/:id         - Unlink brokerage account
POST   /api/brokerages/:id/test    - Test brokerage connection
GET    /api/brokerages/:id/status  - Get account status
```

#### Strategy Endpoints
```
GET    /api/strategies             - List user strategies
POST   /api/strategies             - Create new strategy
GET    /api/strategies/:id         - Get strategy details
PUT    /api/strategies/:id         - Update strategy
DELETE /api/strategies/:id         - Delete strategy
POST   /api/strategies/:id/clone   - Clone existing strategy
```

#### Backtesting Endpoints
```
POST   /api/backtests              - Initiate backtest job
GET    /api/backtests/:jobId       - Get backtest status
GET    /api/backtests/:jobId/results - Get backtest results
GET    /api/backtests/history      - List past backtests
POST   /api/backtests/:jobId/export - Export results (PDF/CSV)
```

#### Deployment Endpoints
```
GET    /api/deployments            - List deployments
POST   /api/deployments            - Deploy strategy live
GET    /api/deployments/:id        - Get deployment details
PUT    /api/deployments/:id/pause  - Pause deployment
PUT    /api/deployments/:id/resume - Resume deployment
DELETE /api/deployments/:id        - Stop deployment
GET    /api/deployments/:id/logs   - Get execution logs
```

#### Trading Endpoints
```
GET    /api/orders                 - List orders
GET    /api/orders/:id             - Get order details
POST   /api/orders                 - Place manual order
PUT    /api/orders/:id/cancel      - Cancel order
GET    /api/trades                 - List executed trades
GET    /api/trades/:id             - Get trade details
```

#### Portfolio Endpoints
```
GET    /api/portfolio/summary      - Get portfolio summary
GET    /api/portfolio/positions    - Get current positions
GET    /api/portfolio/holdings     - Get holdings
GET    /api/portfolio/pnl          - Get P&L breakdown
GET    /api/portfolio/history      - Get historical portfolio values
```

#### Analytics Endpoints
```
GET    /api/analytics/strategy/:id - Get strategy performance metrics
GET    /api/analytics/compare      - Compare multiple strategies
GET    /api/analytics/drawdown/:id - Get drawdown analysis
GET    /api/analytics/distribution/:id - Get trade distribution
```

#### Notification Endpoints
```
GET    /api/notifications          - List notifications
PUT    /api/notifications/:id/read - Mark as read
PUT    /api/notifications/read-all - Mark all as read
DELETE /api/notifications/:id      - Delete notification
```

#### Admin Endpoints
```
GET    /api/admin/dashboard        - Get admin dashboard metrics
GET    /api/admin/users            - List all users
PUT    /api/admin/users/:id/status - Update user status
GET    /api/admin/logs             - Get system logs
GET    /api/admin/metrics          - Get platform metrics
```

#### Market Data Endpoints
```
GET    /api/market/instruments     - Search instruments
GET    /api/market/quote/:symbol   - Get current quote
GET    /api/market/historical      - Get historical data
WebSocket /ws/market               - Real-time market data stream
```

### Backend Services Architecture

#### 1. Authentication Service
**Responsibilities:**
- User registration and login
- JWT token generation and validation
- Password hashing (bcrypt)
- 2FA management
- Session management

**Key Methods:**
```javascript
registerUser(userData)
authenticateUser(email, password)
generateToken(userId)
validateToken(token)
enable2FA(userId)
verify2FA(userId, code)
```

#### 2. Brokerage Service
**Responsibilities:**
- Store and manage API credentials (encrypted)
- Validate Dhan API connection
- Sync account data from Dhan
- Handle API rate limiting

**Key Methods:**
```javascript
linkBrokerage(userId, credentials)
testConnection(brokerageId)
encryptCredentials(credentials)
decryptCredentials(brokerageId)
syncAccountData(brokerageId)
```

**Dhan API Integration Points:**
- Authentication: Generate access token from API key/secret
- Account Info: GET /v2/holdings, GET /v2/positions
- Order Placement: POST /v2/orders
- Order Status: GET /v2/orders/{orderId}
- Market Data: WebSocket connection for live feeds

#### 3. Strategy Service
**Responsibilities:**
- CRUD operations for strategies
- Strategy validation
- Rule parsing and compilation
- Strategy versioning

**Key Methods:**
```javascript
createStrategy(userId, strategyData)
updateStrategy(strategyId, updates)
deleteStrategy(strategyId)
validateRules(entryRule, exitRule)
compileStrategy(strategyId)
```

#### 4. Backtesting Service
**Responsibilities:**
- Queue backtest jobs
- Fetch historical data
- Execute strategy simulation
- Calculate performance metrics
- Generate reports

**Key Methods:**
```javascript
initiateBacktest(strategyId, params)
fetchHistoricalData(symbol, fromDate, toDate, granularity)
simulateStrategy(strategy, marketData)
calculateMetrics(trades)
generateReport(backtestId)
```

**Performance Metrics Calculated:**
- Total Return %
- Win Rate
- Profit Factor (gross profit / gross loss)
- Max Drawdown
- Sharpe Ratio
- Average Trade P&L
- Total Trades
- Average Holding Time

#### 5. Strategy Execution Engine
**Responsibilities:**
- Monitor live market data
- Generate trading signals
- Place orders via Dhan API
- Track order status
- Handle errors and retries

**Key Methods:**
```javascript
startExecution(deploymentId)
stopExecution(deploymentId)
processMarketData(deploymentId, marketData)
generateSignal(strategy, marketData)
placeOrder(deploymentId, signal)
handleOrderCallback(orderId, status)
```

**Signal Generation Flow:**
1. Receive market data tick
2. Evaluate entry/exit rules
3. Check risk parameters (position size, stop-loss)
4. Generate BUY/SELL/HOLD signal
5. If BUY/SELL, place order via Dhan API
6. Log signal and order details

#### 6. Order Management Service
**Responsibilities:**
- Place orders via Dhan API
- Track order lifecycle
- Sync order status
- Handle order modifications/cancellations

**Key Methods:**
```javascript
placeOrder(brokerageId, orderParams)
cancelOrder(orderId)
modifyOrder(orderId, updates)
syncOrderStatus(orderId)
getOrderHistory(userId, filters)
```

**Dhan Order API Integration:**
```javascript
// Place Order
POST /v2/orders
{
  "dhanClientId": "...",
  "transactionType": "BUY",
  "exchangeSegment": "NSE_EQ",
  "productType": "INTRADAY",
  "orderType": "MARKET",
  "validity": "DAY",
  "securityId": "1333",
  "quantity": 10
}

// Response handling
{
  "orderId": "...",
  "orderStatus": "PENDING"
}
```

#### 7. Portfolio Service
**Responsibilities:**
- Fetch positions from Dhan
- Calculate portfolio metrics
- Track P&L
- Generate portfolio reports

**Key Methods:**
```javascript
getPortfolioSummary(userId)
getPositions(brokerageId)
calculatePnL(positions, currentPrices)
getHistoricalPortfolioValue(userId, dateRange)
```

#### 8. Market Data Service
**Responsibilities:**
- Establish WebSocket connection to Dhan
- Subscribe to instrument feeds
- Cache market data in Redis
- Distribute data to execution engines

**Key Methods:**
```javascript
connectWebSocket()
subscribeToInstrument(symbol)
unsubscribeFromInstrument(symbol)
getCachedQuote(symbol)
getHistoricalData(symbol, params)
```

**WebSocket Data Flow:**
1. Connect to Dhan WebSocket endpoint
2. Authenticate with access token
3. Subscribe to required instruments
4. Receive tick data (price, volume, timestamp)
5. Update Redis cache
6. Broadcast to active deployments via Socket.io

#### 9. Notification Service
**Responsibilities:**
- Create and store notifications
- Send email/SMS alerts
- Push notifications via WebSocket
- Manage notification preferences

**Key Methods:**
```javascript
createNotification(userId, type, message, metadata)
sendEmail(userId, subject, body)
sendSMS(userId, message)
pushToWebSocket(userId, notification)
markAsRead(notificationId)
```

**Notification Types:**
- STRATEGY_DEPLOYED
- STRATEGY_PAUSED
- ORDER_PLACED
- ORDER_FAILED
- PROFIT_TARGET_REACHED
- STOP_LOSS_TRIGGERED
- MARGIN_WARNING
- API_CONNECTION_LOST

#### 10. Analytics Service
**Responsibilities:**
- Compute strategy performance metrics
- Generate comparison reports
- Calculate risk metrics
- Create visualizations data

**Key Methods:**
```javascript
getStrategyMetrics(strategyId)
compareStrategies(strategyIds)
calculateDrawdown(portfolioValues)
getTradeDistribution(strategyId)
generateEquityCurve(trades)
```

## Data Models

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  two_fa_enabled BOOLEAN DEFAULT false,
  two_fa_secret VARCHAR(255),
  subscription_plan VARCHAR(50) DEFAULT 'free',
  subscription_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
```

#### Brokerages Table
```sql
CREATE TABLE brokerages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker_name VARCHAR(50) DEFAULT 'dhan',
  client_id VARCHAR(255) NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  static_ip VARCHAR(50),
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_brokerages_user_id ON brokerages(user_id);
CREATE INDEX idx_brokerages_is_active ON brokerages(is_active);
```

#### Strategies Table
```sql
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  instrument_type VARCHAR(50) NOT NULL, -- EQUITY, FUTURES, OPTIONS, CURRENCY
  symbol VARCHAR(50),
  timeframe VARCHAR(10) NOT NULL, -- 1m, 5m, 15m, 1h, 1d
  entry_rule TEXT NOT NULL,
  exit_rule TEXT NOT NULL,
  stop_loss_percent DECIMAL(5,2),
  target_percent DECIMAL(5,2),
  position_size INTEGER,
  max_positions INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'draft', -- draft, backtested, live, archived
  compiled_code TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strategies_user_id ON strategies(user_id);
CREATE INDEX idx_strategies_status ON strategies(status);
```

#### Backtests Table
```sql
CREATE TABLE backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  granularity VARCHAR(10) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  total_trades INTEGER,
  winning_trades INTEGER,
  losing_trades INTEGER,
  win_rate DECIMAL(5,2),
  total_profit DECIMAL(15,2),
  total_loss DECIMAL(15,2),
  net_profit DECIMAL(15,2),
  profit_factor DECIMAL(10,2),
  max_drawdown DECIMAL(10,2),
  sharpe_ratio DECIMAL(10,4),
  avg_trade_pnl DECIMAL(15,2),
  equity_curve JSONB, -- Array of {date, value}
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_backtests_strategy_id ON backtests(strategy_id);
CREATE INDEX idx_backtests_user_id ON backtests(user_id);
CREATE INDEX idx_backtests_status ON backtests(status);
```

#### Deployments Table
```sql
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  brokerage_id UUID REFERENCES brokerages(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active', -- active, paused, stopped, error
  deployed_at TIMESTAMP DEFAULT NOW(),
  paused_at TIMESTAMP,
  stopped_at TIMESTAMP,
  total_orders INTEGER DEFAULT 0,
  successful_orders INTEGER DEFAULT 0,
  failed_orders INTEGER DEFAULT 0,
  total_pnl DECIMAL(15,2) DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deployments_strategy_id ON deployments(strategy_id);
CREATE INDEX idx_deployments_user_id ON deployments(user_id);
CREATE INDEX idx_deployments_status ON deployments(status);
```

#### Orders Table
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  brokerage_id UUID REFERENCES brokerages(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES deployments(id) ON DELETE SET NULL,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  dhan_order_id VARCHAR(255),
  symbol VARCHAR(50) NOT NULL,
  exchange VARCHAR(50) NOT NULL,
  transaction_type VARCHAR(10) NOT NULL, -- BUY, SELL
  product_type VARCHAR(50) NOT NULL, -- INTRADAY, DELIVERY, MARGIN
  order_type VARCHAR(50) NOT NULL, -- MARKET, LIMIT, STOP_LOSS
  quantity INTEGER NOT NULL,
  price DECIMAL(15,2),
  trigger_price DECIMAL(15,2),
  status VARCHAR(50) DEFAULT 'pending', -- pending, placed, executed, cancelled, rejected, failed
  filled_quantity INTEGER DEFAULT 0,
  average_price DECIMAL(15,2),
  order_timestamp TIMESTAMP,
  execution_timestamp TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_deployment_id ON orders(deployment_id);
CREATE INDEX idx_orders_dhan_order_id ON orders(dhan_order_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

#### Trades Table
```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  deployment_id UUID REFERENCES deployments(id) ON DELETE SET NULL,
  buy_order_id UUID REFERENCES orders(id),
  sell_order_id UUID REFERENCES orders(id),
  symbol VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  entry_price DECIMAL(15,2) NOT NULL,
  exit_price DECIMAL(15,2),
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP,
  pnl DECIMAL(15,2),
  pnl_percent DECIMAL(10,2),
  holding_duration INTEGER, -- in minutes
  status VARCHAR(50) DEFAULT 'open', -- open, closed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_entry_time ON trades(entry_time);
```

#### Notifications Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  link VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

#### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  ip_address VARCHAR(50),
  user_agent TEXT,
  request_data JSONB,
  response_status INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

### Redis Cache Structure

**Session Storage:**
```
session:{userId} → { token, expiresAt, metadata }
TTL: 24 hours
```

**Market Data Cache:**
```
quote:{symbol} → { price, volume, timestamp, bid, ask }
TTL: 5 seconds

historical:{symbol}:{granularity}:{date} → OHLC data array
TTL: 1 hour
```

**Rate Limiting:**
```
ratelimit:{userId}:{endpoint} → request count
TTL: 1 minute
```

**Active Deployments:**
```
deployment:{deploymentId} → { strategyId, userId, brokerageId, status }
TTL: None (persistent)
```

**WebSocket Subscriptions:**
```
subscriptions:{symbol} → Set of deploymentIds
TTL: None (managed manually)
```

## Error Handling

### Error Categories and Responses

#### 1. Authentication Errors
```javascript
{
  "error": "UNAUTHORIZED",
  "message": "Invalid credentials",
  "code": 401
}
```

#### 2. Validation Errors
```javascript
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "code": 400,
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

#### 3. Brokerage API Errors
```javascript
{
  "error": "BROKERAGE_ERROR",
  "message": "Failed to place order",
  "code": 502,
  "details": {
    "brokerError": "Insufficient margin",
    "brokerCode": "MARGIN_INSUFFICIENT"
  }
}
```

#### 4. Strategy Execution Errors
```javascript
{
  "error": "EXECUTION_ERROR",
  "message": "Strategy execution failed",
  "code": 500,
  "details": {
    "deploymentId": "...",
    "reason": "Market data unavailable"
  }
}
```

### Error Handling Strategy

**Frontend:**
- Display user-friendly error messages
- Log errors to monitoring service
- Provide retry options where applicable
- Show fallback UI for critical failures

**Backend:**
- Catch and log all errors with context
- Return appropriate HTTP status codes
- Implement retry logic with exponential backoff
- Circuit breaker for external API calls
- Graceful degradation (e.g., use cached data if API fails)

**Dhan API Error Handling:**
```javascript
async function placeOrderWithRetry(orderParams, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await dhanAPI.placeOrder(orderParams);
      return response;
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        await sleep(1000 * attempt); // Exponential backoff
        continue;
      }
      if (error.code === 'STATIC_IP_NOT_WHITELISTED') {
        throw new BrokerageError('Static IP not whitelisted', error);
      }
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
}
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Usage
const dhanCircuitBreaker = new CircuitBreaker();
await dhanCircuitBreaker.execute(() => dhanAPI.getPositions());
```

## Testing Strategy

### Unit Testing

**Frontend (React Components):**
- Use Jest and React Testing Library
- Test component rendering
- Test user interactions (clicks, form submissions)
- Test state management
- Mock API calls with MSW (Mock Service Worker)

**Backend (Services):**
- Use Jest or Mocha
- Test service methods in isolation
- Mock database calls
- Mock external API calls (Dhan)
- Test error handling paths

**Example Test Structure:**
```javascript
// Backend Service Test
describe('StrategyService', () => {
  describe('createStrategy', () => {
    it('should create a strategy with valid data', async () => {
      const mockStrategy = { name: 'Test', entryRule: '...' };
      const result = await strategyService.createStrategy(userId, mockStrategy);
      expect(result).toHaveProperty('id');
      expect(result.status).toBe('draft');
    });

    it('should throw error for invalid rules', async () => {
      const invalidStrategy = { name: 'Test', entryRule: '' };
      await expect(
        strategyService.createStrategy(userId, invalidStrategy)
      ).rejects.toThrow('Entry rule cannot be empty');
    });
  });
});

// Frontend Component Test
describe('StrategyBuilder', () => {
  it('should render form fields', () => {
    render(<StrategyBuilder />);
    expect(screen.getByLabelText('Strategy Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Entry Rule')).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    const mockSubmit = jest.fn();
    render(<StrategyBuilder onSubmit={mockSubmit} />);
    
    fireEvent.change(screen.getByLabelText('Strategy Name'), {
      target: { value: 'My Strategy' }
    });
    fireEvent.click(screen.getByText('Save'));
    
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Strategy' })
      );
    });
  });
});
```

### Integration Testing

**API Endpoint Testing:**
- Use Supertest for HTTP testing
- Test complete request/response cycles
- Test authentication middleware
- Test database transactions
- Use test database instance

**Example:**
```javascript
describe('POST /api/strategies', () => {
  it('should create strategy for authenticated user', async () => {
    const token = await getAuthToken(testUser);
    const response = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Strategy',
        instrumentType: 'EQUITY',
        entryRule: 'price > sma(20)',
        exitRule: 'price < sma(20)',
        stopLoss: 2,
        target: 5
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toBe('draft');
  });

  it('should return 401 for unauthenticated request', async () => {
    const response = await request(app)
      .post('/api/strategies')
      .send({ name: 'Test' });
    
    expect(response.status).toBe(401);
  });
});
```

### End-to-End Testing

**User Flow Testing:**
- Use Cypress or Playwright
- Test complete user journeys
- Test critical paths (signup → link brokerage → create strategy → backtest → deploy)
- Test error scenarios

**Example Cypress Test:**
```javascript
describe('Strategy Creation Flow', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password');
  });

  it('should create and backtest a strategy', () => {
    // Navigate to strategy builder
    cy.visit('/strategies/new');
    
    // Fill form
    cy.get('[name="name"]').type('Breakout Strategy');
    cy.get('[name="instrumentType"]').select('EQUITY');
    cy.get('[name="entryRule"]').type('price > high(20)');
    cy.get('[name="exitRule"]').type('price < low(20)');
    cy.get('[name="stopLoss"]').type('2');
    cy.get('[name="target"]').type('5');
    
    // Save strategy
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/strategies/');
    
    // Initiate backtest
    cy.contains('Backtest').click();
    cy.get('[name="fromDate"]').type('2024-01-01');
    cy.get('[name="toDate"]').type('2024-12-31');
    cy.get('button').contains('Run Backtest').click();
    
    // Wait for results
    cy.contains('Backtest completed', { timeout: 30000 });
    cy.contains('Win Rate').should('be.visible');
  });
});
```

### Performance Testing

**Load Testing:**
- Use Artillery or k6
- Test API endpoints under load
- Test WebSocket connections with multiple clients
- Test strategy execution engine with multiple deployments

**Example k6 Script:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  const token = 'test-jwt-token';
  const response = http.get('http://localhost:3000/api/strategies', {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

### Security Testing

**Areas to Test:**
- SQL injection prevention
- XSS prevention
- CSRF protection
- Authentication bypass attempts
- Authorization checks
- Credential encryption
- Rate limiting
- Input validation

**Tools:**
- OWASP ZAP for automated security scanning
- Manual penetration testing
- Dependency vulnerability scanning (npm audit)
