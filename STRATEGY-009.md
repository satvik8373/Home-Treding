# NIFTY 009 — Strategy Logic

- **Reference:** 09:15–09:20 IST NIFTY CLOSE se nearest ATM aur nearest valid expiry ka CE/PE pair select karke session ke liye lock karo.
- **Levels:** Har option ke apne opening candle CLOSE se `Upper = CLOSE × 1.0009`, `Lower = CLOSE × 0.9991`; dono 2 decimals tak round karo (**±0.09%**).
- **Entry:** Leg flat ho aur new completed 5-minute candle CLOSE **>= Upper** ho to **4 lots BUY**. First possible signal **09:25 IST**.
- **Target 1:** Actual entry average **+₹20 premium points** par **2 lots SELL**.
- **Target 2:** Actual entry average **+₹40 premium points** par **remaining 2 lots SELL**.
- **Exit:** Completed 5-minute candle CLOSE **< Lower** ho to remaining quantity exit karo.
- **Additional immediate stop:** Actual BUY average se **25 premium points neeche** fresh price aate hi remaining quantity MARKET exit karo; candle close ka wait nahi. Example: entry ₹200 → stop trigger ₹175. Target 1 ke baad bhi stop original entry average se hi rahega. Existing lower-close rule bhi active rahega. Gap, slippage, stale feed ya broker latency se actual fill trigger price se alag ho sakta hai. Settings mein points adjust karo; 0 is additional stop ko disable karta hai.
- **Re-entry:** Full exit ke baad pehle ek completed 5-minute candle ka CLOSE original Upper ke strictly neeche ho. Uske baad kisi later completed candle ka CLOSE usi Upper ke strictly upar ho tab 4 lots BUY. Sirf upper ke upar bane rehne par dobara buy nahi. Opening reference aur levels poore din fixed rahenge. Partial target exit reset nahi karta.
- **Cutoff:** **15:10 IST** par new entries stop aur dono legs square off karo.

CE/PE independently run karenge; dono open ho sakte hain. Entry/Lower exit completed candle CLOSE par, targets fresh live prices par evaluate honge. Actual broker lot size aur confirmed fills use karo; duplicate orders mat bhejo.
