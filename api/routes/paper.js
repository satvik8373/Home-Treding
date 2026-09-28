const express = require('express');
const router = express.Router();
const realMarketData = require('../services/realMarketData');

// In-memory paper trading portfolio state mapped by userId
const userPortfolios = new Map();
const userPositions = new Map();
const userOrders = new Map();
const userAuditLogs = new Map();

const getInitialPortfolio = (capital = 100000) => ({
  initialCapital: capital,
  availableCash: capital,
  utilizedMargin: 0,
  totalPortfolioValue: capital,
  realizedPnl: 0,
  unrealizedPnl: 0,
  totalPnl: 0,
  dayPnl: 0,
  winCount: 0,
  lossCount: 0,
  totalTrades: 0,
  winRate: 0
});

const getUserData = (req) => {
  const userId = req.query.userId || req.body?.userId || 'default';
  if (!userPortfolios.has(userId)) {
    userPortfolios.set(userId, getInitialPortfolio(100000));
  }
  if (!userPositions.has(userId)) {
    userPositions.set(userId, []);
  }
  if (!userOrders.has(userId)) {
    userOrders.set(userId, []);
  }
  if (!userAuditLogs.has(userId)) {
    userAuditLogs.set(userId, []);
  }
  return {
    userId,
    portfolio: userPortfolios.get(userId),
    positions: userPositions.get(userId),
    orders: userOrders.get(userId),
    auditLogs: userAuditLogs.get(userId)
  };
};

