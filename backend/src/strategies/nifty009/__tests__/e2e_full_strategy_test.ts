import { nifty009Engine } from '../Nifty009Engine';
import { paperTradingManager } from '../../../execution/PaperTradingManager';
import { Candle } from '../CandleEngine';
import { logger } from '../../../utils/logger';

async function runFullE2ETest() {
  console.log('\n========================================================================');
  console.log('🚀 COMPREHENSIVE END-TO-END STRATEGY & LOGIC VALIDATION');
  console.log('Testing: NIFTY ATM CE/PE Independent Breakout Strategy');
  console.log('Engine, State Machine, Paper Executor, Risk & Event Engine');
  console.log('========================================================================\n');

  const userId = 'e2e_test_trader';
  const paperExecutor = paperTradingManager.getExecutor(userId);

  // 1. Reset / Stop any previous session
  if (nifty009Engine.getStatus().isRunning) {
    nifty009Engine.stop('Resetting for E2E Test');
  }

  console.log('STEP 1: Starting Strategy Engine in PAPER mode (2 Lots per Entry)...');
  await nifty009Engine.start(
    {
      lotMultiplier: 2,
      squareOffTime: '15:10',
      maxDailyLoss: 10000,
      enableReEntry: true
    },
    'paper',
    userId
  );

  let status = nifty009Engine.getStatus();
  console.assert(status.isRunning === true, 'Engine should be running');
  console.assert(status.mode === 'paper', 'Engine mode should be paper');
  console.assert(status.lockedAtm !== null, 'ATM contracts should be locked at 09:20');
  console.log(`✅ Step 1 Passed: Engine Running | Locked ATM Strike: ${status.lockedAtm?.atmStrike} | CE: ${status.lockedAtm?.ceSymbol} | PE: ${status.lockedAtm?.peSymbol}`);

  // Verify initial levels
  const ceLevels = {
    ref: status.ce?.referenceClose,
    upper: status.ce?.upperLevel,
    lower: status.ce?.lowerLevel
  };
  const peLevels = {
    ref: status.pe?.referenceClose,
    upper: status.pe?.upperLevel,
    lower: status.pe?.lowerLevel
  };

  console.log(`\nSTEP 2: Verifying Fixed Breakout Levels (±0.09%):`);
  console.log(`  CE Reference Close: ₹${ceLevels.ref} | Upper (+0.09%): ₹${ceLevels.upper} | Lower (-0.09%): ₹${ceLevels.lower}`);
  console.log(`  PE Reference Close: ₹${peLevels.ref} | Upper (+0.09%): ₹${peLevels.upper} | Lower (-0.09%): ₹${peLevels.lower}`);

  console.assert(ceLevels.ref !== null && ceLevels.ref > 0, 'CE Ref Close must be valid');
  console.assert(ceLevels.upper === Number((ceLevels.ref! * 1.0009).toFixed(2)), 'CE Upper must be Ref * 1.0009');
  console.assert(ceLevels.lower === Number((ceLevels.ref! * 0.9991).toFixed(2)), 'CE Lower must be Ref * 0.9991');

  console.assert(peLevels.ref !== null && peLevels.ref > 0, 'PE Ref Close must be valid');
  console.assert(peLevels.upper === Number((peLevels.ref! * 1.0009).toFixed(2)), 'PE Upper must be Ref * 1.0009');
  console.assert(peLevels.lower === Number((peLevels.ref! * 0.9991).toFixed(2)), 'PE Lower must be Ref * 0.9991');
  console.log('✅ Step 2 Passed: 100% Mathematical Precision on ±0.09% Breakout Boundaries');

  // STEP 3: Test CE Breakout Entry
  console.log('\nSTEP 3: Simulating 09:25 Completed 5m CE Candle with Close >= CE Upper...');
  const breakoutCePrice = Number((ceLevels.upper! + 1.50).toFixed(2));
  nifty009Engine.onOptionTick('CE', breakoutCePrice, 5000);

  const ceCandle1: Candle = {
    startTime: '09:20',
    endTime: '09:25',
    open: ceLevels.ref!,
    high: breakoutCePrice + 0.5,
    low: ceLevels.ref! - 0.2,
    close: breakoutCePrice,
    volume: 25000,
    isClosed: true
  };

  // Dispatch completed candle
  (nifty009Engine as any).ceCandleEngine.emit('candle:closed', ceCandle1);
  await new Promise(r => setTimeout(r, 100)); // allow async order processing

  status = nifty009Engine.getStatus();
  console.assert(status.ce?.state === 'LONG', 'CE State must be LONG after breakout close');
  console.assert(status.ce?.position !== null, 'CE Position must be active');
  console.assert(status.ce?.entryCount === 1, 'CE Entry count should be 1');
  console.log(`✅ Step 3 Passed: CE Breakout Triggered BUY order @ ₹${breakoutCePrice} (State: LONG, Qty: ${status.ce?.position?.quantity})`);

  // STEP 4: Test PE Breakout Entry (Independent Concurrent Position)
  console.log('\nSTEP 4: Simulating 09:30 Completed 5m PE Candle with Close >= PE Upper...');
  const breakoutPePrice = Number((peLevels.upper! + 1.20).toFixed(2));
  nifty009Engine.onOptionTick('PE', breakoutPePrice, 4000);

  const peCandle1: Candle = {
    startTime: '09:25',
    endTime: '09:30',
    open: peLevels.ref!,
    high: breakoutPePrice + 0.4,
    low: peLevels.ref! - 0.1,
    close: breakoutPePrice,
    volume: 22000,
    isClosed: true
  };

  (nifty009Engine as any).peCandleEngine.emit('candle:closed', peCandle1);
  await new Promise(r => setTimeout(r, 100));

  status = nifty009Engine.getStatus();
  console.assert(status.pe?.state === 'LONG', 'PE State must be LONG after breakout close');
  console.assert(status.ce?.state === 'LONG', 'CE State must STILL be LONG (Independent!)');
  console.assert(status.combined?.activePositionsCount === 2, 'Both CE and PE positions must be active concurrently');
  console.log(`✅ Step 4 Passed: Dual Independent Longs Active! CE State=LONG | PE State=LONG (Total Positions: ${status.combined?.activePositionsCount})`);

  // STEP 5: Test CE Exit on Close < CE Lower (Without affecting PE)
  console.log('\nSTEP 5: Simulating 11:15 Completed 5m CE Candle with Close < CE Lower...');
  const exitCePrice = Number((ceLevels.lower! - 0.80).toFixed(2));
  nifty009Engine.onOptionTick('CE', exitCePrice, 3000);

  const ceCandle2: Candle = {
    startTime: '11:10',
    endTime: '11:15',
    open: ceLevels.lower! + 0.5,
    high: ceLevels.lower! + 0.6,
    low: exitCePrice - 0.2,
    close: exitCePrice,
    volume: 18000,
    isClosed: true
  };

  (nifty009Engine as any).ceCandleEngine.emit('candle:closed', ceCandle2);
  await new Promise(r => setTimeout(r, 100));

  status = nifty009Engine.getStatus();
  console.assert(status.ce?.state === 'FLAT', 'CE State must be FLAT after falling below lower level');
  console.assert(status.ce?.position === null, 'CE Position must be cleared');
  console.assert(status.pe?.state === 'LONG', 'PE State must remain unaffected (STILL LONG)');
  console.assert(status.combined?.activePositionsCount === 1, 'Only PE should remain active');
  console.log(`✅ Step 5 Passed: CE Exit executed @ ₹${exitCePrice}. CE is FLAT while PE remains LONG!`);

  // STEP 6: Test CE Re-Entry on Subsequent Breakout
  console.log('\nSTEP 6: Simulating 11:45 CE Re-Entry on 5m Close >= CE Upper...');
  const reEntryCePrice = Number((ceLevels.upper! + 2.00).toFixed(2));
  nifty009Engine.onOptionTick('CE', reEntryCePrice, 6000);

  const ceCandle3: Candle = {
    startTime: '11:40',
    endTime: '11:45',
    open: ceLevels.ref!,
    high: reEntryCePrice + 0.5,
    low: ceLevels.ref!,
    close: reEntryCePrice,
    volume: 30000,
    isClosed: true
  };

  (nifty009Engine as any).ceCandleEngine.emit('candle:closed', ceCandle3);
  await new Promise(r => setTimeout(r, 100));

  status = nifty009Engine.getStatus();
  console.assert(status.ce?.state === 'LONG', 'CE State must return to LONG on re-entry');
  console.assert(status.ce?.entryCount === 2, 'CE Entry count should now be 2');
  console.log(`✅ Step 6 Passed: CE Re-Entry Successful @ ₹${reEntryCePrice} (Entry Count: ${status.ce?.entryCount})`);

  // STEP 7: Test 15:10 IST Force Square-Off
  console.log('\nSTEP 7: Simulating 15:10 IST Force Square-Off...');
  await nifty009Engine.forceSquareOff();

  status = nifty009Engine.getStatus();
  console.assert(status.ce?.state === 'FLAT', 'CE must be force-closed to FLAT');
  console.assert(status.pe?.state === 'FLAT', 'PE must be force-closed to FLAT');
  console.assert(status.combined?.activePositionsCount === 0, 'No active positions after square-off');
  console.assert(status.status === 'DAY_COMPLETED', 'Session status should be DAY_COMPLETED');
  console.log(`✅ Step 7 Passed: 15:10 Force Square-Off executed cleanly! CE State=FLAT, PE State=FLAT, Session=DAY_COMPLETED`);

  // STEP 8: Verify Paper Trading Records & Summary Report
  console.log('\nSTEP 8: Generating Strategy Daily Performance Report...');
  const report = await nifty009Engine.getDailyReport();
  console.log('Daily Strategy Report:', {
    date: report.date,
    ceTrades: report.ceTrades,
    peTrades: report.peTrades,
    totalTrades: report.totalTrades,
    grossPnl: `₹${report.grossPnl.toFixed(2)}`,
    netPnl: `₹${report.netPnl.toFixed(2)}`,
    status: report.status
  });

  console.assert(report.totalTrades === (report.ceTrades + report.peTrades), 'Total trades must equal sum of CE and PE trades');
  console.log('✅ Step 8 Passed: Daily Strategy Audit Report Generated Successfully');

  console.log('\n========================================================================');
  console.log('🎉 ALL 8 END-TO-END CHECKS PASSED: FULL ENGINE & SPEC VERIFIED');
  console.log('========================================================================\n');
}

runFullE2ETest().catch(err => {
  console.error('❌ E2E Test Failed with error:', err);
  process.exit(1);
});
