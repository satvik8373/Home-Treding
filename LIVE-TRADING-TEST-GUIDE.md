# 🧪 Live Trading Testing Guide

## How to Verify Your Trading Platform is Working with Real Data

### Quick Access
Navigate to: **http://localhost:3000/test-live-trading**

This dedicated test page will automatically verify all critical components.

---

## 1. ✅ Instrument Selection Test

### What to Check:
- When you add instruments in "Create Strategy", they should be saved to Firestore
- Instruments should appear in strategy cards

### How to Test:
1. Go to **Strategies** → **Create Strategy**
2. Click "Add Instruments"
3. Select instruments (e.g., BANKNIFTY, NIFTY)
4. Create strategy
5. Go to **My Strategies** tab
6. Verify instruments appear as chips below strategy details

### Expected Result:
```javascript
✓ Instruments saved in Firestore
✓ Displayed in strategy cards
✓ Used when deploying strategy
```

---

## 2. 📊 Live Market Data Test

### What to Check:
- Market data comes from Yahoo Finance API (REAL data)
- Prices update during market hours
- Shows Indian stocks and indices

### How to Test:
1. Go to **Dashboard** or **Trading Dashboard**
2. Check stock prices for RELIANCE, TCS, INFY, HDFCBANK
3. Verify NIFTY 50 and NIFTY BANK indices
4. Prices should match actual market (check on NSE website)

### API Endpoint:
```
GET /api/market/all
```

### Expected Response:
```json
{
  "success": true,
  "data": {
    "stocks": [
      {
        "symbol": "RELIANCE",
        "price": 2450.50,
        "change": 12.30,
        "changePercent": 0.51
      }
    ],
    "indices": [...]
  },
  "source": "Yahoo Finance - Real Live Data"
}
```

---

## 3. 📈 Template Data Test

### What to Check:
- Templates use REAL backtest engine
- Charts show actual backtest results
- Not hardcoded/demo data

### How to Test:
1. Go to **Strategies** → **Strategy Templates**
2. View template cards with charts
3. Data comes from: `/api/strategy-test/quick-backtest?days=60`

### Verification:
- Backend runs actual strategy algorithm
- Generates real candle data
- Calculates real P&L
- Template data refreshes on each load

### Code Location:
```
backend/src/strategies/strategyTester.ts
backend/src/strategies/firstCandleBreakout009.ts
```

---

## 4. 🔗 Dhan Broker Connection Test

### What to Check:
- Dhan API connection works
- Credentials are validated
- Orders can be placed

### How to Test:

#### Step 1: Connect Dhan Broker
1. Go to **Brokers** page
2. Click "Add Broker"
3. Select "Dhan"
4. Enter your Dhan credentials:
   - Client ID
   - Access Token (get from Dhan API)
5. Click "Connect"

#### Step 2: Verify Connection
```
GET /api/broker/list
```

Should show:
```json
{
  "brokers": [{
    "broker": "Dhan",
    "clientId": "your_client_id",
    "status": "Connected",
    "terminalEnabled": true
  }]
}
```

#### Step 3: Enable Terminal
- Click "Enable Terminal" on broker card
- This allows order placement

---

## 5. 📝 Order Placement Test

### ⚠️ CAUTION: This Places REAL Orders!

### How to Test (with minimal risk):

#### Step 1: Test Order API
```javascript
POST /api/broker/place-order
{
  "brokerId": "your_broker_id",
  "orderData": {
    "transactionType": "BUY",
    "securityId": "1333",  // Small stock
    "quantity": 1,         // Minimum quantity
    "orderType": "LIMIT",
    "price": 100
  }
}
```

#### Step 2: Verify in Dhan
1. Log in to Dhan app/website
2. Check "Order Book"
3. Verify order appears
4. Cancel test order immediately

### Order Flow:
```
Your App → Backend API → Dhan API → NSE/BSE → Order Executed
```

### Code Location:
```
backend/src/controllers/brokerController.ts (placeOrder function)
backend/src/services/tradingEngine.ts
```

---

## 6. 🔄 Real-time WebSocket Test

### What to Check:
- Real-time price updates
- Order status updates
- Position changes

### How to Test:
1. Open **Trading Dashboard**
2. Open browser console (F12)
3. Check for WebSocket connection:
```
WebSocket connection established
Connected to trading server
```

