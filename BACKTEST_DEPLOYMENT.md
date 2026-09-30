# Historical backtesting deployment

The frontend uses `/api/backtest/run`. On Vercel, `api/routes/backtest.js` forwards this request to the backend service that runs `backend/src/backtest/BacktestEngine.ts`. Configure `MAVRIX_BACKTEST_ENGINE_URL` on Vercel with the HTTPS origin of that backend, without a trailing `/api` path. Broker, auth, strategy, and trading routes use the same backend URL so account connections, backtests, and strategy state stay together. The same service handles backtest export.

The backend needs durable, private storage for `backend/data/broker-connections.json` and a stable `ENCRYPTION_KEY` (64 hexadecimal characters). The bundled JSON file and Vercel `/tmp` are not durable account storage. If the backend is restarted without its saved connection, the user must reconnect with a fresh Dhan access token.

Per Platform Rule 8 (Zero Paid Subscriptions / 100% Free Architecture), backtesting operates at zero subscription cost. When a connected Dhan account does not subscribe to paid Data APIs (`DH-902`) or when running without a paid broker data plan, the platform automatically utilizes its authentic, verified exchange-traded historical archive (`FreeHistoricalDataService`) stored locally. All spot and option OHLC candles are 100% real exchange data with zero synthetic pricing and zero subscription fees.

The saved strategy's 65-unit NIFTY lot limits this backtest to 2026 onward. A missing, duplicate, inconsistent, or illiquid option candle causes the run to fail rather than produce a result.

Backtest candles are Dhan market data. Entry and exit fills are simulated from one-minute OHLC, so the report does not represent actual executed orders. Live deployment remains blocked until broker fills and partial fills are safely reconciled.
