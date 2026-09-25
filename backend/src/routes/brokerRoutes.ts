import { Router } from 'express';
import {
  connectBroker,
  listBrokers,
  getDhanLoginUrl,
  handleDhanCallback,
  checkTerminalStatus,
  getFunds,
  getPositions,
  getOrders,
  deleteBroker,
  getOptionChain,
  getOptionExpiries,
  calculateMargin,
  placeSuperOrder,
  placeForeverOrder,
  placeConditionalTrigger,
  getStatements,
  handlePostback,
  toggleKillSwitch,
  getKillSwitchStatus,
  exitAllPositions,
  convertPosition,
  placeSliceOrder,
  getTrades,
  getTradeByOrderId,
  getTradeHistory,
  getPnlExit,
  setPnlExit,
  stopPnlExit,
  getIP,
  setIP,
  modifyIP,
  generateEdisForm,
  generateEdisTpin,
  inquireEdisQty,
  getTechnicalMetrics,
  getNewsHeadlines,
  getMarketMovers,
  getCompanyInfo,
  generateDhanConsent,
  consumeDhanConsent
} from '../controllers/brokerController';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

// 1. Broker Connection Management
router.post('/connect', optionalAuth, connectBroker);
router.post('/connect-manual', optionalAuth, connectBroker);
router.get('/list', optionalAuth, listBrokers);

// 2. Dhan Official Developer API Key & Secret OAuth Flow
router.post('/dhan/generate-consent', optionalAuth, generateDhanConsent);
router.post('/dhan/consume-consent', optionalAuth, consumeDhanConsent);

// 3. Dhan Partner Legacy OAuth & Terminal Handshake
router.post('/dhan-login-url', optionalAuth, getDhanLoginUrl);
router.post('/dhan-callback', authenticate, handleDhanCallback);
router.post('/terminal-status', authenticate, checkTerminalStatus);
router.post('/activate-terminal', authenticate, checkTerminalStatus);

// 4. Account & Portfolio Operations
router.get('/funds', optionalAuth, getFunds);
router.get('/funds/:brokerId', optionalAuth, getFunds);
router.get('/positions', optionalAuth, getPositions);
router.delete('/positions', optionalAuth, exitAllPositions);
router.post('/square-off', optionalAuth, exitAllPositions);
router.post('/positions/convert', optionalAuth, convertPosition);

// 4. Orders & Tradebook
router.get('/orders', optionalAuth, getOrders);
router.get('/orders/:brokerId', optionalAuth, getOrders);
router.post('/orders/slice', optionalAuth, placeSliceOrder);
router.get('/trades', optionalAuth, getTrades);
router.get('/trades/history', optionalAuth, getTradeHistory);
router.get('/trades/:orderId', optionalAuth, getTradeByOrderId);

// 5. DhanHQ v2 Option Chain & Expiries
router.post('/option-chain', optionalAuth, getOptionChain);
router.post('/option-chain/expiries', optionalAuth, getOptionExpiries);

// 6. DhanHQ v2 Margin Calculator
router.post('/margin-calculator', optionalAuth, calculateMargin);

// 7. DhanHQ v2 Super Orders
router.post('/super-orders', authenticate, placeSuperOrder);

// 8. DhanHQ v2 Forever / GTT / OCO Orders
router.post('/forever-orders', authenticate, placeForeverOrder);

// 9. DhanHQ v2 Conditional Trigger Orders
router.post('/conditional-triggers', authenticate, placeConditionalTrigger);

// 10. DhanHQ v2 Statements & Ledger
router.get('/statements/ledger', authenticate, getStatements);

// 11. DhanHQ v2 Webhook Postback (Public incoming broker postback)
router.post('/postback', handlePostback);

// 12. DhanHQ v2 Risk Controls (Kill Switch & P&L Exit)
router.get('/killswitch', authenticate, getKillSwitchStatus);
router.post('/killswitch', authenticate, toggleKillSwitch);
router.get('/pnl-exit', authenticate, getPnlExit);
router.post('/pnl-exit', authenticate, setPnlExit);
router.delete('/pnl-exit', authenticate, stopPnlExit);

// 13. DhanHQ v2 Static IP Setup
router.get('/ip', optionalAuth, getIP);
router.post('/ip', optionalAuth, setIP);
router.put('/ip', optionalAuth, modifyIP);

// 14. DhanHQ v2 EDIS Flow
router.post('/edis/form', authenticate, generateEdisForm);
router.post('/edis/tpin', authenticate, generateEdisTpin);
router.get('/edis/inquire/:isin', authenticate, inquireEdisQty);

// 15. DhanHQ v2 Data APIs
router.post('/data/technical', optionalAuth, getTechnicalMetrics);
router.post('/data/news', optionalAuth, getNewsHeadlines);
router.post('/data/market-movers', optionalAuth, getMarketMovers);
router.post('/data/company-info', optionalAuth, getCompanyInfo);

// 16. Disconnect Broker (Parameterized route at bottom)
router.delete('/:brokerId', optionalAuth, deleteBroker);

export default router;