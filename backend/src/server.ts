import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
// import { rateLimiter } from './middleware/rateLimiter';

// Load environment variables
dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim());

// Explicit CORS headers for all responses, including errors and 404s
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
// app.use(rateLimiter);

// Health check endpoint
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        message: 'Server is running with Firebase backend'
    });
});

// Import routes
import marketRoutes from './routes/market';
import oauthRoutes from './routes/oauthRoutes';
import brokerRoutes from './routes/brokerRoutes';
import strategyTestRoutes from './routes/strategyTest';
import strategyRoutes from './routes/strategyRoutes';

// API Routes
app.get('/api', (_req, res) => {
    res.json({
        message: 'Algo Trading Platform',
        market: 'GET /api/market/all - Get all stocks + indices'
    });
});

// Market data - ONE simple endpoint
app.use('/api/market', marketRoutes);

// OAuth routes
app.use('/api/oauth', oauthRoutes);

// Broker routes
app.use('/api/broker', brokerRoutes);

// Strategy testing routes
app.use('/api/strategy-test', strategyTestRoutes);

// Strategy management routes
app.use('/api/strategies', strategyRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Make io accessible to routes
app.set('io', io);

// Start server
const startServer = async () => {
    try {
        logger.info('Starting server with Firebase backend...');
        logger.info('Note: Using Firebase for auth and Firestore for database');
        logger.info('PostgreSQL not required for this setup');

        // Start listening
        httpServer.listen(PORT, () => {
            logger.info(`✅ Server running on port ${PORT}`);
            logger.info(`✅ Market Data: GET /api/market/all`);
            logger.info(`✅ Health: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
    logger.error('Unhandled Promise Rejection:', err);
    // Don't exit, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception:', err);
    // Don't exit, just log the error
});

startServer();

export { app, io };