4. Watch for real-time events:
   - `market_tick` - Price updates
   - `order_update` - Order status changes
   - `position_update` - P&L updates

### WebSocket URL:
```
ws://localhost:5000 (or your backend URL)
```

---

## 7. 🎯 Strategy Deployment Test

### What to Check:
- Deployed strategies execute automatically
- Orders placed at specified times
- Follows risk rules

### How to Test:

#### Step 1: Deploy Test Strategy
1. Create simple strategy:
   - Start Time: Current time + 2 minutes
   - Instrument: Small liquid stock
   - Quantity: 1
2. Click "Deploy"
3. Fill deployment details
4. Confirm deployment

#### Step 2: Monitor Execution
1. Watch "Deployed Strategies" page
2. At start time, strategy should:
   - Place order via Dhan
   - Show in "My Orders"
   - Update position
3. At end time:
   - Auto square-off
   - Calculate P&L

---

## 8. 💰 Live P&L Tracking

### What to Check:
- P&L updates in real-time
- Matches Dhan account
- Accurate calculations

### How to Test:
1. Place a manual order via Trading Dashboard
2. Go to **Portfolio** page
3. Watch P&L update as price changes
4. Compare with Dhan app P&L

### Formula:
```
Unrealized P&L = (Current Price - Avg Buy Price) × Quantity
Realized P&L = Exit Price - Entry Price (for closed positions)
```

---

## 🛠️ Debugging Tools

### Check Backend Logs:
```bash
cd backend
npm start
# Watch console for:
# 🔗 Broker connection logs
# 📈 Market data fetches
# 📝 Order placements
# ✅ Order confirmations
```

### Check Frontend Network Tab:
1. Open Developer Tools (F12)
2. Network tab
3. Filter: `XHR` or `Fetch`
4. Watch API calls:
   - `/api/market/all`
   - `/api/broker/list`
   - `/api/strategies/deploy`

### Test Endpoints Manually:

#### Get Market Data:
```bash
curl http://localhost:5000/api/market/all
```

#### Get Brokers:
```bash
curl http://localhost:5000/api/broker/list
```

#### Run Backtest:
```bash
curl http://localhost:5000/api/strategy-test/quick-backtest?days=5
```

---

## ✅ Verification Checklist

- [ ] Instrument selection saves to Firestore
- [ ] Market data shows real prices from Yahoo Finance
- [ ] Template charts use real backtest data
- [ ] Dhan broker connects successfully
- [ ] Test order placed and visible in Dhan
- [ ] WebSocket connects and receives updates
- [ ] Deployed strategy executes automatically
- [ ] P&L updates in real-time
- [ ] Orders match between app and Dhan

---

## 🚨 Common Issues & Solutions

### Issue 1: "Broker not connected"
**Solution:** 
- Check Dhan access token is valid
- Get new token from Dhan API portal
- Reconnect broker

### Issue 2: "Market data not loading"
**Solution:**
- Check backend is running
- Verify `REACT_APP_API_BASE_URL` in `.env`
- Check Yahoo Finance API status

### Issue 3: "Orders not placing"
**Solution:**
- Enable terminal on broker card
- Check Dhan account has funds
- Verify market hours (9:15 AM - 3:30 PM IST)

### Issue 4: "Template data not showing"
**Solution:**
- Backend must be running
- Check `/api/strategy-test/quick-backtest` endpoint
- Verify strategy tester is working

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check backend logs for API errors
3. Test each component individually
4. Use the automated test page: `/test-live-trading`

---

## ⚠️ Important Safety Notes

1. **Start with Paper Trading**: Test thoroughly before live trading
2. **Use Small Quantities**: Always test with minimum 1 share/lot
3. **Monitor Closely**: Watch first few trades manually
4. **Set Stop Loss**: Always configure risk limits
5. **Market Hours**: Trading only works 9:15 AM - 3:30 PM IST
6. **Keep Tokens Updated**: Dhan tokens expire periodically

---

## 🎓 Next Steps

Once all tests pass:
1. Create your real strategy
2. Backtest with 60+ days data
3. Paper trade for 1 week
4. Start with 1 lot live trading
5. Scale up gradually

**Happy Trading! 🚀**

