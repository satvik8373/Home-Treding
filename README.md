# Mavrix NIFTY 009

A fresh React + TypeScript project with a dedicated Node trading engine. It implements only the independent NIFTY ATM CE/PE strategy confirmed in this conversation. No application code, settings, credentials, or market-data files are imported from the older Python project.

## Run

Requires Node.js **22.18+ within Node 22.x**. On Windows, double-click `run.bat`, or use:

```powershell
cd "E:\Mavrix Trading\AI-Plus-Algo-Trading\nifty-009"
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4310**. Keep the backend terminal running while a strategy is active. Closing the browser does not stop monitoring. The server binds to this computer by default. For the Vercel-native hosted Paper worker, encrypted cloud storage, or the external-engine gateway, follow [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md).

For development, `npm run dev` runs the React UI at **http://127.0.0.1:5173** and proxies API requests to the backend. Development reloads can interrupt a session; use the built app with `npm start` for trading.

## Connect and run

1. Click **Connect mStock**. Enter your client code, API key and existing password.
2. Enter either your fresh authenticator code or the SMS OTP, matching the verification method enabled for your mStock account.
3. Choose **Paper** or **Live**. Live requires the explicit real-orders checkbox.
4. Click **Start strategy** between 09:00 and the saved cutoff (15:10 IST by default) on an exchange trading weekday. Before 09:20, the engine arms and waits. It resolves the ATM pair from the NIFTY opening-candle close, retrieves both option reference candles, and subscribes to the three market tokens.
5. **Stop & square off** disables entries immediately and closes confirmed strategy quantities. Partial fills remain tracked until flat.

Tokens are encrypted in the backend’s local SQLite store. Passwords and OTPs are never persisted. Reconnect when the broker session expires. No AI service or additional market-data subscription is used by the application.

**Broker & execution IP setup**, inside Connect mStock, guides the same connection flow on a hosted deployment. It observes the engine's actual outbound IPv4, offers copy/recheck, detects recorded IP changes and optionally compares user-entered primary/secondary IP references scoped to the account and API key. It does not claim an observed IP is static or broker-approved. The hosted container configuration and production setup flow are documented in [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md); frontend deployment alone does not provision a persistent engine.

## Default strategy rules

- Underlying: NIFTY 50. Select the nearest available ATM strike from the **09:20 NIFTY opening-candle close**, using the nearest unexpired CE/PE pair and the broker’s current lot size. A late start still uses that historical opening close.
- Reference: each option’s **09:15–09:20 close**, locked for the session.
- Upper level: `round(referenceClose × 1.0009, 2)`; lower level: `round(referenceClose × 0.9991, 2)`. This is **0.09%**, not 0.9%.
- From 09:25, a **new completed five-minute close >= upper** buys **3 lots** in a flat leg. Intrabar highs cannot trigger entries. CE and PE decide independently; both may be open.
- Fresh option prices trigger Target 1 at **actual entry fill + ₹20** for **1 lot**, then Target 2 at **actual entry fill + ₹40** for all remaining quantity. Historical candle highs are never presented as executable fills.
- A completed five-minute close **strictly below lower** exits the remaining leg. A later qualifying candle may re-enter.
- At **15:10 IST**, new entries stop and both legs square off. Stop uses the same quantity-verified exit flow.

## Execution and recovery

The backend serializes order submissions. It records an intent before sending an order, records the broker’s acknowledgement ID, and updates positions only after a terminal broker execution response supplies the actual quantity and average price. Cancellation requests also require subsequent terminal confirmation. An unknown submission is reconciled by ID or its unique order tag and is never resent automatically.

Reference downloads run outside the order queue so slow chart requests do not hold up Stop or target processing. Current-day history falls back to the official intraday endpoint when date-ranged history fails, is empty, or returns `candles: null`.

Buys require fresh official option prices. The authenticated WebSocket is the primary feed; the official REST quote endpoint supplies fresh snapshots when streaming is unavailable, for both Paper and Live modes. The fallback polls missing CE/PE marks in one request at most every 2.5 seconds and runs outside the order queue. Invalid/stale data blocks an entry rather than inventing a premium. Late starts and restarts do not replay old entry candles. Both open-time and close-time candle labels are normalized from the opening bar; the broker’s documented truncated `+05` timestamp is treated as IST.

WebSocket prices must have a positive finite value, a receipt within five seconds, and, when supplied, an exchange timestamp within five seconds (one second of future clock tolerance). Older updates cannot overwrite newer ticks or latch targets. The feed reconnects if any subscribed instrument stops delivering fresh ticks for more than twenty seconds, even when heartbeats continue. Reconnection repeats authentication and subscriptions; REST fallback remains available independently. REST LTP responses do not supply an exchange timestamp, so their freshness measures successful receipt rather than independently proving exchange age.

WebSocket authentication follows the official SDK's query format: access token first, with literal base64 `+`, `/`, `@` and `=` symbols in the API key. Other query delimiters remain escaped. In a live comparison, encoding those API-key symbols with `URLSearchParams` returned HTTP 502, while the SDK format accepted the upgrade. NSE packet timestamps use seconds from the 1980 epoch in IST; interpreting them as Unix timestamps incorrectly discarded fresh option ticks. The parser now normalizes that format before checking freshness.

Temporary position-read failures pause orders and retry after five seconds while preserving the session, target intent and square-off state. Confirmed quantity mismatches still block execution or pause entries for reconciliation. Simultaneous monitoring requests share one pump instead of building a queue of duplicate cycles. Unchanged sessions do not trigger SQLite commits on every market tick; changes to orders, fills, targets and session state remain synchronously durable. After a candle-history delay, an open position retains the earliest missed lower-close exit even if a later candle recovered; flat legs use only the latest eligible close for entries.

Session state, pending orders and confirmed fills are durable. On restart, saved Live exposure is reconciled against the same broker account and flattened before another session can start. A current-day running Paper session with locked references and no pending order resumes its saved positions before cutoff; earlier entry signals are not replayed. External/manual position changes pause new entries and mark P&L unverified. Paper and Live histories are stored separately, including when switching modes after flattening on the same day. Previous sessions remain in SQLite.

The exchange can reject or partially fill orders, and a network/broker outage can delay an exit. Software tests cannot establish a guaranteed market fill or trading result. No live money order has been used as part of development verification.

## Checks

```powershell
npm test
npm run build
npm run doctor
```

`doctor` is a **read-only** check after broker connection: account authentication, funds, position and order-book reads, official ATM contracts, both opening references, and WebSocket ticks for spot/CE/PE. If WebSocket verification fails, it checks the official REST fallback and explicitly reports the unavailable stream. It never imports the order controller or places orders.

In the app, open **mStock connected → Run read-only account checks**. The report distinguishes authentication, funds, positions, order-book reads, REST quotes, stream ticks and login trading capabilities. It displays the returned balance by segment, open broker positions, and all broker order records returned by the endpoint, including rejected and pending orders. Successful empty broker responses (`net: null` for positions and `data: null` for orders) are accepted as empty lists; missing or malformed position fields still block verification. The ten-second diagnostic cache is account/session scoped. Reports never include passwords, API keys, tokens or unfiltered broker errors.

**Testing execution:** Paper mode uses real prices but simulated fills and cannot prove that live order placement works. A live broker order ID confirms acknowledgement; only a terminal execution response with actual filled quantity and average price confirms a fill. Compare these with the mStock order book. The default configuration buys **three lots per qualifying leg**, with CE and PE independent; Live mode is not a one-unit test-order facility. Read-only diagnostics never place, cancel or modify an order. When the login explicitly advertises permissions, Live start requires NFO, MIS and MARKET access; missing metadata is reported as untested rather than assumed verified.

Use **mStock connected → Refresh login metadata** to capture capabilities from a fresh OTP/TOTP response without logging out first. The strategy must be stopped and flat. Complete the login yourself, then rerun the read-only checks. An older saved token does not contain enough information to reconstruct missing permissions. If the broker omits those fields again, the status stays untested. Execution verification can pass without placing a new test order when a current-day live engine fill matches the same account's broker order ID, symbol, side, terminal status, filled quantity and average price. Paper trades, manual orders, acknowledgements and mismatches do not pass that check.

Tests use a separate in-memory simulated broker. They cover actual-fill accounting, partial fills, duplicate candles, rejected and unknown orders, Stop/cutoff races, recovery, session encryption and HTTP request protection. The app never displays that test data.

## Market screen

The main screen has a five-minute candlestick chart with **NIFTY 50 / CALL / PUT** tabs. It shows the latest price, change from the broker's previous close, candle OHLC, crosshair, zoom and fit controls. Option charts overlay the locked reference, breakout, lower exit, actual fill and target prices. Trade arrows represent recorded fills; Paper markers are explicitly labeled.

The chart displays the current **forming** candle only when the broker supplies its OHLC. The strategy continues to evaluate **completed** candles exclusively. Chart data cannot generate signals or orders. The NIFTY chart works after broker connection, before starting a strategy. CALL/PUT can preview the official ATM pair after the 09:15–09:20 NIFTY reference completes, without starting a strategy. Preview selection uses that official opening close and does not change engine contracts. Once the strategy starts, charts use its locked pair. No premium or strike is guessed before reference data arrives.

The screen refreshes chart quotes every three seconds while visible and reuses current engine marks when newer and fresh. The server shares concurrent requests and caches chart quotes for two seconds and broker candles for fifteen seconds. A chart response waits up to 1.2 seconds for downloads, returning available quotes/candles with fetching indicators while slow reads finish in the background. Quote receipt time and age, history fetch time, bar count, coverage, lot size and expiry are shown separately. REST receipt freshness does not establish the exchange age of its last traded price. Cache keys include broker account, exchange token and IST date. Failed refreshes retain original timestamps and show a delay message. Switching between Live market and Backtest preserves the market chart and viewport. Unchanged candles, levels and fill markers are not repeatedly redrawn. TradingView Lightweight Charts is bundled locally, with attribution; chart market data comes from mStock.

Dashboard polling and event-stream updates share freshness tracking. A failed poll does not label a still-updating stream offline, and older HTTP snapshots cannot replace newer engine state. Control requests are guarded against double submission; after a timeout the app refreshes engine state and reports that the outcome is unconfirmed. Pending order details show leg, side, units, reason, submission time and broker ID or reconciliation tag.

The layout puts the chart beside the session controls, with compact positions, trade history and collapsed activity below. It uses solid surfaces, neutral borders, muted colors, and responsive stacking on smaller screens.

## Backtest

The old replay engine, preparation service, strategy-readiness API and multi-stage screen have been removed. Backtesting now uses a standalone deterministic engine (`nifty-009-ohlc-v2`), one background job and a compact date → run → results screen. Live strategy execution is separate. Original archives remain available; old engine reports are not restored into the rebuilt screen.

Choose **Today**, **Past 2 months**, or custom dates (up to 93 calendar days), then **Run backtest**. The same job loads available broker history, validates the original option datasets and replays usable sessions. Complete saved sessions run offline. Missing and incomplete past sessions are excluded with their precise reason. If no usable sessions exist, the status is **Needs data**, with no performance cards. A current-day partial replay keeps open positions marked at the last common completed candle and is labeled partial.

### Execution model

The engine implements NIFTY 009 independently of the live controller: the original opening option CLOSE defines fixed ±0.09% levels, CALL and PUT run independently, entries buy three historical lots, +20 closes one lot and +40 closes the remainder. Lower-close exits and later re-entries use the same fixed reference levels.

- Entry and lower-close signals execute at the **next candle open**, with adverse slippage. The signal candle's earlier high cannot profit a new position. This follows the ordinary market-order convention described in [Backtrader's execution documentation](https://www.backtrader.com/docu/order-creation-execution/order-creation-execution/).
- Targets use the observed open for a gap or a target-price proxy for an intrabar touch, with adverse slippage. The latter is labeled `intrabar-unknown`. OHLC data cannot establish exact intrabar timing, as described by [TradingView's broker emulator documentation](https://www.tradingview.com/pine-script-docs/concepts/strategies/). No paid product or subscription is required by this implementation.
- **15:10 square-off uses the actual 15:10 candle open**, without looking at that candle's subsequent high/low/close. A normal completed-candle download must therefore include the 15:10–15:15 bar (at least 72 bars from 09:15). A series ending at the 15:05–15:10 close is partial. No close proxy replaces a missing cutoff open.
- Every simulated order fills fully. Costs are configurable points of adverse slippage and a fixed rupee estimate per order. Zero costs exclude brokerage and taxes. Spread, liquidity, margin, latency and partial fills are not reproduced. Drawdown uses synchronized five-minute portfolio marks.

Results show tested session coverage, net marked P&L, costs, open/closed cycles, win rate and drawdown. **Export fills** includes the execution-timing label. Each tested session exports its pinned original dataset. Unchanged status responses retain the same chart data objects to avoid redraws on every poll.

### Historical data and imports

**Costs & data import** contains cost controls, **Import option data** and the JSON schema. A version-1 dataset contains `date`, actual `spotReferenceClose`, `contracts.CE` / `contracts.PE` with original token, symbol, side, strike, expiry and lot size, and `candles.CE` / `candles.PE`. Candles are uninterrupted completed five-minute OHLC bars with UTC epoch-millisecond `start` / `end`, beginning 09:15 IST. CALL and PUT must have the same ATM strike, expiry and lot size and distinct symbols/tokens. Imports are structurally validated; historical ATM identity is user-supplied. A complete broker archive cannot be overwritten by an import; a partial archive may be repaired with a valid original dataset.

**Historical downloads & original contract imports** retains raw NIFTY downloads, option downloads when original contract metadata exists, per-date JSON exports, and **Download all JSON**. The original master from that date, saved session contracts or user-imported metadata can identify past contracts. Today's chain never substitutes for expired original contracts. A free NIFTY spot archive is insufficient to backtest this option-premium strategy. Download errors do not generate missing prices.

The historical downloader skips weekends and verified 2026 NSE holidays from the [official NSE F&O calendar](https://nsearchives.nseindia.com/content/circulars/FAOP71777.pdf). Other years require calendar maintenance and remain subject to broker data availability. Completed 75-bar NIFTY dates are reused on retries. Incomplete refreshes cannot replace complete option archives.

The latest ten rebuilt jobs and their pinned datasets use the `backtest:v2:*` SQLite namespace. Old reports are ignored; raw `backtest:archive:*` datasets remain. A server restart marks an interrupted run failed; saved candles remain available for a new run. No automatic retry can place an order because backtesting has no placement or cancellation interface.

API: `GET /api/backtest/dates`, `/latest`, `/schema`, `/jobs/:id`, `/jobs/:id/data/:date`, `/jobs/:id/trades.csv`, `/archive/:date`; `POST /api/backtest/import` and `/run`. Data download API: `POST /api/history/fetch`, `GET /api/history/latest`, `/jobs/:id`, `/jobs/:id/data`, `/spot/:date`, `POST /api/history/contracts`, and `GET /api/history/contracts/schema`. POSTs require same-origin CSRF; credentials remain on the backend.
## Money, audit and adjustable rules

Open **Money, audit & settings** for recorded buy premiums, sell proceeds, open premium cost, realized and fresh-price marked P&L. Paper totals are simulated and debit no broker cash. Real broker available/utilized funds, positions, validations and order book are displayed separately with their check time. Utilized margin and premium cash flow are not brokerage fees or a bank debit. The current endpoints do not verify contract-note charges, taxes or ledger debits; actual charges and actual net after charges remain unavailable. The optional charge estimate is explicitly labelled and never substitutes for a broker ledger.

The order lifecycle retains submission intent, acknowledgement, uncertainty, cancellation request and terminal result, including broker order ID, exact tag, quantities, fill price and sanitized rejection reason. Newly evaluated candles retain OHLC, signal and explanation. Older records show their missing trail explicitly. The session assistant explains these records with deterministic rules; it does not predict trades or change settings automatically. **Download full audit JSON** exports these records without login secrets or CSRF tokens. Previous session snapshots remain in SQLite.

Editable settings include breakout/lower-exit percentages, entry lots, first-target lots (0 skips T1), both premium-point targets, cutoff, enabled entry legs, entry count limit and estimated costs. Saving persists a profile for a **new session and new backtests**. Running sessions keep their original rule snapshot; changing saved settings never silently changes an open trade. A changed profile starts a new session only when the old one is flat and the user presses Start. The five-minute timeframe, opening reference, NIFTY ATM selection, MIS and MARKET execution remain fixed and are labelled accordingly. This implementation supports the 009 strategy, not arbitrary strategy code.

Read-only APIs: `GET /api/strategy/settings`, `/api/audit`, `/api/audit/export`. `POST /api/strategy/settings` validates and saves preferences under the same-origin CSRF guard; it does not place orders. Backtests pin their selected strategy settings into each job alongside separate slippage and fee assumptions.

## Source layout


`src/App.tsx` composes the screen. `src/components/` contains the market chart, session controls, broker and rules dialogs, leg cards, and trade list. `src/hooks/useDashboard.ts` owns engine updates and actions; `useMarketChart.ts` owns cancellable chart requests and polling. `src/lib/` holds presentation formatting, IST chart conversion and fill-marker mapping.

`shared/model.ts` defines shared types and fixed strategy parameters. `server/strategy.ts` contains deterministic trading rules; `broker.ts` implements Type A HTTP endpoints; `feed.ts` handles authenticated binary market data; `controller.ts` coordinates orders; `store.ts` persists state. `http.ts` exposes the local same-origin API. `server/charts.ts` is a separate read-only market-data service and cache, with no order operations. `GET /api/market/chart?symbol=NIFTY` (or `CE`/`PE`) returns its chart data.

`shared/backtest.ts` defines replay data and reports. `server/backtest/validation.ts` validates original contract datasets, `replay.ts` simulates fills and accounting, `service.ts` handles archives and jobs, and `schema.ts` defines the import format. `BacktestPanel.tsx` composes controls and results; `BacktestEquity.tsx` renders the curve. The local API provides `/api/backtest/dates`, `/schema`, `/import`, `/run`, `/jobs/:id`, `/jobs/:id/trades.csv`, `/jobs/:id/data/:date`, and `/archive/:date`. Mutating requests require the existing same-origin CSRF protection.

`data/` contains the encrypted session, encryption key, SQLite journal and process lock. It is ignored by Git. Preserve the entire directory when moving an installation with a saved session. Run one engine per data directory. `PORT` and `N009_DATA_DIR` can override the default backend port and data location. Advanced deployments may explicitly set `MSTOCK_CANDLE_LABEL=open` or `close`; the default is `auto`.

## Official sources used

- [mStock Type A introduction, limits and token validity](https://tradingapi.mstock.com/docs/v1/Introduction/)
- [Login, OTP, TOTP and fund-summary verification](https://tradingapi.mstock.com/docs/v1/typeA/User/)
- [Instrument master and market quotes](https://tradingapi.mstock.com/docs/v1/typeA/market-quote-and-instrument/)
- [Historical candles](https://tradingapi.mstock.com/docs/v1/typeA/historical-candle/) and [current-day intraday candles](https://tradingapi.mstock.com/docs/v1/typeA/intraday-chart-data/)
- [Authenticated market-data WebSocket and packet format](https://tradingapi.mstock.com/docs/v1/typeA/market-data/)
- [Orders and execution details](https://tradingapi.mstock.com/docs/v1/typeA/Orders/) and [broker positions](https://tradingapi.mstock.com/docs/v1/typeA/Position/)
- [Official mStock Node SDK](https://github.com/MiraeAsset-mStock/nodetradingapi-typeA): inspected the published 1.0.1 package to resolve protocol details. The current SDK uses **POST** for `/order/details`, with `order_no` and derivative segment `D`, although the prose documentation still illustrates GET. Binary packet fields use network byte order. The implementation sends `LOGIN:<access_token>` before subscriptions on every WebSocket connection.
- [React’s Vite + TypeScript setup](https://react.dev/learn/build-a-react-app-from-scratch) and [Vite’s official guide](https://vite.dev/guide/).
- [TradingView Lightweight Charts documentation](https://tradingview.github.io/lightweight-charts/docs), [price lines](https://tradingview.github.io/lightweight-charts/tutorials/how_to/price-line), [series markers](https://tradingview.github.io/lightweight-charts/docs/api/functions/createSeriesMarkers), and [time zones](https://tradingview.github.io/lightweight-charts/docs/time-zones).

The confirmed PDF specification governs the strategy; broker documentation governs authentication, market data and execution. Broker documentation does not validate strategy profitability.
