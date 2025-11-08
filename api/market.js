const { handleCors } = require('./_lib/cors');
const axios = require('axios');

// Yahoo Finance fetch function
async function fetchYahooFinance(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    const response = await axios.get(url, {
      timeout: 3000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    const result = response.data.chart.result[0];
    const meta = result.meta;
    const latestPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose;
    const change = latestPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      symbol: cleanSymbol(symbol),
      name: getCompanyName(symbol),
      price: parseFloat(latestPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: meta.regularMarketVolume || 0,
      marketCap: meta.marketCap || 0
    };
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error.message);
    return null;
  }
}

function cleanSymbol(symbol) {
  return symbol.replace('.NS', '').replace('^NSE', 'NIFTY').replace('^NSEBANK', 'BANKNIFTY');
}

function getCompanyName(symbol) {
  const names = {
    'RELIANCE.NS': 'Reliance Industries Ltd',
    'TCS.NS': 'Tata Consultancy Services Ltd',
    'INFY.NS': 'Infosys Ltd',
    'HDFCBANK.NS': 'HDFC Bank Ltd',
    '^NSEI': 'NIFTY 50',
    '^NSEBANK': 'NIFTY BANK'
  };
  return names[symbol] || symbol;
}

module.exports = async (req, res) => {
  return handleCors(req, res, async () => {
    const startTime = Date.now();

    try {
      console.log('📊 Fetching market data...');

      const stockSymbols = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS'];
      const indexSymbols = ['^NSEI', '^NSEBANK'];

      const [stockResults, indexResults] = await Promise.all([
        Promise.all(stockSymbols.map(symbol => fetchYahooFinance(symbol))),
        Promise.all(indexSymbols.map(symbol => fetchYahooFinance(symbol)))
      ]);

      const stocks = stockResults.filter(stock => stock !== null);
      const indices = indexResults.filter(index => index !== null);

      const fetchTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: { stocks, indices },
        timestamp: new Date().toISOString(),
        fetchTimeMs: fetchTime,
        source: 'Yahoo Finance - Real-time'
      });
    } catch (error) {
      console.error('❌ Market data error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Unable to fetch market data',
        timestamp: new Date().toISOString()
      });
    }
  });
};
