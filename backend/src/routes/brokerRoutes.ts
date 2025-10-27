/**
 * Broker Routes - DHAN Integration (AlgoRooms Style)
 */

import { Router } from 'express';
import {
    connectBroker,
    listBrokers,
    activateTerminal,
    checkTerminalStatus,
    toggleTerminal,
    toggleTradingEngine,
    reconnectBroker,
    deleteBroker,
    placeOrder,
    getOrders,
    getPositions
} from '../controllers/brokerController';

const router = Router();

// Broker connection management
router.post('/connect', connectBroker);
router.get('/list', listBrokers);
router.post('/reconnect', reconnectBroker);
router.delete('/:brokerId', deleteBroker);

// Terminal and Trading Engine toggles
router.post('/activate-terminal', activateTerminal);
router.post('/terminal-status', checkTerminalStatus);
router.post('/terminal', toggleTerminal);
router.post('/tradingEngine', toggleTradingEngine);

// Trading operations
router.post('/order', placeOrder);
router.get('/orders/:brokerId', getOrders);
router.get('/positions/:brokerId', getPositions);

export default router;