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
  toggleKillSwitch
} from '../controllers/brokerController';

const router = Router();

// 1. Broker Connection Management
router.post('/connect', connectBroker);
router.post('/connect-manual', connectBroker);
router.get('/list', listBrokers);
router.delete('/:brokerId', deleteBroker);

// 2. Dhan OAuth & Terminal Handshake
router.post('/dhan-login-url', getDhanLoginUrl);
router.post('/dhan-callback', handleDhanCallback);
router.post('/terminal-status', checkTerminalStatus);
router.post('/activate-terminal', checkTerminalStatus);

// 3. Account & Portfolio Operations
router.get('/funds', getFunds);
router.get('/funds/:brokerId', getFunds);
router.get('/positions', getPositions);
router.get('/positions/:brokerId', getPositions);
router.get('/orders', getOrders);
router.get('/orders/:brokerId', getOrders);

// 4. DhanHQ v2 Option Chain & Expiries
router.post('/option-chain', getOptionChain);
router.post('/option-chain/expiries', getOptionExpiries);

// 5. DhanHQ v2 Margin Calculator
router.post('/margin-calculator', calculateMargin);

// 6. DhanHQ v2 Super Orders (Multi-leg Entry + Target + SL + Trailing)
router.post('/super-orders', placeSuperOrder);

// 7. DhanHQ v2 Forever / GTT / OCO Orders
router.post('/forever-orders', placeForeverOrder);

// 8. DhanHQ v2 Conditional Trigger Orders
router.post('/conditional-triggers', placeConditionalTrigger);

// 9. DhanHQ v2 Statements & Ledger
router.get('/statements/ledger', getStatements);

// 10. DhanHQ v2 Webhook Postback
router.post('/postback', handlePostback);

// 11. DhanHQ v2 Kill Switch (Trader's Control)
router.post('/killswitch', toggleKillSwitch);

export default router;