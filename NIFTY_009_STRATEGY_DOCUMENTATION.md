# NIFTY 0.09% ATM Full-Day Breakout Strategy
## Official System Specification & Production Documentation

---

### Document Control

| Attribute | Details |
| :--- | :--- |
| **Strategy ID** | `nifty-009-atm-breakout` |
| **Author / Trader ID** | AR427232 / Satvik Patel |
| **Version** | 3.0.0 (Production Live Ready) |
| **Execution Platform** | Home-Treding Automation Engine |
| **Broker Integration** | DhanHQ v2 REST & WebSocket Data APIs |
| **Exchange Segment** | NSE Indices (Spot) $\to$ NSE F&O (Options) |
| **Date of Verification** | September 20, 2026 |

---

## 1. Strategy Overview & Philosophy

The **NIFTY 0.09% ATM Full-Day Breakout Strategy** is a quantitative, systematic breakout trading system designed for **NIFTY 50 Index Options**.

The system establishes daily dynamic support and resistance boundary bands based on a $+0.09\%$ and $-0.09\%$ expansion from the **close price of the first 5-minute candle** of the trading session (09:15 to 09:20 IST).

Simultaneously, the system locks the nearest **At-The-Money (ATM)** Strike at 09:20 IST and resolves both Call (CE) and Put (PE) option contracts for the current weekly expiry via Dhan's live option chain.

For the remainder of the session (09:20 to 15:10 IST), the strategy evaluates 5-minute candle closes against these fixed boundary levels:
- An **Upper Breakout** triggers a **BUY Market Order on the ATM CE**.
- A **Lower Breakout** triggers a **BUY Market Order on the ATM PE**.
- Holding positions are exited on **symmetric level reversals** or forced closed at **15:10 IST**.

---

## 2. Mathematical Model & Boundary Calculation

### Step 1: Reference Candle Capture
At exactly **09:20:00 IST**, the first 5-minute candle closes. The close price is extracted:
$$\text{Reference Close } (X) = \text{Close}_{\text{09:15--09:20}}$$

### Step 2: Upper Breakout Band (+0.09%)
$$\text{Upper Level} = X \times \left(1 + \frac{0.09}{100}\right) = X \times 1.0009$$

### Step 3: Lower Breakout Band (-0.09%)
$$\text{Lower Level} = X \times \left(1 - \frac{0.09}{100}\right) = X \times 0.9991$$

### Step 4: Fixed Level Invariance
Once calculated at 09:20 IST:
- The values of **Upper Level** and **Lower Level** are immutable for the rest of the trading day.
- They are not influenced by intrabar highs, lows, or subsequent candle closes.

---

## 3. At-The-Money (ATM) Selection & Contract Resolution

At **09:20:00 IST**:

1. **Strike Calculation**:
   $$\text{Locked Strike} = \text{round}\left(\frac{X}{50}\right) \times 50$$

2. **Dhan Option Chain Resolution**:
   The engine queries DhanHQ v2 API (`/v2/optionchain`):
   - Underlyer: `NIFTY` (`securityId: 13`)
   - Expiry: Nearest Weekly Expiry Date
   - Matches `strikePrice == Locked Strike`
   - Extracts exact Dhan `securityId`, `symbol`, and `tradingSymbol` for:
     - **ATM CE** (e.g. `NIFTY 24-SEP-2026 24850 CE`)
     - **ATM PE** (e.g. `NIFTY 24-SEP-2026 24850 PE`)

3. **Invariance**:
   The locked CE and PE contracts remain fixed for the rest of the session, regardless of where NIFTY Spot wanders later in the day.

---

## 4. Operational Trading Rules

### 4.1. Entry Rules (Strict 5-Minute Candle Close)

Trade signals are generated **only when a 5-minute candle closes** (09:25, 09:30, 09:35, ..., 15:05, 15:10 IST). Intrabar spikes and wicks are ignored.

| Signal | Trigger Condition | Pre-requisite State | Dispatched Action |
| :--- | :--- | :--- | :--- |
| **BUY_CE** | 5-min Close $>$ Upper Level | Flat (No open position) | Dispatch **BUY Market Order** for ATM CE |
| **BUY_PE** | 5-min Close $<$ Lower Level | Flat (No open position) | Dispatch **BUY Market Order** for ATM PE |

### 4.2. Exit Rules (Symmetric Level Reversal)

| Exit Event | Condition | Active Position | Dispatched Action |
| :--- | :--- | :--- | :--- |
| **EXIT_CE** | 5-min Close $<$ Lower Level | Holding ATM CE | Dispatch **SELL Market Order** to exit CE |
| **EXIT_PE** | 5-min Close $>$ Upper Level | Holding ATM PE | Dispatch **SELL Market Order** to exit PE |

### 4.3. Symmetric Reversal Flip

