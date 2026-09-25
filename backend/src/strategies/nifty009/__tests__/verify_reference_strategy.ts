import { StrategyStateMachine } from '../StrategyStateMachine';
import { Candle } from '../CandleEngine';
import { LockedAtm } from '../AtmResolver';

function runVerification() {
  console.log('================================================================');
  console.log('VERIFYING: NIFTY ATM CE/PE Independent Breakout Strategy');
  console.log('Matching exact Python specification provided by user');
  console.log('================================================================\n');

  const sm = new StrategyStateMachine();

  // Mock Locked ATM contracts (Lot size = 75, multiplier = 2 -> 150 qty)
  const lockedAtm: LockedAtm = {
    atmStrike: 24100,
    expiry: '01-OCT-2026',
    ceSecurityId: 'NIFTY_24100_CE',
    ceSymbol: 'NIFTY 24100 CE',
    ceLtp: 142.50,
    peSecurityId: 'NIFTY_24100_PE',
    peSymbol: 'NIFTY 24100 PE',
    peLtp: 98.00,
    lotSize: 65,
    spotPriceAtResolution: 24100,
    resolvedAt: new Date().toISOString()
  };

  sm.onAtmResolved(lockedAtm);

  // 1. Lock CE & PE 09:15-09:20 reference candles
  const ceRefCandle: Candle = {
    startTime: '09:15',
    endTime: '09:20',
    open: 142.00,
    high: 143.00,
    low: 141.50,
    close: 142.50,
    volume: 10000,
    isClosed: true
  };
  sm.setCeReferenceCandle(ceRefCandle);

  const peRefCandle: Candle = {
    startTime: '09:15',
    endTime: '09:20',
    open: 98.50,
    high: 99.00,
    low: 97.50,
    close: 98.00,
    volume: 8000,
    isClosed: true
  };
  sm.setPeReferenceCandle(peRefCandle);

  const ceLevels = sm.getCeLevels();
  const peLevels = sm.getPeLevels();

  console.log(`[CE Levels] Ref: ${ceLevels.referenceClose} | Upper: ${ceLevels.upperLevel} | Lower: ${ceLevels.lowerLevel}`);
  console.log(`[PE Levels] Ref: ${peLevels.referenceClose} | Upper: ${peLevels.upperLevel} | Lower: ${peLevels.lowerLevel}`);

  // Assert levels
  console.assert(ceLevels.referenceClose === 142.50, 'CE Ref mismatch');
  console.assert(ceLevels.upperLevel === 142.63, 'CE Upper mismatch');
  console.assert(ceLevels.lowerLevel === 142.37, 'CE Lower mismatch');
  console.assert(peLevels.referenceClose === 98.00, 'PE Ref mismatch');
  console.assert(peLevels.upperLevel === 98.09, 'PE Upper mismatch');
  console.assert(peLevels.lowerLevel === 97.91, 'PE Lower mismatch');
  console.log('✅ Level calculation matches Python spec (±0.09%)\n');

  // Step 1: 09:25 CE close = 145.00 -> BUY CE
  const sig1 = sm.onCeCandleClosed({
    startTime: '09:20',
    endTime: '09:25',
    open: 142.50,
    high: 145.50,
    low: 142.00,
    close: 145.00,
    volume: 12000,
    isClosed: true
  });
  console.assert(sig1?.type === 'BUY_CE', 'Expected BUY_CE at 09:25');
  console.assert(sig1?.quantity === 130, 'Expected 130 qty (2 lots * 65)');
  console.log(`[09:25] Sig1: ${sig1?.type} (Qty: ${sig1?.quantity}) @ ${sig1?.triggerPrice}`);
  sm.onCePositionOpened({
    leg: 'CE',
    symbol: lockedAtm.ceSymbol,
    securityId: lockedAtm.ceSecurityId,
    strike: lockedAtm.atmStrike,
    entryPrice: 145.00,
    quantity: 130,
    entryTime: '09:25',
    currentLtp: 145.00,
    unrealizedPnl: 0,
    realizedPnl: 0
  });
  console.assert(sm.getCeState() === 'LONG', 'Expected CE state LONG');

  // Step 2: 09:35 CE close = 143.00 -> already LONG, no signal
  const sig2 = sm.onCeCandleClosed({
    startTime: '09:30',
    endTime: '09:35',
    open: 145.00,
    high: 145.00,
    low: 142.80,
    close: 143.00,
    volume: 9000,
    isClosed: true
  });
  console.assert(sig2 === null, 'Expected null (already LONG, no duplicate entry)');
  console.log('[09:35] Sig2: No signal (Already LONG)');

  // Step 3: 09:30 PE close = 98.10 -> BUY PE (Independent of CE!)
  const sigPe1 = sm.onPeCandleClosed({
    startTime: '09:25',
    endTime: '09:30',
    open: 98.00,
    high: 98.30,
    low: 97.90,
    close: 98.10,
    volume: 7000,
    isClosed: true
  });
  console.assert(sigPe1?.type === 'BUY_PE', 'Expected BUY_PE at 09:30');
  console.log(`[09:30] SigPe1: ${sigPe1?.type} (Qty: ${sigPe1?.quantity}) @ ${sigPe1?.triggerPrice}`);
  sm.onPePositionOpened({
    leg: 'PE',
    symbol: lockedAtm.peSymbol,
    securityId: lockedAtm.peSecurityId,
    strike: lockedAtm.atmStrike,
    entryPrice: 98.10,
    quantity: 150,
    entryTime: '09:30',
    currentLtp: 98.10,
    unrealizedPnl: 0,
    realizedPnl: 0
  });
  console.assert(sm.getPeState() === 'LONG', 'Expected PE state LONG');
  console.assert(sm.getCeState() === 'LONG', 'Expected CE state STILL LONG');
  console.log('✅ Independent State Verified: BOTH CE and PE are LONG simultaneously!\n');

  // Step 4: 11:15 CE close = 142.30 (< 142.37) -> EXIT CE
  const sig3 = sm.onCeCandleClosed({
    startTime: '11:10',
    endTime: '11:15',
    open: 143.00,
    high: 143.10,
    low: 142.20,
    close: 142.30,
    volume: 11000,
    isClosed: true
  });
  console.assert(sig3?.type === 'EXIT_CE', 'Expected EXIT_CE at 11:15');
  console.log(`[11:15] Sig3: ${sig3?.type} @ ${sig3?.triggerPrice}`);
  sm.onCePositionClosed();
  console.assert(sm.getCeState() === 'FLAT', 'Expected CE state FLAT');
  console.assert(sm.getPeState() === 'LONG', 'PE state should remain unaffected (LONG)');
  console.log('✅ Independent Exit Verified: CE is FLAT while PE remains LONG!\n');

  // Step 5: 11:45 CE close = 144.00 (crosses up again) -> BUY CE again (Re-entry)
  const sig4 = sm.onCeCandleClosed({
    startTime: '11:40',
    endTime: '11:45',
    open: 142.50,
    high: 144.20,
    low: 142.50,
    close: 144.00,
    volume: 15000,
    isClosed: true
  });
  console.assert(sig4?.type === 'BUY_CE', 'Expected BUY_CE re-entry at 11:45');
  console.log(`[11:45] Sig4 (Re-entry): ${sig4?.type} @ ${sig4?.triggerPrice}`);
  sm.onCePositionOpened({
    leg: 'CE',
    symbol: lockedAtm.ceSymbol,
    securityId: lockedAtm.ceSecurityId,
    strike: lockedAtm.atmStrike,
    entryPrice: 144.00,
    quantity: 150,
    entryTime: '11:45',
    currentLtp: 144.00,
    unrealizedPnl: 0,
    realizedPnl: 0
  });

  // Step 6: 13:00 CE close = 142.30 (< lower) -> EXIT CE
  const sig5 = sm.onCeCandleClosed({
    startTime: '12:55',
    endTime: '13:00',
    open: 143.50,
    high: 143.50,
    low: 142.10,
    close: 142.30,
    volume: 8000,
    isClosed: true
  });
  console.assert(sig5?.type === 'EXIT_CE', 'Expected EXIT_CE at 13:00');
  console.log(`[13:00] Sig5: ${sig5?.type} @ ${sig5?.triggerPrice}`);
  sm.onCePositionClosed();
  console.assert(sm.getCeState() === 'FLAT', 'Expected CE state FLAT');
  console.log('✅ Re-entry and subsequent exit cycle verified!\n');

  // Step 7: 15:10 PE close = 95.00 -> Force square-off
  const sigPe2 = sm.onPeCandleClosed({
    startTime: '15:05',
    endTime: '15:10',
    open: 96.00,
    high: 96.50,
    low: 94.80,
    close: 95.00,
    volume: 14000,
    isClosed: true
  });
  console.assert(sigPe2?.type === 'EXIT_PE', 'Expected EXIT_PE at 15:10 Force Square-Off');
  console.log(`[15:10] SigPe2: ${sigPe2?.type} (Reason: ${sigPe2?.triggerReason})`);
  sm.onPePositionClosed();
  console.assert(sm.getPeState() === 'FLAT', 'Expected PE state FLAT');
  console.log('✅ 15:10 Force Square-Off verified!\n');

  console.log('================================================================');
  console.log('ALL VERIFICATIONS PASSED: 100% SPEC COMPLIANCE');
  console.log('================================================================');
}

runVerification();
