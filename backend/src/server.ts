import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { paperExecutor } from './execution/PaperExecutor';
import { killSwitch } from './risk/KillSwitch';
import { brokerRegistry } from './brokers/BrokerRegistry';

// Load environment variables
dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map(o => o.trim());

// Explicit CORS headers for all responses
app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
    }
    next();
});

const io = new SocketIOServer(httpServer, {
    cors: {
        origin: allowedOrigins.length ? allowedOrigins : true,
        credentials: true
    }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        platform: 'Home-Treding Dhan-First Automation',
        mode: process.env.TRADING_MODE || 'paper',
        liveTradingEnabled: process.env.LIVE_TRADING_ENABLED === 'true',
        killSwitch: killSwitch.getStatus(),
        timestamp: new Date().toISOString()
    });
});

// Import routes
import marketRoutes from './routes/market';
import oauthRoutes from './routes/oauthRoutes';
import brokerRoutes from './routes/brokerRoutes';
import paperRoutes from './routes/paperRoutes';
import riskRoutes from './routes/riskRoutes';
import strategyTestRoutes from './routes/strategyTest';
import strategyRoutes from './routes/strategyRoutes';
import tradingRoutes from './routes/tradingRoutes';
import backtestRoutes from './routes/backtestRoutes';

// API Info Route
app.get('/api', (_req, res) => {
    res.json({
        platform: 'Home-Treding Trading Automation API',
        version: '3.0.0',
        broker: 'DhanHQ v2',
        endpoints: {
            brokers: '/api/brokers',
            paper: '/api/paper',
            risk: '/api/risk',
            market: '/api/market',
            strategies: '/api/strategies',
            trading: '/api/trading',
            backtest: '/api/backtest'
        }
    });
});

// Register API Routes
app.use('/api/market', marketRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/brokers', brokerRoutes);
app.use('/api/paper', paperRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/strategy-test', strategyTestRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/backtest', backtestRoutes);

// Socket.IO event handling
io.on('connection', (socket) => {
    logger.info(`🔌 Client connected to Socket.IO: ${socket.id}`);

    // Send initial status
    socket.emit('system_status', {
        mode: process.env.TRADING_MODE || 'paper',
        killSwitch: killSwitch.getStatus()
    });

    socket.on('subscribe_market_data', (symbols: string[]) => {
        if (Array.isArray(symbols)) {
            symbols.forEach(sym => socket.join(`market_${sym}`));
            logger.info(`📊 Socket ${socket.id} subscribed to: ${symbols.join(', ')}`);
        }
    });

    socket.on('disconnect', () => {
        logger.info(`🔌 Client disconnected: ${socket.id}`);
    });
});

// Wire Paper Executor Events to Socket.IO
paperExecutor.on('orderFilled', (order) => {
    io.emit('paper_order_filled', order);
});

paperExecutor.on('positionUpdated', (position) => {
    io.emit('paper_position_updated', position);
});

killSwitch.on('halted', (status) => {
    io.emit('kill_switch_halted', status);
});

killSwitch.on('resumed', () => {
    io.emit('kill_switch_resumed', { isHalted: false });
});

// Error handling middleware
app.use(errorHandler);

// Make io accessible
app.set('io', io);

import { MarketStreamer } from './services/marketStreamer';
import { nifty009Engine } from './strategies/nifty009/Nifty009Engine';

// Start server
const startServer = async () => {
    try {
        httpServer.listen(PORT, () => {
            logger.info(`====================================================`);
            logger.info(`🚀 HOME-TREDING PLATFORM RUNNING`);
            logger.info(`📡 Port: ${PORT}`);
            logger.info(`🛡️ Mode: ${process.env.TRADING_MODE || 'paper'} (Live Enabled: ${process.env.LIVE_TRADING_ENABLED === 'true'})`);
            logger.info(`🔗 Brokers API: http://localhost:${PORT}/api/brokers/list`);
            logger.info(`📝 Paper API: http://localhost:${PORT}/api/paper/portfolio`);
            logger.info(`📊 NIFTY 0.09% Strategy: http://localhost:${PORT}/api/strategies/nifty009/status`);
            logger.info(`====================================================`);

            // Start high-frequency live market tick broadcasting (800ms)
            const streamer = new MarketStreamer(io);
            streamer.start(800);
        });

        // Wire Nifty009Engine events to Socket.IO
        nifty009Engine.on('status', (status: any) => {
            io.emit('nifty009:status', status);
        });

        nifty009Engine.on('candle', (candle: any) => {
            io.emit('nifty009:candle', candle);
        });

        nifty009Engine.on('signal', (signal: any) => {
            io.emit('nifty009:signal', signal);
        });

        nifty009Engine.on('order', (order: any) => {
            io.emit('nifty009:order', order);
        });

        nifty009Engine.on('event', (event: any) => {
            io.emit('nifty009:event', event);
        });

        nifty009Engine.on('atmLocked', (atm: any) => {
            io.emit('nifty009:atm_locked', atm);
        });

        nifty009Engine.on('report', (report: any) => {
            io.emit('nifty009:report', report);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};


process.on('SIGTERM', () => {
    httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    httpServer.close(() => process.exit(0));
});

process.on('unhandledRejection', (err: Error) => {
    logger.error('Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception:', err);
});

startServer();

export { app, io, httpServer };
