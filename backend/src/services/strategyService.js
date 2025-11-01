const fs = require('fs');
const path = require('path');

// Simple file-based storage (will migrate to PostgreSQL later)
const STRATEGIES_FILE = path.join(__dirname, '../../data/strategies.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize file if it doesn't exist
if (!fs.existsSync(STRATEGIES_FILE)) {
    fs.writeFileSync(STRATEGIES_FILE, JSON.stringify([], null, 2));
}

class StrategyService {
    // Load strategies from file
    loadStrategies() {
        try {
            const data = fs.readFileSync(STRATEGIES_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading strategies:', error.message);
            return [];
        }
    }

    // Save strategies to file
    saveStrategies(strategies) {
        try {
            fs.writeFileSync(STRATEGIES_FILE, JSON.stringify(strategies, null, 2));
        } catch (error) {
            console.error('Error saving strategies:', error.message);
        }
    }

    // Validate strategy data
    validateStrategy(strategyData) {
        const { name, instrumentType, timeframe, entryRule, exitRule } = strategyData;

        if (!name || name.trim().length === 0) {
            throw new Error('Strategy name is required');
        }

        if (!instrumentType) {
            throw new Error('Instrument type is required');
        }

        const validInstrumentTypes = ['EQUITY', 'FUTURES', 'OPTIONS', 'CURRENCY'];
        if (!validInstrumentTypes.includes(instrumentType)) {
            throw new Error('Invalid instrument type');
        }

        if (!timeframe) {
            throw new Error('Timeframe is required');
        }

        const validTimeframes = ['1m', '5m', '15m', '1h', '1d'];
        if (!validTimeframes.includes(timeframe)) {
            throw new Error('Invalid timeframe');
        }

        if (!entryRule || entryRule.trim().length === 0) {
            throw new Error('Entry rule is required');
        }

        if (!exitRule || exitRule.trim().length === 0) {
            throw new Error('Exit rule is required');
        }

        // Validate stop-loss and target
        if (strategyData.stopLossPercent !== undefined && strategyData.targetPercent !== undefined) {
            if (strategyData.stopLossPercent >= strategyData.targetPercent) {
                console.warn('Warning: Stop-loss percentage is greater than or equal to target percentage');
            }
        }

        return true;
    }

    // Create new strategy
    createStrategy(userId, strategyData) {
        // Validate strategy data
        this.validateStrategy(strategyData);

        const strategies = this.loadStrategies();

        const newStrategy = {
            id: `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            name: strategyData.name,
            description: strategyData.description || '',
            instrumentType: strategyData.instrumentType,
            symbol: strategyData.symbol || null,
            timeframe: strategyData.timeframe,
            entryRule: strategyData.entryRule,
            exitRule: strategyData.exitRule,
            stopLossPercent: strategyData.stopLossPercent || null,
            targetPercent: strategyData.targetPercent || null,
            positionSize: strategyData.positionSize || null,
            maxPositions: strategyData.maxPositions || 1,
            status: 'draft',
            mode: 'paper', // Default to paper trading
            deploymentStatus: 'stopped',
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Performance metrics
            totalPnL: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            // Positions
            positions: []
        };

        strategies.push(newStrategy);
        this.saveStrategies(strategies);

        console.log('✅ Strategy created successfully:', newStrategy.name);
        return newStrategy;
    }

    // Get all strategies for a user
    getStrategiesByUser(userId, filters = {}) {
        const strategies = this.loadStrategies();
        let userStrategies = strategies.filter(s => s.userId === userId);

        // Apply filters
        if (filters.status) {
            userStrategies = userStrategies.filter(s => s.status === filters.status);
        }

        if (filters.instrumentType) {
            userStrategies = userStrategies.filter(s => s.instrumentType === filters.instrumentType);
        }

        if (filters.deploymentStatus) {
            userStrategies = userStrategies.filter(s => s.deploymentStatus === filters.deploymentStatus);
        }

        return userStrategies;
    }

    // Get strategy by ID
    getStrategyById(strategyId, userId) {
        const strategies = this.loadStrategies();
        const strategy = strategies.find(s => s.id === strategyId && s.userId === userId);

        if (!strategy) {
            throw new Error('Strategy not found');
        }

        return strategy;
    }

    // Update strategy
    updateStrategy(strategyId, userId, updates) {
        const strategies = this.loadStrategies();
        const strategyIndex = strategies.findIndex(s => s.id === strategyId && s.userId === userId);

        if (strategyIndex === -1) {
            throw new Error('Strategy not found');
        }

        const strategy = strategies[strategyIndex];

        // Prevent editing live strategies
        if (strategy.deploymentStatus === 'running') {
            throw new Error('Cannot edit a running strategy. Please stop it first.');
        }

        // Validate updates if they include strategy rules
        if (updates.entryRule || updates.exitRule || updates.instrumentType || updates.timeframe) {
            const updatedData = { ...strategy, ...updates };
            this.validateStrategy(updatedData);
        }

        // Update allowed fields
        const allowedFields = [
            'name', 'description', 'instrumentType', 'symbol', 'timeframe',
            'entryRule', 'exitRule', 'stopLossPercent', 'targetPercent',
            'positionSize', 'maxPositions'
        ];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                strategies[strategyIndex][field] = updates[field];
            }
        });

        strategies[strategyIndex].updatedAt = new Date().toISOString();
        strategies[strategyIndex].version += 1;

        this.saveStrategies(strategies);

        console.log('✅ Strategy updated successfully:', strategy.name);
        return strategies[strategyIndex];
    }

    // Delete strategy
    deleteStrategy(strategyId, userId) {
        const strategies = this.loadStrategies();
        const strategyIndex = strategies.findIndex(s => s.id === strategyId && s.userId === userId);

        if (strategyIndex === -1) {
            throw new Error('Strategy not found');
        }

        const strategy = strategies[strategyIndex];

        // Prevent deleting running strategies
        if (strategy.deploymentStatus === 'running') {
            throw new Error('Cannot delete a running strategy. Please stop it first.');
        }

        strategies.splice(strategyIndex, 1);
        this.saveStrategies(strategies);

        console.log('✅ Strategy deleted successfully:', strategy.name);
        return { message: 'Strategy deleted successfully' };
    }

    // Clone strategy
    cloneStrategy(strategyId, userId) {
        const strategy = this.getStrategyById(strategyId, userId);

        const clonedStrategy = {
            ...strategy,
            id: `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${strategy.name} (Copy)`,
            status: 'draft',
            deploymentStatus: 'stopped',
            mode: 'paper',
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Reset performance metrics
            totalPnL: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            positions: []
        };

        const strategies = this.loadStrategies();
        strategies.push(clonedStrategy);
        this.saveStrategies(strategies);

        console.log('✅ Strategy cloned successfully:', clonedStrategy.name);
        return clonedStrategy;
    }

    // Update strategy status
    updateStrategyStatus(strategyId, userId, status) {
        const strategies = this.loadStrategies();
        const strategyIndex = strategies.findIndex(s => s.id === strategyId && s.userId === userId);

        if (strategyIndex === -1) {
            throw new Error('Strategy not found');
        }

        const validStatuses = ['draft', 'backtested', 'live', 'archived'];
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid status');
        }

        strategies[strategyIndex].status = status;
        strategies[strategyIndex].updatedAt = new Date().toISOString();

        this.saveStrategies(strategies);

        console.log('✅ Strategy status updated:', status);
        return strategies[strategyIndex];
    }

    // Update deployment status (running, paused, stopped)
    updateDeploymentStatus(strategyId, userId, deploymentStatus) {
        const strategies = this.loadStrategies();
        const strategyIndex = strategies.findIndex(s => s.id === strategyId && s.userId === userId);

        if (strategyIndex === -1) {
            throw new Error('Strategy not found');
        }

        const validStatuses = ['running', 'paused', 'stopped'];
        if (!validStatuses.includes(deploymentStatus)) {
            throw new Error('Invalid deployment status');
        }

        strategies[strategyIndex].deploymentStatus = deploymentStatus;
        strategies[strategyIndex].updatedAt = new Date().toISOString();

        this.saveStrategies(strategies);

        console.log('✅ Strategy deployment status updated:', deploymentStatus);
        return strategies[strategyIndex];
    }

    // Update strategy mode (live/paper)
    updateStrategyMode(strategyId, userId, mode) {
        const strategies = this.loadStrategies();
        const strategyIndex = strategies.findIndex(s => s.id === strategyId && s.userId === userId);

        if (strategyIndex === -1) {
            throw new Error('Strategy not found');
        }

        const validModes = ['live', 'paper'];
        if (!validModes.includes(mode)) {
            throw new Error('Invalid mode');
        }

        strategies[strategyIndex].mode = mode;
        strategies[strategyIndex].updatedAt = new Date().toISOString();

        this.saveStrategies(strategies);

        console.log('✅ Strategy mode updated:', mode);
        return strategies[strategyIndex];
    }

    // Add position to strategy
    addPosition(strategyId, userId, positionData) {
        const strategies = this.loadStrategies();
        const strategyIndex = strategies.findIndex(s => s.id === strategyId && s.userId === userId);

        if (strategyIndex === -1) {
            throw new Error('Strategy not found');
        }

        const position = {
            id: `position_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...positionData,
            timestamp: new Date().toISOString()
        };

        strategies[strategyIndex].positions.push(position);
        strategies[strategyIndex].updatedAt = new Date().toISOString();

        this.saveStrategies(strategies);

        return position;
    }

    // Update position
    updatePosition(strategyId, userId, positionId, updates) {
        const strategies = this.loadStrategies();
        const strategyIndex = strategies.findIndex(s => s.id === strategyId && s.userId === userId);

        if (strategyIndex === -1) {
            throw new Error('Strategy not found');
        }

        const positionIndex = strategies[strategyIndex].positions.findIndex(p => p.id === positionId);

        if (positionIndex === -1) {
            throw new Error('Position not found');
        }

        Object.assign(strategies[strategyIndex].positions[positionIndex], updates);
        strategies[strategyIndex].updatedAt = new Date().toISOString();

        this.saveStrategies(strategies);

        return strategies[strategyIndex].positions[positionIndex];
    }
}

module.exports = new StrategyService();
