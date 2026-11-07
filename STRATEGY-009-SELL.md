# 009 Breakout – Sell

The reverse of 009 Breakout – Buy. On first creation it copies the current Buy preferences; subsequent settings and saved day-sessions are independent. Select the strategy before opening its settings, backtest or starting it. Only one strategy can run per account/workspace at a time; Stop and flatten before switching.

- Lock the original 09:15–09:20 option close and original ATM CE/PE contracts for the full day.
- Entry: when flat, a new completed five-minute close at or below reference × (1 − breakout percent / 100) enters SELL short. Default breakout: 0.09%; default entry: 4 lots per enabled leg. First possible signal: 09:25 IST.
- T1: BUY back 2 lots after premium falls 20 points below the actual SELL fill. T2: BUY back the remaining 2 after a 40-point fall. Price/Time settings, manual lot splits and minute targets remain available. Both minute targets count from the original entry timestamp.
- Protective candle exit: a completed five-minute close strictly above reference × (1 + exit percent / 100) triggers BUY to cover all remaining units. Default: +0.09%.
- Immediate stop: fresh option price at or above the original reference close +25 points triggers BUY to cover. The stop is reference-based, never entry-based, and stays fixed after targets/re-entry. 0 disables this additional stop.
- Re-entry: after full exit, require a completed close strictly above the original lower SELL breakout, then a later completed close strictly below that same level. Remaining below the level does not repeat entry.
- Cutoff: 15:10 IST by default. No new entries; BUY back remaining strategy shorts. Explicit Stop uses the same cover flow.

Broker positions for Sell are negative; internal remaining quantities are positive magnitudes. Confirmed fills, partial quantities, signed P&L, restart state and order reconciliation follow the selected strategy snapshot. SELL entry does not book realized profit; profit/loss is realized by confirmed BUY covers. Paper fills simulate execution. Live orders require broker permissions and sufficient short-option margin; received premium is not a margin estimate. No real execution is implied by a backtest or read-only connection check.

Backtests use observed opens for gaps and time deadlines, conservative stop-first intrabar proxies, and adverse transaction-direction slippage. Buy/Sell are labelled in reports. Missing original option candles remain excluded.
