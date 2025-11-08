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
    Stack,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    useMediaQuery,
    useTheme
} from '@mui/material';
import {
    Save,
    ArrowBack,
    Add,
    Print
} from '@mui/icons-material';
import Layout from '../components/Layout';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CreateStrategy: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
            <Container 
                maxWidth="lg" 
                sx={{ 
                    mt: { xs: 2, sm: 3, md: 4 }, 
                    mb: { xs: 10, sm: 4 },
                    px: { xs: 1, sm: 2, md: 3 }
                }}
            >
                <Box mb={{ xs: 2, sm: 3 }}>
                    <Button
                        startIcon={<ArrowBack />}
                        onClick={() => navigate('/strategies')}
                        sx={{ 
                            mb: 2,
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                        }}
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

                <Paper elevation={2} sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
                    <Stack spacing={{ xs: 3, sm: 4 }}>
                        {/* Strategy Type */}
                        <Box>
                            <Typography 
                                variant="subtitle1" 
                                fontWeight="bold" 
                                gutterBottom
                                sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}
                            >
                                Strategy Type
                            </Typography>
                            <ToggleButtonGroup
                                value={strategyType}
                                exclusive
                                onChange={(e, value) => value && setStrategyType(value)}
                                sx={{ mt: 1 }}
                                fullWidth={isMobile}
                            >
                                <ToggleButton 
                                    value="time-based"
                                    sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                                >
                                    Time Based
                                </ToggleButton>
                                <ToggleButton 
                                    value="indicator-based"
                                    sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                                >
                                    Indicator Based
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        {/* Select Instruments */}
                        <Box>
                            <Typography 
                                variant="subtitle1" 
                                fontWeight="bold" 
                                gutterBottom
                                sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}
                            >
                                Select Instruments
                            </Typography>
                            <Box display="flex" gap={{ xs: 1, sm: 2 }} flexWrap="wrap" mt={2}>
                                {instruments.map((instrument) => (
                                    <Chip
                                        key={instrument}
                                        label={instrument}
                                        onDelete={() => handleRemoveInstrument(instrument)}
                                        color="primary"
                                        sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                                    />
                                ))}
                                <Button
                                    variant="outlined"
                                    startIcon={<Add />}
                                    onClick={handleAddInstrument}
                                    sx={{ 
                                        borderStyle: 'dashed',
                                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                                    }}
                                    size={isMobile ? 'small' : 'medium'}
                                >
                                    Add Instruments
                                </Button>
                            </Box>
                        </Box>

                        {strategyType === 'time-based' && (
                            <>
                                {/* Order Type, Start Time, Square Off */}
                                <Box 
                                    sx={{
                                        display: 'flex',
                                        flexDirection: { xs: 'column', sm: 'row' },
                                        gap: 2
                                    }}
                                >
                                    <Box flex="1">
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                        >
                                            Order Type
                                        </Typography>
                                        <RadioGroup
                                            row={!isMobile}
                                            value={orderType}
                                            onChange={(e) => setOrderType(e.target.value)}
                                        >
                                            <FormControlLabel 
                                                value="MIS" 
                                                control={<Radio size={isMobile ? 'small' : 'medium'} />} 
                                                label={<Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>MIS</Typography>}
                                            />
                                            <FormControlLabel 
                                                value="CNC" 
                                                control={<Radio size={isMobile ? 'small' : 'medium'} />} 
                                                label={<Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>CNC</Typography>}
                                            />
                                            <FormControlLabel 
                                                value="BTST" 
                                                control={<Radio size={isMobile ? 'small' : 'medium'} />} 
                                                label={<Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>BTST</Typography>}
                                            />
                                        </RadioGroup>
                                    </Box>

                                    <Box flex="1">
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                        >
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

                                    <Box flex="1">
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                        >
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
                                                sx={{ 
                                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                    height: { xs: 28, sm: 32 }
                                                }}
                                            />
                                        ))}
                                    </Box>
                                </Box>

                                {/* Readymade Templates Link */}
                                <Box>
                                    <Button
                                        variant="text"
                                        onClick={() => navigate('/strategies/templates')}
                                        sx={{ 
                                            textTransform: 'none',
                                            fontSize: { xs: '0.8rem', sm: '0.875rem' }
                                        }}
                                    >
                                        Readymade Templates ↗
                                    </Button>
                                </Box>
                            </>
                        )}

                        {strategyType === 'indicator-based' && (
                            <>
                                {/* Transaction Type, Chart Type, Interval */}
                                <Box 
                                    sx={{
                                        display: 'flex',
                                        flexDirection: { xs: 'column', sm: 'row' },
                                        gap: 2
                                    }}
                                >
                                    <Box flex="1">
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                        >
                                            Transaction type
                                        </Typography>
                                        <ToggleButtonGroup
                                            value={transactionType}
                                            exclusive
                                            onChange={(e, value) => value && setTransactionType(value)}
                                            size="small"
                                            fullWidth
                                            sx={{ mt: 0.5 }}
                                            orientation={isMobile ? 'vertical' : 'horizontal'}
                                        >
                                            <ToggleButton value="Both Side" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Both Side</ToggleButton>
                                            <ToggleButton value="Only Long" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Only Long</ToggleButton>
                                            <ToggleButton value="Only Short" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Only Short</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>

                                    <Box flex="1">
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                        >
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
                                            <ToggleButton value="Candle" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Candle</ToggleButton>
                                            <ToggleButton value="Heikin Ashi" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Heikin Ashi</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>

                                    <Box flex="1">
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                        >
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
                                                    sx={{ 
                                                        fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                                        height: { xs: 24, sm: 28 }
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Entry Conditions */}
                                <Box>
                                    <Typography 
                                        variant="subtitle1" 
                                        fontWeight="bold" 
                                        gutterBottom
                                        sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}
                                    >
                                        Entry conditions
                                    </Typography>
                                    <FormControlLabel
                                        control={<Checkbox size={isMobile ? 'small' : 'medium'} />}
                                        label={<Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Use Combined Chart</Typography>}
                                    />

                                    <Box mt={2}>
                                        <Typography 
                                            variant="body2" 
                                            color="success.main" 
                                            gutterBottom
                                            sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                                        >
                                            Long Entry condition
                                        </Typography>
                                        <Stack spacing={2} mb={2}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Select Indicator</InputLabel>
                                                <Select label="Select Indicator">
                                                    <MenuItem value="RSI">RSI</MenuItem>
                                                    <MenuItem value="MACD">MACD</MenuItem>
                                                    <MenuItem value="EMA">EMA</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Select Comparator</InputLabel>
                                                <Select label="Select Comparator">
                                                    <MenuItem value=">">Greater Than</MenuItem>
                                                    <MenuItem value="<">Less Than</MenuItem>
                                                    <MenuItem value="=">Equal To</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Select Indicator</InputLabel>
                                                <Select label="Select Indicator">
                                                    <MenuItem value="Value">Value</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Stack>

                                        <Typography 
                                            variant="body2" 
                                            color="error.main" 
                                            gutterBottom
                                            sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                                        >
                                            Short Entry condition
                                        </Typography>
                                        <Stack spacing={2} mb={2}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Select Indicator</InputLabel>
                                                <Select label="Select Indicator">
                                                    <MenuItem value="RSI">RSI</MenuItem>
                                                    <MenuItem value="MACD">MACD</MenuItem>
                                                    <MenuItem value="EMA">EMA</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Select Comparator</InputLabel>
                                                <Select label="Select Comparator">
                                                    <MenuItem value=">">Greater Than</MenuItem>
                                                    <MenuItem value="<">Less Than</MenuItem>
                                                    <MenuItem value="=">Equal To</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Select Indicator</InputLabel>
                                                <Select label="Select Indicator">
                                                    <MenuItem value="Value">Value</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Stack>

                                        <Button 
                                            variant="outlined" 
                                            size="small"
                                            sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                                        >
                                            Add Condition +
                                        </Button>
                                    </Box>

                                    <FormControlLabel
                                        control={<Checkbox size={isMobile ? 'small' : 'medium'} />}
                                        label={<Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Exit conditions (Optional)</Typography>}
                                        sx={{ mt: 2 }}
                                    />
                                </Box>

                                {/* Option Position Builder */}
                                <Box>
                                    <Box 
                                        display="flex" 
                                        flexDirection={{ xs: 'column', sm: 'row' }}
                                        justifyContent="space-between" 
                                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                                        gap={2}
                                    >
                                        <Typography 
                                            variant="subtitle1" 
                                            fontWeight="bold"
                                            sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}
                                        >
                                            Option Position builder
                                        </Typography>
                                        <Button 
                                            variant="contained" 
                                            size="small" 
                                            startIcon={<Add />}
                                            fullWidth={isMobile}
                                            sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                                        >
                                            Add leg +
                                        </Button>
                                    </Box>
                                    <FormControlLabel
                                        control={<Checkbox size={isMobile ? 'small' : 'medium'} />}
                                        label={<Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Add Signal Candle Condition (Optional)</Typography>}
                                        sx={{ mt: 1 }}
                                    />
                                </Box>
                            </>
                        )}

                        {/* Risk Management */}
                        <Box>
                            <Typography 
                                variant="subtitle1" 
                                fontWeight="bold" 
                                gutterBottom
                                sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}
                            >
                                Risk management
                            </Typography>
                            <Stack spacing={2} mt={2}>
                                <TextField
                                    label="Exit When Over All Profit In Amount (INR)"
                                    size="small"
                                    fullWidth
                                    value={exitOnProfit}
                                    onChange={(e) => setExitOnProfit(e.target.value)}
                                    InputLabelProps={{
                                        sx: { fontSize: { xs: '0.8rem', sm: '0.875rem' } }
                                    }}
                                />
                                <TextField
                                    label="Exit When Over All Loss In Amount(INR)"
                                    size="small"
                                    fullWidth
                                    value={exitOnLoss}
                                    onChange={(e) => setExitOnLoss(e.target.value)}
                                    InputLabelProps={{
                                        sx: { fontSize: { xs: '0.8rem', sm: '0.875rem' } }
                                    }}
                                />
                                <Box 
                                    sx={{
                                        display: 'flex',
                                        flexDirection: { xs: 'column', sm: 'row' },
                                        gap: 2
                                    }}
                                >
                                    <TextField
                                        label="Max Trade Cycle"
                                        size="small"
                                        fullWidth
                                        value={maxTradeCycle}
                                        onChange={(e) => setMaxTradeCycle(e.target.value)}
                                        InputLabelProps={{
                                            sx: { fontSize: { xs: '0.8rem', sm: '0.875rem' } }
                                        }}
                                    />
                                    <Box flex="1">
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                        >
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
                            </Stack>

                            <Box mt={2}>
                                <Typography 
                                    variant="caption" 
                                    color="text.secondary"
                                    sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                >
                                    Profit Trailing
                                </Typography>
                                <RadioGroup
                                    row={!isMobile}
                                    value={profitTrailing}
                                    onChange={(e) => setProfitTrailing(e.target.value)}
                                >
                                    <FormControlLabel 
                                        value="No Trailing" 
                                        control={<Radio size={isMobile ? 'small' : 'medium'} />} 
                                        label={<Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>No Trailing</Typography>}
                                    />
                                    <FormControlLabel 
                                        value="Lock Fix Profit" 
                                        control={<Radio size={isMobile ? 'small' : 'medium'} />} 
                                        label={<Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Lock Fix Profit</Typography>}
                                    />
                                    <FormControlLabel 
                                        value="Trail Profit" 
                                        control={<Radio size={isMobile ? 'small' : 'medium'} />} 
                                        label={<Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Trail Profit</Typography>}
                                    />
                                    <FormControlLabel 
                                        value="Lock and Trail" 
                                        control={<Radio size={isMobile ? 'small' : 'medium'} />} 
                                        label={<Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Lock and Trail</Typography>}
                                    />
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
                            InputLabelProps={{
                                sx: { fontSize: { xs: '0.9rem', sm: '1rem' } }
                            }}
                        />

                        {/* Action Buttons */}
                        <Box 
                            display="flex" 
                            flexDirection={{ xs: 'column', sm: 'row' }}
                            gap={2} 
                            justifyContent="flex-end"
                        >
                            <Button
                                variant="outlined"
                                size={isMobile ? 'medium' : 'large'}
                                startIcon={<Print />}
                                fullWidth={isMobile}
                                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                            >
                                Print
                            </Button>
                            <Button
                                variant="contained"
                                size={isMobile ? 'medium' : 'large'}
                                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                                onClick={handleSubmit}
                                disabled={loading || !strategyName}
                                fullWidth={isMobile}
                                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
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
                    fullScreen={isMobile}
                    PaperProps={{
                        sx: {
                            m: { xs: 0, sm: 2 },
                            maxHeight: { xs: '100%', sm: '90vh' }
                        }
                    }}
                >
                    <DialogTitle sx={{ p: { xs: 2, sm: 3 } }}>
                        <TextField
                            fullWidth
                            placeholder="Search scripts: ie. - State Bank Of India, Banknifty, Crudeoil"
                            size="small"
                            InputProps={{
                                sx: { fontSize: { xs: '0.8rem', sm: '0.875rem' } }
                            }}
                        />
                    </DialogTitle>
                    <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Box>
                            <ToggleButtonGroup
                                value={selectedInstrumentType}
                                exclusive
                                onChange={(e, value) => value && setSelectedInstrumentType(value)}
                                size="small"
                                fullWidth
                                sx={{ 
                                    mb: 2,
                                    flexWrap: 'wrap',
                                    '& .MuiToggleButton-root': {
                                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                        py: { xs: 0.5, sm: 1 }
                                    }
                                }}
                                orientation={isMobile ? 'vertical' : 'horizontal'}
                            >
                                <ToggleButton value="OPTIONS">Options</ToggleButton>
                                <ToggleButton value="EQUITY">Equity</ToggleButton>
                                <ToggleButton value="FUTURES">Futures</ToggleButton>
                                <ToggleButton value="INDICES">Indices</ToggleButton>
                                <ToggleButton value="CDS">CDS</ToggleButton>
                                <ToggleButton value="MCX">MCX</ToggleButton>
                            </ToggleButtonGroup>
                            {selectedInstrumentType === 'OPTIONS' && (
                                <Typography 
                                    variant="caption" 
                                    color="text.secondary"
                                    sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                >
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
                                        sx={{ 
                                            justifyContent: 'flex-start', 
                                            textTransform: 'none',
                                            fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                            py: { xs: 1, sm: 1.5 }
                                        }}
                                    >
                                        {instrument}
                                    </Button>
                                ))}
                            </Stack>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: { xs: 2, sm: 2 } }}>
                        <Button 
                            onClick={() => setInstrumentDialogOpen(false)}
                            fullWidth={isMobile}
                            sx={{ fontSize: { xs: '0.875rem', sm: '0.9375rem' } }}
                        >
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Layout>
    );
};

export default CreateStrategy;
