import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    Alert,
    CircularProgress,
    Grid
} from '@mui/material';
import { Add, Edit, Delete, PlayArrow, Pause, Close } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import firestoreService, { Strategy } from '../services/firestoreService';
import Layout from '../components/Layout';

const Strategies: React.FC = () => {
    const navigate = useNavigate();
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        symbol: '',
        instrumentType: 'EQUITY',
        timeframe: '5m',
        entryRule: '',
        exitRule: '',
        stopLossPercent: 2,
        targetPercent: 5,
        positionSize: 1
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadStrategies();
    }, []);

    const loadStrategies = async () => {
        try {
            setLoading(true);
            const user = auth.currentUser;
            if (user) {
                const data = await firestoreService.getStrategies(user.uid);
                setStrategies(data);
            }
        } catch (err) {
            console.error('Error loading strategies:', err);
            setError('Failed to load strategies');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (strategy?: Strategy) => {
        if (strategy) {
            setEditingStrategy(strategy);
            setFormData({
                name: strategy.name,
                description: strategy.description,
                symbol: strategy.symbol,
                instrumentType: strategy.instrumentType,
                timeframe: strategy.timeframe,
                entryRule: strategy.entryRule,
                exitRule: strategy.exitRule,
                stopLossPercent: strategy.stopLossPercent || 2,
                targetPercent: strategy.targetPercent || 5,
                positionSize: strategy.positionSize || 1
            });
        } else {
            setEditingStrategy(null);
            setFormData({
                name: '',
                description: '',
                symbol: '',
                instrumentType: 'EQUITY',
                timeframe: '5m',
                entryRule: '',
                exitRule: '',
                stopLossPercent: 2,
                targetPercent: 5,
                positionSize: 1
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingStrategy(null);
        setError('');
        setSuccess('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async () => {
        try {
            const user = auth.currentUser;
            if (!user) {
                setError('You must be logged in');
                return;
            }

            if (!formData.name || !formData.symbol) {
                setError('Please fill in all required fields');
                return;
            }

            const strategyData = {
                name: formData.name,
                description: formData.description,
                instrumentType: formData.instrumentType,
                symbol: formData.symbol,
                timeframe: formData.timeframe,
                entryRule: formData.entryRule,
                exitRule: formData.exitRule,
                stopLossPercent: Number(formData.stopLossPercent),
                targetPercent: Number(formData.targetPercent),
                positionSize: Number(formData.positionSize),
                status: 'draft' as const
            };

            if (editingStrategy) {
                await firestoreService.updateStrategy(editingStrategy.id, strategyData);
                setSuccess('Strategy updated successfully!');
            } else {
                await firestoreService.addStrategy(user.uid, strategyData);
                setSuccess('Strategy created successfully!');
            }

            handleCloseDialog();
            await loadStrategies();
        } catch (err: any) {
            setError(err.message || 'Failed to save strategy');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this strategy?')) {
            try {
                await firestoreService.deleteStrategy(id);
                setSuccess('Strategy deleted successfully');
                await loadStrategies();
            } catch (err: any) {
                setError(err.message || 'Failed to delete strategy');
            }
        }
    };

    const handleToggleStatus = async (strategy: Strategy) => {
        try {
            const newStatus = strategy.status === 'live' ? 'paused' : 'live';
            await firestoreService.updateStrategy(strategy.id, { status: newStatus });
            await loadStrategies();
        } catch (err) {
            setError('Failed to update strategy status');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'live': return 'success';
            case 'paused': return 'warning';
            case 'backtested': return 'info';
            default: return 'default';
        }
    };

    return (
        <Layout>
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h4">
                        Strategies
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => handleOpenDialog()}
                    >
                        Create Strategy
                    </Button>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                        {success}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
                            {strategies.map((strategy) => (
                                <Card key={strategy.id}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                            <Typography variant="h6">
                                                {strategy.name}
                                            </Typography>
                                            <Chip
                                                label={strategy.status}
                                                color={getStatusColor(strategy.status)}
                                                size="small"
                                            />
                                        </Box>

                                        <Typography color="textSecondary" variant="body2" sx={{ mb: 2 }}>
                                            {strategy.description}
                                        </Typography>

                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            <Typography variant="body2">
                                                <strong>Symbol:</strong> {strategy.symbol}
                                            </Typography>
                                            <Typography variant="body2">
                                                <strong>Timeframe:</strong> {strategy.timeframe}
                                            </Typography>
                                            <Typography variant="body2">
                                                <strong>Stop Loss:</strong> {strategy.stopLossPercent}%
                                            </Typography>
                                            <Typography variant="body2">
                                                <strong>Target:</strong> {strategy.targetPercent}%
                                            </Typography>
                                        </Box>
                                    </CardContent>

                                    <CardActions>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleToggleStatus(strategy)}
                                            color={strategy.status === 'live' ? 'error' : 'success'}
                                        >
                                            {strategy.status === 'live' ? <Pause /> : <PlayArrow />}
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleOpenDialog(strategy)}>
                                            <Edit />
                                        </IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDelete(strategy.id)}>
                                            <Delete />
                                        </IconButton>
                                    </CardActions>
                                </Card>
                            ))}
                        </Box>

                        {strategies.length === 0 && !loading && (
                            <Box sx={{ textAlign: 'center', py: 8 }}>
                                <Typography variant="h6" color="textSecondary" gutterBottom>
                                    No strategies yet
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                                    Create your first trading strategy to get started
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<Add />}
                                    onClick={() => handleOpenDialog()}
                                >
                                    Create Strategy
                                </Button>
                            </Box>
                        )}
                    </>
                )}

                {/* Create/Edit Dialog */}
                <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                    <DialogTitle>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6">
                                {editingStrategy ? 'Edit Strategy' : 'Create New Strategy'}
                            </Typography>
                            <IconButton onClick={handleCloseDialog}>
                                <Close />
                            </IconButton>
                        </Box>
                    </DialogTitle>

                    <DialogContent>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                            {/* Strategy Name */}
                            <TextField
                                fullWidth
                                label="Strategy Name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="e.g., NIFTY Breakout Strategy"
                            />

                            {/* Description */}
                            <TextField
                                fullWidth
                                label="Description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                multiline
                                rows={2}
                                placeholder="Brief description of your strategy"
                            />

                            {/* Symbol */}
                            <TextField
                                fullWidth
                                label="Symbol"
                                name="symbol"
                                value={formData.symbol}
                                onChange={handleChange}
                                required
                                placeholder="e.g., NIFTY 50, BANKNIFTY, RELIANCE"
                            />

                            {/* Instrument Type */}
                            <TextField
                                fullWidth
                                select
                                label="Instrument Type"
                                name="instrumentType"
                                value={formData.instrumentType}
                                onChange={handleChange}
                            >
                                <MenuItem value="EQUITY">Equity</MenuItem>
                                <MenuItem value="FUTURES">Futures</MenuItem>
                                <MenuItem value="OPTIONS">Options</MenuItem>
                                <MenuItem value="CURRENCY">Currency</MenuItem>
                            </TextField>

                            {/* Timeframe */}
                            <TextField
                                fullWidth
                                select
                                label="Timeframe"
                                name="timeframe"
                                value={formData.timeframe}
                                onChange={handleChange}
                            >
                                <MenuItem value="1m">1 Minute</MenuItem>
                                <MenuItem value="3m">3 Minutes</MenuItem>
                                <MenuItem value="5m">5 Minutes</MenuItem>
                                <MenuItem value="15m">15 Minutes</MenuItem>
                                <MenuItem value="30m">30 Minutes</MenuItem>
                                <MenuItem value="1h">1 Hour</MenuItem>
                                <MenuItem value="1d">1 Day</MenuItem>
                            </TextField>

                            {/* Entry Rule */}
                            <TextField
                                fullWidth
                                label="Entry Rule"
                                name="entryRule"
                                value={formData.entryRule}
                                onChange={handleChange}
                                multiline
                                rows={2}
                                placeholder="e.g., Buy when RSI crosses above 30"
                            />

                            {/* Exit Rule */}
                            <TextField
                                fullWidth
                                label="Exit Rule"
                                name="exitRule"
                                value={formData.exitRule}
                                onChange={handleChange}
                                multiline
                                rows={2}
                                placeholder="e.g., Sell when RSI crosses below 70"
                            />

                            {/* Risk Management */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Stop Loss (%)"
                                    name="stopLossPercent"
                                    type="number"
                                    value={formData.stopLossPercent}
                                    onChange={handleChange}
                                    inputProps={{ min: 0, step: 0.1 }}
                                />

                                <TextField
                                    fullWidth
                                    label="Target (%)"
                                    name="targetPercent"
                                    type="number"
                                    value={formData.targetPercent}
                                    onChange={handleChange}
                                    inputProps={{ min: 0, step: 0.1 }}
                                />
                            </Box>

                            {/* Position Size */}
                            <TextField
                                fullWidth
                                label="Position Size (Quantity)"
                                name="positionSize"
                                type="number"
                                value={formData.positionSize}
                                onChange={handleChange}
                                inputProps={{ min: 1 }}
                                helperText="Number of shares/contracts to trade"
                            />
                        </Box>
                    </DialogContent>

                    <DialogActions sx={{ p: 3 }}>
                        <Button onClick={handleCloseDialog}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={!formData.name || !formData.symbol}
                        >
                            {editingStrategy ? 'Update' : 'Create'} Strategy
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Layout>
    );
};

export default Strategies;
