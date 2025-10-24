import { Request, Response } from 'express';
import axios from 'axios';

/**
 * REAL LIVE MARKET DATA - Get all market data from Yahoo Finance API
 * Returns: Real Indian stocks + Indices prices matching TradingView
 */
export const getAllMarketData = async (_req: Request, res: Response) => {
  try {
    // Real NSE symbols for Yahoo Finance API
    const stockSymbols = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS'];
    const indexSymbols = ['^NSEI', '^NSEBANK']; // NIFTY 50 and NIFTY BANK

    // Fetch real market data in parallel
    const [stockResults, indexResults] = await Promise.all([
      Promise.all(stockSymbols.map(symbol => fetchYahooFinance(symbol))),
      Promise.all(indexSymbols.map(symbol => fetchYahooFinance(symbol)))
    ]);

    // Filter out failed requests
    const stocks = stockResults.filter(stock => stock !== null);
    const indices = indexResults.filter(index => index !== null);

    res.json({
      success: true,
      data: {
        stocks,
        indices
      },
      timestamp: new Date().toISOString(),
      source: 'Yahoo Finance - Real Live Data'
    });
  } catch (error: any) {
    console.error('Market data fetch error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Unable to fetch live market data. Please try again.',
      timestamp: new Date().toISOString()
    });
  }
};

// Fetch real market data from Yahoo Finance
async function fetchYahooFinance(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const result = response.data.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators.quote[0];
    
    // Get the latest price data
    const latestPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1];
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
  } catch (error: any) {
    console.error(`Failed to fetch ${symbol}:`, error.message);
    return null;
  }
}

// Clean symbol names for display
function cleanSymbol(symbol: string): string {
  return symbol.replace('.NS', '').replace('^NSE', 'NIFTY').replace('^NSEBANK', 'BANKNIFTY');
}

// Get company names
function getCompanyName(symbol: string): string {
  const names: { [key: string]: string } = {
    'RELIANCE.NS': 'Reliance Industries Ltd',
    'TCS.NS': 'Tata Consultancy Services Ltd',
    'INFY.NS': 'Infosys Ltd',
    'HDFCBANK.NS': 'HDFC Bank Ltd',
    '^NSEI': 'NIFTY 50',
    '^NSEBANK': 'NIFTY BANK'
  };
  return names[symbol] || symbol;
}


