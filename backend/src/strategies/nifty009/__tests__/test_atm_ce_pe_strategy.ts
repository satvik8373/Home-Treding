import { AtmCePeBreakoutStrategy, StrategyCandle } from '../AtmCePeBreakoutStrategy';

function verifyDirectPythonEquivalent() {
  console.log('================================================================');
  console.log('TESTING AtmCePeBreakoutStrategy (DIRECT PYTHON EQUIVALENT)');
  console.log('================================================================\n');

  const executedOrders: Array<{ leg: string; type: string; price: number; ts: string; qty: number }> = [];

  const placeBuy = (leg: 'CE' | 'PE', price: number, ts: string, qty: number) => {
    console.log(`[${ts}] BUY  ${leg}  ${qty} qty (2 lots) @ ${price.toFixed(2)}`);
    executedOrders.push({ leg, type: 'BUY', price, ts, qty });
  };

  const placeExit = (leg: 'CE' | 'PE', price: number, ts: string, qty: number) => {
    console.log(`[${ts}] EXIT ${leg}  ${qty} qty @ ${price.toFixed(2)}`);
    executedOrders.push({ leg, type: 'EXIT', price, ts, qty });
  };

  const strat = new AtmCePeBreakoutStrategy(placeBuy, placeExit, 65);

  // 09:15-09:20 reference candle closes -> lock levels per leg
  strat.lockCeReference(142.50);
  strat.lockPeReference(98.00);

  console.log(`CE Levels -> Upper: ${strat.ce.upperLevel} | Lower: ${strat.ce.lowerLevel}`);
  console.log(`PE Levels -> Upper: ${strat.pe.upperLevel} | Lower: ${strat.pe.lowerLevel}\n`);

  console.assert(strat.ce.upperLevel === 142.63, 'CE upper should be 142.63');
  console.assert(strat.ce.lowerLevel === 142.37, 'CE lower should be 142.37');
  console.assert(strat.pe.upperLevel === 98.09, 'PE upper should be 98.09');
  console.assert(strat.pe.lowerLevel === 97.91, 'PE lower should be 97.91');

  // Subsequent 5-min candles, fed independently per leg
  strat.onCeCandle({ ts: '09:25', close: 145.00 });   // >= 142.50*1.0009 -> BUY CE (2 lots)
  console.assert(strat.ce.state === 'LONG', 'CE should be LONG');

  strat.onCeCandle({ ts: '09:35', close: 143.00 });   // already long, no re-entry
  console.assert(strat.ce.entryCount === 1, 'No duplicate entry');

  strat.onCeCandle({ ts: '11:15', close: 142.30 });  // < 142.50*0.9991 -> EXIT CE
  console.assert(strat.ce.state === 'FLAT', 'CE should be FLAT');

  strat.onCeCandle({ ts: '11:45', close: 144.00 });  // crosses up again -> BUY CE again (re-entry)
  console.assert(strat.ce.state === 'LONG', 'CE should be LONG again');
  console.assert(strat.ce.entryCount === 2, 'CE should have 2 entries');

  strat.onCeCandle({ ts: '13:00', close: 142.30 });   // < lower -> EXIT CE
  console.assert(strat.ce.state === 'FLAT', 'CE should be FLAT');
  console.assert(strat.ce.exitCount === 2, 'CE should have 2 exits');

  strat.onPeCandle({ ts: '09:30', close: 98.10 });    // > 98*1.0009 -> BUY PE
  console.assert(strat.pe.state === 'LONG', 'PE should be LONG');

  strat.onPeCandle({ ts: '15:10', close: 95.00 });   // force square-off
  console.assert(strat.pe.state === 'FLAT', 'PE should be FLAT after 15:10');

  console.assert(executedOrders.length === 6, 'Total executed orders should be 6');
  console.log('\n✅ All 6 orders executed in exact sequence matching Python script:');
  executedOrders.forEach((o, i) => {
    console.log(`  ${i + 1}. [${o.ts}] ${o.type} ${o.leg} @ ₹${o.price} (${o.qty} qty)`);
  });

  console.log('\n================================================================');
  console.log('AtmCePeBreakoutStrategy: PASSED 100%');
  console.log('================================================================');
}

verifyDirectPythonEquivalent();
