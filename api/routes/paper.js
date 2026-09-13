const express = require('express');
const router = express.Router();
const realMarketData = require('../services/realMarketData');

// In-memory paper trading portfolio state
let paperPortfolio = {
  initialCapital: 100000,
  availableCash: 95000,
  utilizedMargin: 5000,
  totalPortfolioValue: 102450,
  realizedPnl: 1250,
  unrealizedPnl: 1200,
  totalPnl: 2450,
  dayPnl: 2450,
  winCount: 4,
  lossCount: 1,
  totalTrades: 5,
  winRate: 80
};

let paperPositions = [
  {
    positionId: 'pos_1',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    segment: 'EQ',
    productType: 'INTRADAY',
    quantity: 10,
    buyQuantity: 10,
    sellQuantity: 0,
    buyAvgPrice: 2960.00,
    sellAvgPrice: 0,
    netAvgPrice: 2960.00,
    ltp: 2985.50,
    realizedPnl: 0,
    unrealizedPnl: 255.00,
    totalPnl: 255.00
  },
  {
    positionId: 'pos_2',
    symbol: 'TCS',
    exchange: 'NSE',
    segment: 'EQ',
    productType: 'INTRADAY',
    quantity: 5,
    buyQuantity: 5,
    sellQuantity: 0,
    buyAvgPrice: 4090.00,
    sellAvgPrice: 0,
    netAvgPrice: 4090.00,
    ltp: 4120.00,
    realizedPnl: 0,
    unrealizedPnl: 150.00,
    totalPnl: 150.00
  }
];

let paperOrders = [
  {
    orderId: 'PORD_1',
    brokerOrderId: 'PORD_1',
    symbol: 'RELIANCE',
    side: 'BUY',
    orderType: 'MARKET',
    productType: 'INTRADAY',
    quantity: 10,
    filledQuantity: 10,
    pendingQuantity: 0,
    price: 2960.00,
    averagePrice: 2960.00,
    status: 'FILLED',
    orderTimestamp: new Date(Date.now() - 3600000).toISOString()
  },
  {
    orderId: 'PORD_2',
    brokerOrderId: 'PORD_2',
    symbol: 'TCS',
    side: 'BUY',
    orderType: 'MARKET',
    productType: 'INTRADAY',
    quantity: 5,
    filledQuantity: 5,
    pendingQuantity: 0,
    price: 4090.00,
    averagePrice: 4090.00,
    status: 'FILLED',
    orderTimestamp: new Date(Date.now() - 1800000).toISOString()
  }
];

// Get paper portfolio
router.get('/portfolio', async (req, res) => {
  try {
    // Update LTPs for open positions
    let unrealized = 0;
    for (const pos of paperPositions) {
      if (pos.quantity > 0) {
        const quotes = await realMarketData.fetchLiveData([pos.symbol]);
        if (quotes[0]?.ltp) {
          pos.ltp = quotes[0].ltp;
          pos.unrealizedPnl = Number(((pos.ltp - pos.netAvgPrice) * pos.quantity).toFixed(2));
          pos.totalPnl = Number((pos.realizedPnl + pos.unrealizedPnl).toFixed(2));
        }
        unrealized += pos.unrealizedPnl;
      }
    }

    paperPortfolio.unrealizedPnl = Number(unrealized.toFixed(2));
    paperPortfolio.totalPnl = Number((paperPortfolio.realizedPnl + paperPortfolio.unrealizedPnl).toFixed(2));
    paperPortfolio.dayPnl = paperPortfolio.totalPnl;
    paperPortfolio.totalPortfolioValue = Number((paperPortfolio.availableCash + paperPortfolio.utilizedMargin + paperPortfolio.totalPnl).toFixed(2));

    res.json({
      success: true,
      portfolio: paperPortfolio
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
    res.json({
      success: true,
      positions: paperPositions
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
    res.json({
      success: true,
      orders: paperOrders
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

    paperOrders.unshift(newOrder);

    // Update positions
    const existingPos = paperPositions.find(p => p.symbol.toUpperCase() === symbol.toUpperCase() && p.productType === productType.toUpperCase());
    if (existingPos) {
      if (side.toUpperCase() === 'BUY') {
        const totalCost = (existingPos.quantity * existingPos.netAvgPrice) + (Number(quantity) * fillPrice);
        existingPos.quantity += Number(quantity);
        existingPos.buyQuantity += Number(quantity);
        existingPos.netAvgPrice = Number((totalCost / existingPos.quantity).toFixed(2));
        existingPos.ltp = fillPrice;
      } else {
        // Sell / reduce
        const soldQty = Math.min(existingPos.quantity, Number(quantity));
        const profit = (fillPrice - existingPos.netAvgPrice) * soldQty;
        paperPortfolio.realizedPnl += profit;
        existingPos.quantity -= soldQty;
        existingPos.sellQuantity += soldQty;
      }
    } else {
      if (side.toUpperCase() === 'BUY') {
        paperPositions.push({
          positionId: `pos_${Date.now()}`,
          symbol: symbol.toUpperCase(),
          exchange: 'NSE',
          segment: 'EQ',
          productType: productType.toUpperCase(),
          quantity: Number(quantity),
          buyQuantity: Number(quantity),
          sellQuantity: 0,
          buyAvgPrice: fillPrice,
          sellAvgPrice: 0,
          netAvgPrice: fillPrice,
          ltp: fillPrice,
          realizedPnl: 0,
          unrealizedPnl: 0,
          totalPnl: 0
        });
      }
    }

    paperPortfolio.totalTrades += 1;

    res.json({
      success: true,
      order: newOrder,
      message: 'Paper order executed successfully'
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
    const capital = req.body.initialCapital ? Number(req.body.initialCapital) : 100000;
    paperPortfolio = {
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
    };
    paperPositions = [];
    paperOrders = [];

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

module.exports = router;
