# 009 Breakout – Buy — Strategy Logic

- **Reference:** 09:15–09:20 IST NIFTY CLOSE se nearest ATM aur nearest valid expiry ka CE/PE pair select karke session ke liye lock karo.
- **Day continuity:** Har account aur Paper/Live mode ka ek saved day-session rahega. Same day engine restart, Stop/Start ya settings save karne par session ID, opening reference, contracts, trade history, entry count aur reset state fresh nahi honge. Settings changes next trading day par apply honge. Process shutdown sirf durable checkpoint karta hai; explicit “Stop & square off” positions close karta hai. Valid broker login aur quantity checks ke baad interrupted running session resume hota hai; unknown orders reconcile hone tak fresh order nahi bheja jata. Stopped session apne aap start nahi hota.
- **Levels:** Har option ke apne opening candle CLOSE se `Upper = CLOSE × 1.0009`, `Lower = CLOSE × 0.9991`; dono 2 decimals tak round karo (**±0.09%**).
- **Entry:** Leg flat ho aur new completed 5-minute candle CLOSE **>= Upper** ho to **4 lots BUY**. First possible signal **09:25 IST**.
- **Target 1:** Actual entry average **+₹20 premium points** par **2 lots SELL**.
- **Target 2:** Actual entry average **+₹40 premium points** par **remaining 2 lots SELL**.
- **Exit:** Completed 5-minute candle CLOSE **< Lower** ho to remaining quantity exit karo.
- **Additional immediate stop:** Fixed 09:15–09:20 option reference CLOSE se **25 premium points neeche** fresh price aate hi remaining quantity MARKET exit karo; candle close ka wait nahi. Example: reference ₹163.55 → stop trigger ₹138.55, chahe actual entry ₹174.70 ya ₹233.80 ho. Targets aur re-entry ke baad bhi stop isi original reference se fixed rahega. Existing lower-close rule bhi active rahega. Gap, slippage, stale feed ya broker latency se actual fill trigger price se alag ho sakta hai. Settings mein points adjust karo; 0 is additional stop ko disable karta hai.
- **Re-entry:** Full exit ke baad pehle ek completed 5-minute candle ka CLOSE original Upper ke strictly neeche ho. Uske baad kisi later completed candle ka CLOSE usi Upper ke strictly upar ho tab 4 lots BUY. Sirf upper ke upar bane rehne par dobara buy nahi. Opening reference aur levels poore din fixed rahenge. Partial target exit reset nahi karta.
- **Cutoff:** **15:10 IST** par new entries stop aur dono legs square off karo.

CE/PE independently run karenge; dono open ho sakte hain. Entry/Lower exit completed candle CLOSE par, targets fresh live prices par evaluate honge. Actual broker lot size aur confirmed fills use karo; duplicate orders mat bhejo.

## Selectable target rules

Default T1/T2 remain entry +20/+40 premium points, selling 2+2 of the 4 bought lots. Settings show only two target choices: **Price** (premium points above actual entry) and **Time** (an explicit IST clock time, such as 10:30). Clock targets must be before square-off; T2 must be later than T1 when both use time. Previously saved minute-duration and advanced rule snapshots are still interpreted as saved. The editor shows a legacy duration and asks for an explicit clock time rather than inventing a conversion. T1 sells its configured lots (0 skips T1); T2 sells all remaining units after T1 completes. Mixed types are supported; T2 never bypasses a pending T1. For matching types, T2 must be above/later than T1.

Time exits are scheduled exits regardless of profit or loss. Both minute deadlines count from the original confirmed entry timestamp, including after partial exits and process recovery. A clock deadline already passed becomes due after entry. Fresh market data is still required; broker confirmation, latency and outages can delay execution. The reference stop, completed-candle lower exit, explicit Stop and square-off remain active. Changes apply next trading day, while new backtests use saved preferences.

OHLC backtests execute time targets at the first available five-minute candle open at/after the deadline (timing `scheduled-open`), not an invented exact-minute price. Intrabar price targets remain proxies. Reports and chart levels follow the selected target type; time rules do not draw fake horizontal price targets.

The current long strategy is named **009 Breakout – Buy**. Its reverse short strategy is documented in [STRATEGY-009-SELL.md](STRATEGY-009-SELL.md). They have independent settings/day-session archives and share one active execution slot per account/workspace.