If a level breach occurs that signals an opposite entry:
1. The existing active position is exited first via Market Order.
2. Immediately upon fill confirmation, the opposite contract is entered via Market Order.
3. The state transitions from `CE_ACTIVE` $\to$ `PE_ACTIVE` (or vice versa).

### 4.4. Single Active Position Constraint
- Under no circumstance does the strategy hold both CE and PE simultaneously.
- Maximum active positions at any timestamp $= 1$.

### 4.5. Re-Entries
- Re-entries are fully permitted throughout the day.
- If an exit occurs and subsequent candles re-cross the breakout thresholds before 15:10, new entries are executed according to the standard rules.

---

## 5. Daily Execution Timeline (IST)

```
09:15 ────────────────► Market Opens (NIFTY 50 live feed active)
  │
  ▼
09:20 ────────────────► 1st 5-Min Candle Closes (Close = X)
  │                     • Calculate Upper Level = X * 1.0009
  │                     • Calculate Lower Level = X * 0.9991
  │                     • Lock ATM Strike = round(X / 50) * 50
  │                     • Query Dhan Option Chain & Lock CE / PE Security IDs
  │
  ▼
09:20 - 15:10 ────────► Active Trading & Breakout Monitoring Window
  │                     • On each 5-min candle close:
  │                       - If Close > Upper => BUY CE (or exit PE)
  │                       - If Close < Lower => BUY PE (or exit CE)
  │
  ▼
15:10 ────────────────► Force Square-Off & EOD Cutoff
  │                     • If any position is open, dispatch SELL Market Order
  │                     • Halt all strategy activity for the day
  │                     • Generate daily performance report
  │
  ▼
15:30 ────────────────► Market Closes
```

---

## 6. Numerical Demonstration Example

Assume on Date **2026-09-20**:
- **09:15–09:20 First 5-Minute Candle**:
  - Open: $24,810.00$
  - High: $24,865.00$
  - Low: $24,805.00$
  - **Close ($X$)**: $\mathbf{24,850.00}$

### Calculated Parameters:
- **Upper Level**: $24,850.00 \times 1.0009 = \mathbf{24,872.365}$
- **Lower Level**: $24,850.00 \times 0.9991 = \mathbf{24,827.635}$
- **Locked ATM Strike**: $\mathbf{24,850}$
- **CE Contract**: `NIFTY 24-SEP-2026 24850 CE`
- **PE Contract**: `NIFTY 24-SEP-2026 24850 PE`

### Simulated Intraday Events:
1. **09:25 Candle Close: $24,860.00$**
   - Between $24,827.635$ and $24,872.365 \implies$ **No Action (WAIT)**.
2. **09:35 Candle Close: $24,882.00$**
   - $24,882.00 > 24,872.365 \implies$ **BUY 75 Qty 24850 CE** at LTP ₹142.50.
3. **11:20 Candle Close: $24,818.00$**
   - $24,818.00 < 24,827.635 \implies$ **EXIT 24850 CE** at LTP ₹98.00 (Loss ₹44.50/pt).
   - Simultaneously $\implies$ **BUY 75 Qty 24850 PE** at LTP ₹135.00.
4. **15:10 EOD Cutoff**:
   - Candle Close: $24,760.00$.
   - **Force Square-Off PE** at LTP ₹178.00 (Profit ₹43.00/pt).

---

## 7. Risk Management & Guardrails

| Guardrail | Implementation |
| :--- | :--- |
| **Max Daily Loss** | Configurable (Default: ₹2,500). Strategy halts if cumulative session loss reaches limit. |
| **Max Position Size** | Safe lot normalization ($75 \times \text{Multiplier}$). Prevents unintended over-allocation. |
| **Kill Switch** | Integrated with server-wide Emergency Kill Switch (`/api/risk/kill-switch`). |
| **Exchange Order Type** | `MIS` (Intraday Margin) with `MARKET` execution to guarantee immediate fills. |
| **No Overnight Risk** | Strict 15:10 IST force square-off eliminates overnight gap risk. |

---

## 8. Source Code Architecture

| Component | File Path | Core Role |
| :--- | :--- | :--- |
| **Engine Core** | `backend/src/strategies/nifty009/Nifty009Engine.ts` | Orchestrates feed subscriptions, state changes, order dispatch, and 15:10 timers |
| **State Machine** | `backend/src/strategies/nifty009/StrategyStateMachine.ts` | Pure mathematical logic, level calculation, and signal emission |
| **ATM Strike Resolver** | `backend/src/strategies/nifty009/AtmResolver.ts` | Resolves live option chain weekly ATM contracts |
| **Data Definition** | `backend/data/strategies.json` | Stores official strategy configuration and legs |
| **Backtesting Engine** | `backend/src/backtest/BacktestEngine.ts` | Runs historical backtests for 5D, 1W, 1M, 1Y with Dhan historical data |

---

*Verified and Certified for Live Real-Money Production Deployment.*
