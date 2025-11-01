import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Paper,
    TextField,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    FormControlLabel,
    Radio,
    RadioGroup,
    Alert,
    CircularProgress,
    Divider,
    Stack,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import {
    Save,
    ArrowBack,
    Add,
    Delete,
    AccessTime,
    Print
} from '@mui/icons-material';
import Layout from '../components/Layout';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CreateStrategy: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Strategy Type
    const [strategyType, setStrategyType] = useState<'time-based' | 'indicator-based'>('time-based');
    
    // Instruments
    const [instruments, setInstruments] = useState<string[]>([]);
    const [instrumentDialogOpen, setInstrumentDialogOpen] = useState(false);
    const [selectedInstrumentType, setSelectedInstrumentType] = useState('OPTIONS');
    
    // Time Based Fields
    const [orderType, setOrderType] = useState('MIS');
    const [startTime, setStartTime] = useState('09:16');
    const [squareOffTime, setSquareOffTime] = useState('03:15');
    const [tradingDays, setTradingDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    
    // Indicator Based Fields
    const [transactionType, setTransactionType] = useState('Both Side');
    const [chartType, setChartType] = useState('Candle');
    const [interval, setInterval] = useState('5 Min');
    const [longEntryConditions, setLongEntryConditions] = useState<any[]>([]);
    const [shortEntryConditions, setShortEntryConditions] = useState<any[]>([]);
    
    // Risk Management
    const [exitOnProfit, setExitOnProfit] = useState('');
    const [exitOnLoss, setExitOnLoss] = useState('');
    const [maxTradeCycle, setMaxTradeCycle] = useState('1');
    const [noTradeAfter, setNoTradeAfter] = useState('03:15');
    const [profitTrailing, setProfitTrailing] = useState('No Trailing');
    
    // Strategy Name
    const [strategyName, setStrategyName] = useState('');

    // Pre-fill from template
    useEffect(() => {
        const template = (location.state as any)?.template;
        if (template) {
            setStrategyName(template.name || '');
            if (template.instrumentType === 'OPTIONS') {
                setSelectedInstrumentType('OPTIONS');
            }
        }
    }, [location]);

    const handleAddInstrument = () => {
        setInstrumentDialogOpen(true);
    };

    const handleSelectInstrument = (instrument: string) => {
        if (!instruments.includes(instrument)) {
            setInstruments([...instruments, instrument]);
        }
        setInstrumentDialogOpen(false);
    };

    const handleRemoveInstrument = (instrument: string) => {
        setInstruments(instruments.filter(i => i !== instrument));
    };

    const handleDayToggle = (day: string) => {
        if (tradingDays.includes(day)) {
            setTradingDays(tradingDays.filter(d => d !== day));
        } else {
            setTradingDays([...tradingDays, day]);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Please login to create a strategy');
                setLoading(false);
                return;
            }

            const strategyData = {
                name: strategyName,
                strategyType,
                instruments,
                orderType,
                startTime,
                squareOffTime,
                tradingDays,
                transactionType,
                chartType,
                interval,
                exitOnProfit,
                exitOnLoss,
                maxTradeCycle,
                noTradeAfter,
                profitTrailing
            };

            const response = await axios.post(
                `${API_URL}/api/strategies`,
                strategyData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.data.success) {
                setSuccess(true);
                setTimeout(() => {
                    navigate('/strategies');
                }, 1500);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create strategy');
        } finally {
            setLoading(false);
        }
    };

    const availableInstruments = ['NIFTY 50', 'NIFTY BANK', 'NIFTY FIN SERVICE', 'SENSEX'];

    return (
        <Layout>
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Box mb={3}>
                    <Button
                        startIcon={<ArrowBack />}
                        onClick={() => navigate('/strategies')}
                        sx={{ mb: 2 }}
                    >
                        Back to Strategies
                    </Button>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                        Strategy created successfully! Redirecting...
                    </Alert>
                )}

                <Paper elevation={2} sx={{ p: 4 }}>
                    <Stack spacing={4}>
                        {/* Strategy Type */}
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Strategy Type
                            </Typography>
                            <ToggleButtonGroup
                                value={strategyType}
                                exclusive
                                onChange={(e, value) => value && setStrategyType(value)}
                                sx={{ mt: 1 }}
                            >
                                <ToggleButton value="time-based">
                                    Time Based
                                </ToggleButton>
                                <ToggleButton value="indicator-based">
                                    Indicator Based
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        {/* Select Instruments */}
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Select Instruments
                            </Typography>
                            <Box display="flex" gap={2} flexWrap="wrap" mt={2}>
                                {instruments.map((instrument) => (
                                    <Chip
                                        key={instrument}
                                        label={instrument}
                                        onDelete={() => handleRemoveInstrument(instrument)}
                                        color="primary"
                                    />
                                ))}
                                <Button
                                    variant="outlined"
                                    startIcon={<Add />}
                                    onClick={handleAddInstrument}
                                    sx={{ borderStyle: 'dashed' }}
                                >
                                    Add Instruments
                                </Button>
                            </Box>
                        </Box>

                        {strategyType === 'time-based' && (
                            <>
                                {/* Order Type, Start Time, Square Off */}
                                <Box display="flex" gap={2} flexWrap="wrap">
                                    <Box flex="1" minWidth="200px">
                                        <Typography variant="caption" color="text.secondary">
                                            Order Type
                                        </Typography>
                                        <RadioGroup
                                            row
                                            value={orderType}
                                            onChange={(e) => setOrderType(e.target.value)}
                                        >
                                            <FormControlLabel value="MIS" control={<Radio />} label="MIS" />
                                            <FormControlLabel value="CNC" control={<Radio />} label="CNC" />
                                            <FormControlLabel value="BTST" control={<Radio />} label="BTST" />
                                        </RadioGroup>
                                    </Box>

                                    <Box flex="1" minWidth="150px">
                                        <Typography variant="caption" color="text.secondary">
                                            Start time
                                        </Typography>
                                        <TextField
                                            type="time"
                                            fullWidth
                                            size="small"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            sx={{ mt: 0.5 }}
                                        />
                                    </Box>

                                    <Box flex="1" minWidth="150px">
                                        <Typography variant="caption" color="text.secondary">
                                            Square off
                                        </Typography>
                                        <TextField
                                            type="time"
                                            fullWidth
                                            size="small"
                                            value={squareOffTime}
                                            onChange={(e) => setSquareOffTime(e.target.value)}
                                            sx={{ mt: 0.5 }}
                                        />
                                    </Box>
                                </Box>

                                {/* Trading Days */}
                                <Box>
                                    <Box display="flex" gap={1} flexWrap="wrap">
                                        {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day) => (
                                            <Chip
                                                key={day}
                                                label={day}
                                                onClick={() => handleDayToggle(day)}
                                                color={tradingDays.includes(day) ? 'primary' : 'default'}
                                                variant={tradingDays.includes(day) ? 'filled' : 'outlined'}
                                            />
                                        ))}
                                    </Box>
                                </Box>

                                {/* Readymade Templates Link */}
                                <Box>
                                    <Button
                                        variant="text"
                                        onClick={() => navigate('/strategies/templates')}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Readymade Templates ↗
                                    </Button>
                                </Box>
                            </>
                        )}

                        {strategyType === 'indicator-based' && (
                            <>
                                {/* Transaction Type, Chart Type, Interval */}
                                <Box display="flex" gap={2} flexWrap="wrap">
                                    <Box flex="1" minWidth="200px">
                                        <Typography variant="caption" color="text.secondary">
                                            Transaction type
                                        </Typography>
                                        <ToggleButtonGroup
                                            value={transactionType}
                                            exclusive
                                            onChange={(e, value) => value && setTransactionType(value)}
                                            size="small"
                                            fullWidth
                                            sx={{ mt: 0.5 }}
                                        >
                                            <ToggleButton value="Both Side">Both Side</ToggleButton>
                                            <ToggleButton value="Only Long">Only Long</ToggleButton>
                                            <ToggleButton value="Only Short">Only Short</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>

                                    <Box flex="1" minWidth="150px">
                                        <Typography variant="caption" color="text.secondary">
                                            Chart type
                                        </Typography>
                                        <ToggleButtonGroup
                                            value={chartType}
                                            exclusive
                                            onChange={(e, value) => value && setChartType(value)}
                                            size="small"
                                            fullWidth
                                            sx={{ mt: 0.5 }}
                                        >
                                            <ToggleButton value="Candle">Candle</ToggleButton>
                                            <ToggleButton value="Heikin Ashi">Heikin Ashi</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>

                                    <Box flex="1" minWidth="150px">
                                        <Typography variant="caption" color="text.secondary">
                                            Interval
                                        </Typography>
                                        <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                                            {['1 Min', '3 Min', '5 Min', '10 Min', '15 Min', '30 Min', '1 H'].map((int) => (
                                                <Chip
                                                    key={int}
                                                    label={int}
                                                    size="small"
                                                    onClick={() => setInterval(int)}
                                                    color={interval === int ? 'primary' : 'default'}
                                                    variant={interval === int ? 'filled' : 'outlined'}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Entry Conditions */}
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                        Entry conditions
                                    </Typography>
                                    <FormControlLabel
                                        control={<Checkbox />}
                                        label="Use Combined Chart"
                                    />

                                    <Box mt={2}>
                                        <Typography variant="body2" color="success.main" gutterBottom>
                                            Long Entry condition
                                        </Typography>
                                        <Box display="flex" gap={2} mb={2}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Select Indicator</InputLabel>
                                                <Select label="Select Indicator">
                                                    <MenuItem value="RSI">RSI</MenuItem>
                                                    <MenuItem value="MACD">MACD</MenuItem>
                                                    <MenuItem value="EMA">EMA</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Select Comparator</InputLabel>
                                                <Select label="Select Comparator">
                                                    <MenuItem value=">">Greater Than</MenuItem>
                                                    <MenuItem value="<">Less Than</MenuItem>
                                                    <MenuItem value="=">Equal To</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Select Indicator</InputLabel>
                                                <Select label="Select Indicator">
                                                    <MenuItem value="Value">Value</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>

                                        <Typography variant="body2" color="error.main" gutterBottom>
                                            Short Entry condition
                                        </Typography>
                                        <Box display="flex" gap={2} mb={2}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Select Indicator</InputLabel>
                                                <Select label="Select Indicator">
                                                    <MenuItem value="RSI">RSI</MenuItem>
                                                    <MenuItem value="MACD">MACD</MenuItem>
                                                    <MenuItem value="EMA">EMA</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Select Comparator</InputLabel>
                                                <Select label="Select Comparator">
                                                    <MenuItem value=">">Greater Than</MenuItem>
                                                    <MenuItem value="<">Less Than</MenuItem>
                                                    <MenuItem value="=">Equal To</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Select Indicator</InputLabel>
                                                <Select label="Select Indicator">
                                                    <MenuItem value="Value">Value</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>

                                        <Button variant="outlined" size="small">
                                            Add Condition +
                                        </Button>
                                    </Box>

                                    <FormControlLabel
                                        control={<Checkbox />}
                                        label="Exit conditions (Optional)"
                                        sx={{ mt: 2 }}
                                    />
                                </Box>

                                {/* Option Position Builder */}
                                <Box>
                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            Option Position builder
                                        </Typography>
                                        <Button variant="contained" size="small" startIcon={<Add />}>
                                            Add leg +
                                        </Button>
                                    </Box>
                                    <FormControlLabel
                                        control={<Checkbox />}
                                        label="Add Signal Candle Condition (Optional)"
                                        sx={{ mt: 1 }}
                                    />
                                </Box>
                            </>
                        )}

                        {/* Risk Management */}
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Risk management
                            </Typography>
                            <Box display="flex" gap={2} flexWrap="wrap" mt={2}>
                                <TextField
                                    label="Exit When Over All Profit In Amount (INR)"
                                    size="small"
                                    value={exitOnProfit}
                                    onChange={(e) => setExitOnProfit(e.target.value)}
                                    sx={{ flex: 1, minWidth: '200px' }}
                                />
                                <TextField
                                    label="Exit When Over All Loss In Amount(INR)"
                                    size="small"
                                    value={exitOnLoss}
                                    onChange={(e) => setExitOnLoss(e.target.value)}
                                    sx={{ flex: 1, minWidth: '200px' }}
                                />
                                <TextField
                                    label="Max Trade Cycle"
                                    size="small"
                                    value={maxTradeCycle}
                                    onChange={(e) => setMaxTradeCycle(e.target.value)}
                                    sx={{ flex: 1, minWidth: '150px' }}
                                />
                                <Box flex="1" minWidth="150px">
                                    <Typography variant="caption" color="text.secondary">
                                        No Trade After
                                    </Typography>
                                    <TextField
                                        type="time"
                                        fullWidth
                                        size="small"
                                        value={noTradeAfter}
                                        onChange={(e) => setNoTradeAfter(e.target.value)}
                                        sx={{ mt: 0.5 }}
                                    />
                                </Box>
                            </Box>

                            <Box mt={2}>
                                <Typography variant="caption" color="text.secondary">
                                    Profit Trailing
                                </Typography>
                                <RadioGroup
                                    row
                                    value={profitTrailing}
                                    onChange={(e) => setProfitTrailing(e.target.value)}
                                >
                                    <FormControlLabel value="No Trailing" control={<Radio />} label="No Trailing" />
                                    <FormControlLabel value="Lock Fix Profit" control={<Radio />} label="Lock Fix Profit" />
                                    <FormControlLabel value="Trail Profit" control={<Radio />} label="Trail Profit" />
                                    <FormControlLabel value="Lock and Trail" control={<Radio />} label="Lock and Trail" />
                                </RadioGroup>
                            </Box>
                        </Box>

                        {/* Strategy Name */}
                        <TextField
                            label="Strategy name"
                            fullWidth
                            value={strategyName}
                            onChange={(e) => setStrategyName(e.target.value)}
                            placeholder="Enter strategy name"
                        />

                        {/* Action Buttons */}
                        <Box display="flex" gap={2} justifyContent="flex-end">
                            <IconButton>
                                <Print />
                            </IconButton>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                                onClick={handleSubmit}
                                disabled={loading || !strategyName}
                            >
                                {loading ? 'Saving...' : 'Save & Continue'}
                            </Button>
                        </Box>
                    </Stack>
                </Paper>

                {/* Instrument Selection Dialog */}
                <Dialog
                    open={instrumentDialogOpen}
                    onClose={() => setInstrumentDialogOpen(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>
                        <TextField
                            fullWidth
                            placeholder="Search scripts: ie. - State Bank Of India, Banknifty, Crudeoil"
                            size="small"
                        />
                    </DialogTitle>
                    <DialogContent>
                        <Box>
                            <ToggleButtonGroup
                                value={selectedInstrumentType}
                                exclusive
                                onChange={(e, value) => value && setSelectedInstrumentType(value)}
                                size="small"
                                fullWidth
                                sx={{ mb: 2 }}
                            >
                                <ToggleButton value="OPTIONS">Options</ToggleButton>
                                <ToggleButton value="EQUITY">Equity</ToggleButton>
                                <ToggleButton value="FUTURES">Futures</ToggleButton>
                                <ToggleButton value="INDICES">Indices</ToggleButton>
                                <ToggleButton value="CDS">CDS</ToggleButton>
                                <ToggleButton value="MCX">MCX</ToggleButton>
                            </ToggleButtonGroup>
                            {selectedInstrumentType === 'OPTIONS' && (
                                <Typography variant="caption" color="text.secondary">
                                    * Only option category allowed for Time-Based strategy type
                                </Typography>
                            )}
                            <Stack spacing={1} mt={2}>
                                {availableInstruments.map((instrument) => (
                                    <Button
                                        key={instrument}
                                        variant="outlined"
                                        fullWidth
                                        onClick={() => handleSelectInstrument(instrument)}
                                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                                    >
                                        {instrument}
                                    </Button>
                                ))}
                            </Stack>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setInstrumentDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Layout>
    );
};

export default CreateStrategy;
