# NIFTY 009 — Strategy Logic

- **Reference:** 09:15–09:20 IST NIFTY CLOSE se nearest ATM aur nearest valid expiry ka CE/PE pair select karke session ke liye lock karo.
- **Levels:** Har option ke apne opening candle CLOSE se `Upper = CLOSE × 1.0009`, `Lower = CLOSE × 0.9991`; dono 2 decimals tak round karo (**±0.09%**).
- **Entry:** Leg flat ho aur new completed 5-minute candle CLOSE **>= Upper** ho to **3 lots BUY**. First possible signal **09:25 IST**.
- **Target 1:** Actual entry average **+₹20 premium points** par **1 lot SELL**.
- **Target 2:** Actual entry average **+₹40 premium points** par **remaining quantity SELL**.
- **Exit:** Completed 5-minute candle CLOSE **< Lower** ho to remaining quantity exit karo.
- **Re-entry:** Full exit ke baad pehle ek completed 5-minute candle ka CLOSE original Upper ke strictly neeche ho. Uske baad kisi later completed candle ka CLOSE usi Upper ke strictly upar ho tab 3 lots BUY. Sirf upper ke upar bane rehne par dobara buy nahi. Opening reference aur levels poore din fixed rahenge. Partial target exit reset nahi karta.
- **Cutoff:** **15:10 IST** par new entries stop aur dono legs square off karo.

CE/PE independently run karenge; dono open ho sakte hain. Entry/Lower exit completed candle CLOSE par, targets fresh live prices par evaluate honge. Actual broker lot size aur confirmed fills use karo; duplicate orders mat bhejo.
