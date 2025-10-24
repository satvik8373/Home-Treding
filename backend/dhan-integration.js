const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');

const router = express.Router();

// DhanHQ API Configuration
const DHAN_CONFIG = {
    apiBase: 'https://api.dhan.co/v2',
    sandboxBase: 'https://api.dhan.co/v2', // Use sandbox for testing
    dataApiBase: 'https://api.dhan.co/v2/charts',
    wsUrl: 'wss://api.dhan.co/v2/websocket'
};

// Store user tokens (in production, use secure database)
const userTokens = new Map();

/**
 * STEP 1: Authentication & Token Management
 */
router.post('/auth/login', async (req, res) => {
    const { clientId, accessToken } = req.body;
    
    try {
        console.log('🔐 DhanHQ Authentication:', clientId);
        
        // Verify token with DhanHQ
        const response = await axios.get(`${DHAN_CONFIG.apiBase}/user/profile`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        if (response.status === 200) {
            // Store token for this user
            userTokens.set(clientId, {
                accessToken,
                profile: response.data,
                connectedAt: new Date()
            });
            
            res.json({
                success: true,
                message: 'Connected to DhanHQ successfully!',
                profile: response.data,
                features: [
                    'Live Market Data',
                    'Order Placement',
                    'Portfolio Management',
                    'Real-time Updates'
                ]
            });
        }
    } catch (error) {
        console.error('❌ DhanHQ Auth Error:', error.response?.data || error.message);
        res.status(401).json({
            success: false,
            message: 'Invalid credentials or DhanHQ connection failed',
            error: error.response?.data?.message || 'Authentication failed'
        });
    }
});

/**
 * STEP 2: Market Data APIs
 */
router.get('/market/ltp/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { clientId } = req.query;
    
    try {
        const userToken = userTokens.get(clientId);
        if (!userToken) {
            return res.status(401).json({ error: 'Not authenticated with DhanHQ' });
        }
        
        const response = await axios.get(`${DHAN_CONFIG.dataApiBase}/NSE/${symbol}`, {
            headers: {
                'Authorization': `Bearer ${userToken.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            data: response.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Market data error:', error.message);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
});

/**
 * STEP 3: Order Placement APIs
 */
router.post('/orders/place', async (req, res) => {
    const { clientId, symbol, quantity, orderType, price, exchange } = req.body;
    
    try {
        const userToken = userTokens.get(clientId);
        if (!userToken) {
            return res.status(401).json({ error: 'Not authenticated with DhanHQ' });
        }
        
        console.log('📈 Placing order via DhanHQ:', { symbol, quantity, orderType });
        
        const orderPayload = {
            dhanClientId: clientId,
            correlationId: `ORDER_${Date.now()}`,
            transactionType: 'BUY', // or 'SELL'
            exchangeSegment: exchange || 'NSE_EQ',
            productType: 'INTRADAY', // or 'CNC', 'MTF'
            orderType: orderType, // 'LIMIT', 'MARKET', 'STOP_LOSS'
            validity: 'DAY',
            tradingSymbol: symbol,
            securityId: symbol, // Map symbol to security ID
            quantity: quantity,
            disclosedQuantity: 0,
            price: price || 0,
            triggerPrice: 0
        };
        
        const response = await axios.post(`${DHAN_CONFIG.apiBase}/orders`, orderPayload, {
            headers: {
                'Authorization': `Bearer ${userToken.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            orderId: response.data.orderId,
            status: response.data.orderStatus,
            message: 'Order placed successfully via DhanHQ'
        });
        
    } catch (error) {
        console.error('❌ Order placement error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Order placement failed',
            details: error.response?.data || error.message
        });
    }
});

/**
 * STEP 4: Portfolio Management
 */
router.get('/portfolio/:clientId', async (req, res) => {
    const { clientId } = req.params;
    
    try {
        const userToken = userTokens.get(clientId);
        if (!userToken) {
            return res.status(401).json({ error: 'Not authenticated with DhanHQ' });
        }
        
        // Get holdings
        const holdingsResponse = await axios.get(`${DHAN_CONFIG.apiBase}/holdings`, {
            headers: {
                'Authorization': `Bearer ${userToken.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Get positions
        const positionsResponse = await axios.get(`${DHAN_CONFIG.apiBase}/positions`, {
            headers: {
                'Authorization': `Bearer ${userToken.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            holdings: holdingsResponse.data,
            positions: positionsResponse.data,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Portfolio error:', error.message);
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});

/**
 * STEP 5: Order Management
 */
router.get('/orders/:clientId', async (req, res) => {
    const { clientId } = req.params;
    
    try {
        const userToken = userTokens.get(clientId);
        if (!userToken) {
            return res.status(401).json({ error: 'Not authenticated with DhanHQ' });
        }
        
        const response = await axios.get(`${DHAN_CONFIG.apiBase}/orders`, {
            headers: {
                'Authorization': `Bearer ${userToken.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            orders: response.data,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Orders fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

/**
 * STEP 6: WebSocket for Real-time Updates
 */
function setupDhanWebSocket(clientId, accessToken) {
    const ws = new WebSocket(DHAN_CONFIG.wsUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    ws.on('open', () => {
        console.log('🔗 DhanHQ WebSocket connected for client:', clientId);
        
        // Subscribe to market data
        ws.send(JSON.stringify({
            type: 'subscribe',
            symbols: ['NSE:RELIANCE', 'NSE:TCS', 'NSE:INFY', 'NSE:HDFCBANK']
        }));
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('📊 Live market update:', message);
            
            // Broadcast to frontend via your WebSocket server
            // broadcastToFrontend(clientId, message);
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ DhanHQ WebSocket error:', error);
    });
    
    return ws;
}

/**
 * Connection Status
 */
router.get('/status/:clientId', (req, res) => {
    const { clientId } = req.params;
    const userToken = userTokens.get(clientId);
    
    if (userToken) {
        res.json({
            connected: true,
            connectedAt: userToken.connectedAt,
            profile: userToken.profile,
            status: 'Active DhanHQ Connection'
        });
    } else {
        res.json({
            connected: false,
            status: 'Not connected to DhanHQ'
        });
    }
});

module.exports = router;