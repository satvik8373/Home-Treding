import assert from 'node:assert/strict';
import { DhanHistoricalDataService, Candle, OptionCandle, formatDhanDate, chunkDateRange } from '../DhanHistoricalDataService';

async function run() {
  const request = { securityId: '13', exchangeSegment: 'IDX_I' as const,
    instrument: 'INDEX', symbol: 'NIFTY 50', fromDate: '2026-09-22',
    toDate: '2026-09-23', interval: 5 as const };

  await assert.rejects(
    new DhanHistoricalDataService().getIntradayCandles(request),
    /DHAN_AUTH_REQUIRED/
  );

  const dhan = new DhanHistoricalDataService({ clientId: 'test', accessToken: 'test' });
  (dhan as any).http = { post: async () => {
    throw { response: { status: 403, data: { errorCode: 'DH-902', errorMessage: 'Data APIs inactive' } } };
  } };
  await assert.rejects(dhan.getIntradayCandles(request), /DHAN_DATA_API_NOT_SUBSCRIBED/);

  const spot: Candle = { date: '2026-09-22', time: '09:15', timestamp: 1790048700,
    isoTime: '2026-09-22T09:15:00+05:30', open: 25000, high: 25000,
    low: 25000, close: 25000, volume: 100 };
  await assert.rejects(dhan.getExpiredOptionCandles({ securityId: '13', exchangeSegment: 'NSE_FNO',
    instrument: 'OPTIDX', expiryFlag: 'WEEK', expiryCode: 0, strike: 'ATM', optionType: 'CALL',
    fromDate: request.fromDate, toDate: request.toDate, interval: 1 }), /DHAN_DATA_API_NOT_SUBSCRIBED/);

  assert.equal(formatDhanDate(new Date('2026-09-22T00:00:00Z')), '2026-09-22 00:00:00');
  assert.equal(chunkDateRange(new Date('2026-09-22T00:00:00Z'), new Date('2026-09-24T00:00:00Z'), 1).length, 2);

  const fixed = new DhanHistoricalDataService({ clientId: 'test', accessToken: 'test' });
  fixed.isUsingDhanApi = true;
  const first = Date.parse('2026-09-22T09:15:00+05:30') / 1000;
  const minutes: OptionCandle[] = Array.from({ length: 356 }, (_, i) => {
    const timestamp = first + i * 60;
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp * 1000));
    return { timestamp, date: '2026-09-22', time, isoTime: `2026-09-22T${time}:00+05:30`,
      open: 100, high: 100, low: 100, close: 100, volume: 10,
      strike: 25000, optionType: 'CE' };
  });
  (fixed as any).getExpiredOptionCandles = async ({ strike }: { strike: string }) => strike === 'ATM' ? minutes : [];
  const option = await fixed.getFixedStrikeOptionSeries({ symbol: 'NIFTY 50', fromDate: request.fromDate,
    toDate: request.toDate, optionType: 'CE', strikeStep: 50, preloadedSpot: [spot] });
  assert.equal(option.candles1m.length, 356);
  assert.equal(option.candles5m.length, 71);
  assert.equal(option.strikesByDate['2026-09-22'], 25000);

  (fixed as any).getExpiredOptionCandles = async ({ strike }: { strike: string }) => strike === 'ATM' ? minutes.filter(c => c.time !== '10:00') : [];
  await assert.rejects(fixed.getFixedStrikeOptionSeries({ symbol: 'NIFTY 50', fromDate: request.fromDate,
    toDate: request.toDate, optionType: 'CE', strikeStep: 50, preloadedSpot: [spot] }), /INCOMPLETE_OPTION_DATA/);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
