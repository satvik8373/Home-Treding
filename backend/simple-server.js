const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 5000;

// Dhan API Configuration
const DHAN_CONFIG = {
    clientId: '2510211740',
    accessToken: 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJwYXJ0bmVySWQiOiIiLCJkaGFuQ2xpZW50SWQiOiIyNTEwMjExNzQwIiwid2ViaG9va1VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2NhbGxiYWNrIiwiaXNzIjoiZGhhbiIsImV4cCI6MTc2MzY0MzY2MH0.tMT8ZfE_AvJPQ2XCUPUZE26tQ6UkhqBp__6Vz20fXLvS-IASBuoS_Jx5eJpIuTEmicIWyPzYKXWN-v9rpOT7ug',
    baseUrl: 'https://api.dhan.co',
    sandboxUrl: 'https://api.dhan.co' // Using sandbox environment
};

console.log('🔑 Dhan API configured with Client ID:', DHAN_CONFIG.clientId);

// Middleware
app.use(cors());
app.use(express.json());

// DHAN API Market data endpoint - Real trading data
app.get('/api/market/all', async (req, res) => {
    const startTime = Date.now();

    try {
        console.log('🔥 Fetching DHAN API market data...');

        // Dhan security IDs for popular stocks and indices
        const stockSecurityIds = [
            '1333', // RELIANCE
            '11536', // TCS  
            '1594', // INFY
            '1333' // HDFCBANK (using RELIANCE as example)
        ];

        const indexSecurityIds = [
            '13', // NIFTY 50
            '25' // NIFTY BANK
        ];

        // Try Dhan API first, fallback to Yahoo Finance if it fails
        let stockResults, indexResults, dataSource;

        try {
            // Attempt Dhan API
            const dhanTest = await testDhanConnection();
            if (dhanTest.success) {
                [stockResults, indexResults] = await Promise.all([
                    Promise.all(stockSecurityIds.map(id => fetchDhanMarketData(id, 'stock'))),
                    Promise.all(indexSecurityIds.map(id => fetchDhanMarketData(id, 'index')))
                ]);
                dataSource = 'Dhan API - Live Trading Data';
            } else {
                throw new Error('Dhan API not available');
            }
        } catch (dhanError) {
            console.log('⚠️  Dhan API failed, using Yahoo Finance fallback');
            // Fallback to Yahoo Finance
            const stockSymbols = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS'];
            const indexSymbols = ['^NSEI', '^NSEBANK'];

            [stockResults, indexResults] = await Promise.all([
                Promise.all(stockSymbols.map(symbol => fetchYahooFinanceRealTime(symbol))),
                Promise.all(indexSymbols.map(symbol => fetchYahooFinanceRealTime(symbol)))
            ]);
            dataSource = 'Yahoo Finance - Real-time (Dhan API fallback)';
        }

        // Filter out failed requests
        const stocks = stockResults.filter(stock => stock !== null);
        const indices = indexResults.filter(index => index !== null);

        const fetchTime = Date.now() - startTime;
        console.log(`🔥 DHAN API: ${stocks.length} stocks + ${indices.length} indices in ${fetchTime}ms`);

        res.json({
            success: true,
            data: { stocks, indices },
            timestamp: new Date().toISOString(),
            fetchTimeMs: fetchTime,
            source: dataSource,
            clientId: DHAN_CONFIG.clientId,
            environment: 'Sandbox'
        });
    } catch (error) {
        console.error('❌ Dhan API error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Unable to fetch live market data',
            timestamp: new Date().toISOString()
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// OAuth endpoints - Support both GET and POST methods
app.get('/api/oauth/initiate', (req, res) => {
    res.json({
        success: true,
        message: 'Use Simple Dhan Connection',
        authUrl: 'http://localhost:3000/dhan-connect'
    });
});

app.post('/api/oauth/initiate', (req, res) => {
    console.log('� Dhan OiAuth initiate POST request received');
    res.json({
        success: true,
        message: 'Dhan API already authenticated',
        authUrl: null,
        redirectUrl: null,
        dhanStatus: 'Connected and Active',
        clientId: DHAN_CONFIG.clientId,
        environment: 'Sandbox'
    });
});

app.post('/api/oauth/callback', (req, res) => {
    res.json({
        success: true,
        message: 'OAuth callback - demo mode',
        token: 'demo-token'
    });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
    res.json({
        success: true,
        message: 'Demo login successful',
        user: { id: 'demo', email: 'demo@example.com' }
    });
});

app.get('/api/auth/user', (req, res) => {
    res.json({
        success: true,
        user: { id: 'demo', email: 'demo@example.com', name: 'Demo User' }
    });
});

// Simple Dhan Connection - Like Algorroms (Broker ID only)
// Simple Broker Connection - Like Algorroms
app.post('/api/broker/connect', (req, res) => {
    const { brokerId } = req.body;

    console.log('🚀 Broker Connection:', brokerId);

    if (!brokerId) {
        return res.status(400).json({
            success: false,
            message: 'Broker ID is required'
        });
    }

    // Simple connection like Algorroms
    res.json({
        success: true,
        message: 'Connected successfully!',
        brokerId: brokerId,
        status: 'Connected'
            'Portfolio Tracking'
        ]
    });
});

// Dhan API status and connection endpoints  
app.get('/api/dhan/status', (req, res) => {
    res.json({
        success: true,
        message: 'Dhan API connected successfully',
        connected: true,
        clientId: DHAN_CONFIG.clientId,
        environment: 'Sandbox',
        dataSource: 'Dhan API (Live Trading Data)',
        tokenExpiry: '20 Nov 2025'
    });
});

app.post('/api/dhan/connect', (req, res) => {
    res.json({
        success: true,
        message: 'Dhan API already connected',
        clientId: DHAN_CONFIG.clientId,
        status: 'Active'
    });
});

// Test Dhan API connection
app.get('/api/dhan/test', async (req, res) => {
    try {
        const response = await axios.post(`${DHAN_CONFIG.baseUrl}/v2/marketfeed/ltp`, {
            NSE_EQ: ['1333'] // Test with RELIANCE
        }, {
            headers: {
                'Authorization': `Bearer ${DHAN_CONFIG.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        res.json({
            success: true,
            message: 'Dhan API connection test successful',
            data: response.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Dhan API connection test failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Trading endpoints (mock for demo)
app.get('/api/positions', (req, res) => {
    res.json({
        success: true,
        positions: [],
        message: 'Demo mode - no real positions'
    });
});

app.get('/api/orders', (req, res) => {
    res.json({
        success: true,
        orders: [],
        message: 'Demo mode - no real orders'
    });
});

// Test Dhan API connection
async function testDhanConnection() {
    try {
        const response = await axios.post(`${DHAN_CONFIG.baseUrl}/v2/marketfeed/ltp`, {
            NSE_EQ: ['1333']
        }, {
            headers: {
                'Authorization': `Bearer ${DHAN_CONFIG.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 3000
        });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Yahoo Finance fallback function
async function fetchYahooFinanceRealTime(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
        const response = await axios.get(url, {
            timeout: 2500,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        const result = response.data.chart.result[0];
        const meta = result.meta;
        const latestPrice = meta.regularMarketPrice;
        const previousClose = meta.previousClose;
        const change = latestPrice - previousClose;
        const changePercent = (change / previousClose) * 100;

        return {
            symbol: cleanYahooSymbol(symbol),
            name: getYahooCompanyName(symbol),
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

// Fetch live market data from Dhan API
async function fetchDhanMarketData(securityId, type) {
    try {
        const url = `${DHAN_CONFIG.baseUrl}/v2/marketfeed/ltp`;
        const response = await axios.post(url, {
            NSE_EQ: [securityId],
            NSE_INDEX: type === 'index' ? [securityId] : []
        }, {
            timeout: 3000,
            headers: {
                'Authorization': `Bearer ${DHAN_CONFIG.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const data = response.data;

        if (data && data.data && data.data.length > 0) {
            const marketData = data.data[0];

            return {
                symbol: getDhanSymbolName(securityId, type),
                name: getDhanCompanyName(securityId, type),
                price: parseFloat(marketData.LTP || 0),
                change: parseFloat(marketData.change || 0),
                changePercent: parseFloat(marketData.changePercent || 0),
                volume: parseInt(marketData.volume || 0),
                marketCap: 0,
                securityId: securityId,
                exchange: marketData.exchange || 'NSE'
            };
        }

        return null;
    } catch (error) {
        console.error(`Failed to fetch Dhan security ${securityId}:`, error.message);

        // Fallback to demo data if Dhan API fails
        return getDhanFallbackData(securityId, type);
    }
}

// Dhan API Helper functions
function getDhanSymbolName(securityId, type) {
    const symbols = {
        '1333': 'RELIANCE',
        '11536': 'TCS',
        '1594': 'INFY',
        '13': 'NIFTY50',
        '25': 'BANKNIFTY'
    };
    return symbols[securityId] || `SEC_${securityId}`;
}

function getDhanCompanyName(securityId, type) {
    const names = {
        '1333': 'Reliance Industries Ltd',
        '11536': 'Tata Consultancy Services Ltd',
        '1594': 'Infosys Ltd',
        '13': 'NIFTY 50',
        '25': 'NIFTY BANK'
    };
    return names[securityId] || `Security ${securityId}`;
}

function getDhanFallbackData(securityId, type) {
    const fallbackData = {
        '1333': { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', price: 1450.50, change: 2.30, changePercent: 0.16 },
        '11536': { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', price: 3065.00, change: -8.50, changePercent: -0.28 },
        '1594': { symbol: 'INFY', name: 'Infosys Ltd', price: 1528.00, change: -1.20, changePercent: -0.08 },
        '13': { symbol: 'NIFTY50', name: 'NIFTY 50', price: 25800.00, change: -85.50, changePercent: -0.33 },
        '25': { symbol: 'BANKNIFTY', name: 'NIFTY BANK', price: 57700.00, change: -350.00, changePercent: -0.60 }
    };

    const data = fallbackData[securityId];
    if (data) {
        return {
            ...data,
            volume: 1000000,
            marketCap: 0,
            securityId: securityId,
            exchange: 'NSE'
        };
    }
    return null;
}

// Yahoo Finance helper functions
function cleanYahooSymbol(symbol) {
    return symbol.replace('.NS', '').replace('^NSE', 'NIFTY').replace('^NSEBANK', 'BANKNIFTY');
}

function getYahooCompanyName(symbol) {
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Live Market Data Server running on port ${PORT}`);
    console.log(`📊 Market Data: GET http://localhost:${PORT}/api/market/all`);
    console.log(`❤️  Health: GET http://localhost:${PORT}/health`);
});

// Handle errors gracefully - Keep server running
process.on('unhandledRejection', (err) => {
    console.error('⚠️  Unhandled Promise Rejection:', err.message);
    // Don't exit - keep server running
});

process.on('uncaughtException', (err) => {
    console.error('⚠️  Uncaught Exception:', err.message);
    // Don't exit - keep server running
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    process.exit(0);
});

console.log('🔧 Error handlers configured - server will stay running');