// Get paper trading portfolio
router.get('/portfolio', async (req, res) => {
  try {
    const { portfolio, positions } = getUserData(req);

    // Update real-time LTP and unrealized P&L
    if (positions.length > 0) {
      const symbols = positions.map(p => p.symbol);
      const quotes = await realMarketData.fetchLiveData(symbols);
      const priceMap = new Map(quotes.map(q => [q.symbol, q.ltp]));

      let totalUnrealized = 0;
      positions.forEach(pos => {
        const ltp = priceMap.get(pos.symbol) || pos.ltp;
        pos.ltp = ltp;
        const diff = pos.quantity > 0 ? (ltp - pos.buyAvgPrice) : (pos.sellAvgPrice - ltp);
        pos.unrealizedPnl = Number((diff * Math.abs(pos.quantity)).toFixed(2));
        pos.totalPnl = Number((pos.realizedPnl + pos.unrealizedPnl).toFixed(2));
        totalUnrealized += pos.unrealizedPnl;
      });

      portfolio.unrealizedPnl = Number(totalUnrealized.toFixed(2));
      portfolio.totalPnl = Number((portfolio.realizedPnl + portfolio.unrealizedPnl).toFixed(2));
      portfolio.dayPnl = portfolio.totalPnl;
      portfolio.totalPortfolioValue = Number((portfolio.availableCash + portfolio.utilizedMargin + portfolio.totalPnl).toFixed(2));
    }

    res.json({
      success: true,
      portfolio
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get paper positions
router.get('/positions', async (req, res) => {
  try {
    const { positions } = getUserData(req);
    res.json({
      success: true,
      positions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get paper orders
router.get('/orders', (req, res) => {
  try {
    const { orders } = getUserData(req);
    res.json({
      success: true,
      orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Place paper order
router.post('/order', async (req, res) => {
  try {
    const { symbol, side, quantity, price, orderType = 'MARKET', productType = 'INTRADAY' } = req.body;

    if (!symbol || !side || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Symbol, side, and quantity are required'
      });
    }

    const { portfolio, positions, orders } = getUserData(req);

    let fillPrice = Number(price) || 0;
    if (fillPrice <= 0) {
      const quote = await realMarketData.fetchLiveData([symbol]);
      fillPrice = quote[0]?.ltp || 1000.00;
    }

    const orderId = `PORD_${Date.now()}`;
    const newOrder = {
      orderId,
      brokerOrderId: orderId,
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      orderType: orderType.toUpperCase(),
      productType: productType.toUpperCase(),
      quantity: Number(quantity),
      filledQuantity: Number(quantity),
      pendingQuantity: 0,
      price: fillPrice,
      averagePrice: fillPrice,
      status: 'FILLED',
      orderTimestamp: new Date().toISOString()
    };

    orders.unshift(newOrder);
    portfolio.totalTrades += 1;

    // Update positions
    const existingIndex = positions.findIndex(p => p.symbol === symbol.toUpperCase());
    const qty = Number(quantity);
    const orderCost = fillPrice * qty;

    if (existingIndex >= 0) {
      const pos = positions[existingIndex];
      if (side.toUpperCase() === 'BUY') {
        const totalCost = (pos.buyAvgPrice * pos.buyQuantity) + orderCost;
        pos.buyQuantity += qty;
        pos.quantity += qty;
        pos.buyAvgPrice = Number((totalCost / pos.buyQuantity).toFixed(2));
        pos.netAvgPrice = pos.buyAvgPrice;
      } else {
        pos.sellQuantity += qty;
        pos.quantity -= qty;
        pos.sellAvgPrice = fillPrice;
        const pnl = Number(((fillPrice - pos.buyAvgPrice) * qty).toFixed(2));
        pos.realizedPnl += pnl;
        portfolio.realizedPnl += pnl;
        if (pnl >= 0) portfolio.winCount += 1;
        else portfolio.lossCount += 1;
      }

      if (pos.quantity === 0) {
        positions.splice(existingIndex, 1);
      }
    } else {
      positions.push({
        positionId: `pos_${Date.now()}`,
        symbol: symbol.toUpperCase(),
        exchange: 'NSE',
        segment: 'EQ',
        productType: productType.toUpperCase(),
        quantity: side.toUpperCase() === 'BUY' ? qty : -qty,
        buyQuantity: side.toUpperCase() === 'BUY' ? qty : 0,
        sellQuantity: side.toUpperCase() === 'SELL' ? qty : 0,
        buyAvgPrice: side.toUpperCase() === 'BUY' ? fillPrice : 0,
        sellAvgPrice: side.toUpperCase() === 'SELL' ? fillPrice : 0,
        netAvgPrice: fillPrice,
        ltp: fillPrice,
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalPnl: 0
      });
    }

    // Recalculate margins
    const utilizedMargin = positions.reduce((acc, p) => acc + (p.ltp * Math.abs(p.quantity) * 0.2), 0);
    portfolio.utilizedMargin = Number(utilizedMargin.toFixed(2));
    portfolio.availableCash = Number((portfolio.initialCapital - portfolio.utilizedMargin + portfolio.realizedPnl).toFixed(2));
    portfolio.totalPortfolioValue = Number((portfolio.availableCash + portfolio.utilizedMargin).toFixed(2));
    portfolio.winRate = portfolio.totalTrades > 0
      ? Number(((portfolio.winCount / portfolio.totalTrades) * 100).toFixed(1))
      : 0;

    // Audit log
    const { auditLogs } = getUserData(req);
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'ORDER_FILLED',
      symbol: symbol.toUpperCase(),
      details: {
        orderId,
        side,
        quantity: Number(quantity),
        price: fillPrice,
        productType,
        orderType
      }
    });

    res.json({
      success: true,
      message: 'Paper order executed successfully',
      order: newOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Reset paper portfolio
router.post('/reset', (req, res) => {
  try {
    const { userId } = getUserData(req);
    const capital = req.body?.initialCapital ? Number(req.body.initialCapital) : 100000;
    userPortfolios.set(userId, getInitialPortfolio(capital));
    userPositions.set(userId, []);
    userOrders.set(userId, []);
    userAuditLogs.set(userId, [{
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'PORTFOLIO_RESET',
      symbol: 'PORTFOLIO',
      details: { capital }
    }]);

    res.json({
      success: true,
      message: `Paper portfolio reset to ₹${capital.toLocaleString()}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get daily paper report
router.get('/report', async (req, res) => {
  try {
    const { portfolio, positions, orders } = getUserData(req);
    const grossPnl = portfolio.totalPnl || 0;
    const totalBrokerage = orders.length * 40;
    const totalSlippageCost = orders.length * 15;
    const netPnl = Number((grossPnl - totalBrokerage - totalSlippageCost).toFixed(2));

    const report = {
      date: new Date().toISOString().split('T')[0],
      initialVirtualCapital: portfolio.initialCapital || 100000,
      finalVirtualCapital: Number((portfolio.totalPortfolioValue || portfolio.initialCapital || 100000).toFixed(2)),
      totalTrades: portfolio.totalTrades || orders.length,
      winningTrades: portfolio.winCount || 0,
      losingTrades: portfolio.lossCount || 0,
      winRate: portfolio.winRate || 0,
      grossPnl: Number(grossPnl.toFixed(2)),
      totalBrokerage,
      totalSlippageCost,
      netPnl,
      maxDrawdown: Number((portfolio.lossCount * 450).toFixed(2)),
      trades: orders.map(o => ({
        tradeId: o.orderId,
        orderId: o.orderId,
        symbol: o.symbol,
        side: o.side,
        quantity: o.quantity,
        price: o.price,
        timestamp: o.orderTimestamp || o.timestamp || new Date().toISOString()
      })),
      openPositions: positions
    };

    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get audit logs
router.get('/audit-logs', (req, res) => {
  try {
    const { auditLogs } = getUserData(req);
    res.json({
      success: true,
      logs: auditLogs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
