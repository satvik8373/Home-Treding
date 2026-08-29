/**
 * DhanHQ API v2 Configuration & Full Endpoint Constants
 * Reference: https://dhanhq.co/docs/v2/
 */

export const DHAN_CONFIG = {
  BASE_URL: 'https://api.dhan.co/v2',
  WS_URL: 'wss://api-feed.dhan.co',
  ORDER_UPDATE_WS_URL: 'wss://api-order-update.dhan.co',
  DEPTH_20_WS_URL: 'wss://depth-api-feed.dhan.co/twentydepth',
  DEPTH_200_WS_URL: 'wss://full-depth-api.dhan.co/twohundreddepth',
  PARTNER_LOGIN_URL: 'https://partner-login.dhan.co',
  
  ENDPOINTS: {
    // 1. Authentication & Profile
    PROFILE: '/profile',
    TOKEN_EXCHANGE: '/oauth/token',
    RENEW_TOKEN: '/oauth/token/renew',
    
    // 2. Orders & Execution
    ORDERS: '/orders',
    ORDER_BY_ID: (orderId: string) => `/orders/${orderId}`,
    ORDER_BY_CORRELATION: (correlationId: string) => `/orders/external/${correlationId}`,
    CANCEL_ORDER: (orderId: string) => `/orders/${orderId}`,
    MODIFY_ORDER: (orderId: string) => `/orders/${orderId}`,
    ORDER_SLICING: '/orders/slicing',
    TRADES: '/trades',
    TRADE_BOOK: (orderId: string) => `/trades/${orderId}`,
    
    // 3. Super Orders (Multi-leg Entry + Target + SL + Trailing)
    SUPER_ORDERS: '/super/orders',
    SUPER_ORDER_BY_ID: (orderId: string) => `/super/orders/${orderId}`,
    CANCEL_SUPER_ORDER_LEG: (orderId: string, leg: string) => `/super/orders/${orderId}/${leg}`,
    
    // 4. Forever / GTT / OCO Orders
    FOREVER_ORDERS: '/forever/orders',
    FOREVER_ORDER_BY_ID: (orderId: string) => `/forever/orders/${orderId}`,
    
    // 5. Conditional Triggers / Alerts
    CONDITIONAL_TRIGGERS: '/alerts/orders',
    CONDITIONAL_TRIGGER_BY_ID: (alertId: string) => `/alerts/orders/${alertId}`,
    
    // 6. Portfolio & Positions
    HOLDINGS: '/holdings',
    POSITIONS: '/positions',
    CONVERT_POSITION: '/positions/convert',
    EXIT_ALL_POSITIONS: '/positions/exitall',
    
    // 7. Risk Controls / Trader's Control (Kill Switch)
    KILL_SWITCH: '/killswitch',
    
    // 8. Funds & Margin Calculation
    FUND_LIMIT: '/fundlimit',
    MARGIN_CALCULATOR: '/margincalculator',
    MARGIN_CALCULATOR_MULTI: '/margincalculator/multi',
    
    // 9. Statements & Ledger
    LEDGER: '/ledger',
    
    // 10. Market Data, Quotes & Depth
    MARKET_FEED: '/marketfeed/quote',
    MARKET_FEED_OHLC: '/marketfeed/ohlc',
    MARKET_FEED_LTP: '/marketfeed/ltp',
    CHARTS_HISTORICAL: '/charts/historical',
    CHARTS_INTRADAY: '/charts/intraday',
    CHARTS_ROLLING_OPTION: '/charts/rollingoption',
    
    // 11. Option Chain & Expiries
    OPTION_CHAIN: '/optionchain',
    OPTION_CHAIN_EXPIRIES: '/optionchain/expirylist',
    
    // 12. Security Master / Instruments
    SECURITY_LIST: '/instruments'
  },

  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },

  TIMEOUT_MS: 12000,

  RATE_LIMITS: {
    ORDER_PER_SEC: 10,
    ORDER_PER_MIN: 250,
    ORDER_PER_HOUR: 1000,
    ORDER_PER_DAY: 7000,
    DATA_PER_SEC: 5,
    DATA_PER_DAY: 100000,
    QUOTE_PER_SEC: 1
  }
};
