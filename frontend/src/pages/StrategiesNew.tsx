import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    Tabs,
    Tab,
    TextField,
    InputAdornment,
    Chip,
    IconButton,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Autocomplete
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    MoreVert as MoreIcon,
    PlayArrow as PlayIcon,
    Stop as StopIcon,
    Assessment as AssessmentIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import Layout from '../components/Layout';
import axios from 'axios';
import { auth } from '../config/firebase';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div hidden={value !== index} {...other}>
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

interface Strategy {
    id: string;
    userId: string;
    name: string;
    description: string;
    type: 'time_based' | 'indicator_based';
    instruments: string[];
    timeframe: string;
    status: 'draft' | 'deployed' | 'stopped';
    createdAt: string;
    logic?: string;
}

const POPULAR_SYMBOLS = [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
    'BHARTIARTL', 'KOTAKBANK', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA',
    'NIFTY50', 'BANKNIFTY', 'FINNIFTY'
];

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

// Strategy Templates
const STRATEGY_TEMPLATES = [
    {
        id: 'custom',
        name: 'Custom Strategy',
        description: 'Create your own strategy from scratch',
        logic: ''
    },
    {
        id: 'gap_trigger_options',
        name: 'Gap & Trigger Options Strategy',
        description: 'ATM Options with Gap Filter, Trigger Candles, and Averaging',
        logic: `If the market opens within ±150 points of the previous day's close, only then trading is allowed; otherwise, no trades for the day. After market opens, wait for the 5-minute candle at 9:20 AM and mark its Close as A. Calculate Upper Trigger = A × 1.0009, Lower Trigger = A × 0.9991, and the Target = Upper Trigger − Lower Trigger. If any candle closes above the Upper Trigger, that candle becomes the Call Trigger Candle, and an ATM Call is bought only when price breaks above the high of this candle. If any candle closes below the Lower Trigger, that candle becomes the Put Trigger Candle, and an ATM Put is bought only when price breaks below the low of this candle. After entering a trade, if the option premium falls 20 points below the entry price, one additional lot is bought (averaging) only once. The Stop Loss for Call is the Day Low of the underlying index, and Stop Loss for Put is the Day High of the index, while the target is the calculated difference (Upper Trigger − Lower Trigger). Once target or SL is hit (including after averaging), the trade is closed.`,
        defaultInstruments: ['NIFTY50', 'BANKNIFTY'],
        defaultTimeframe: '5m'
    }
];

const StrategiesNew: React.FC = () => {
    const [tabValue, setTabValue] = useState(1); // Start with "My Strategies"
    const [searchQuery, setSearchQuery] = useState('');
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [showDeployDialog, setShowDeployDialog] = useState(false);
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
    const [duplicateName, setDuplicateName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('custom');
    const [deployForm, setDeployForm] = useState({
        quantity: 1,
        broker: '',
        maxProfit: 0,
        maxLoss: 2500,
        squareOffTime: '15:11',
        deploymentType: 'live',
        acceptTerms: false
    });
    const [createForm, setCreateForm] = useState({
        name: '',
        description: '',
        type: 'time_based' as 'time_based' | 'indicator_based',
        instruments: [] as string[],
        timeframe: '5m',
        logic: ''
    });

    useEffect(() => {
        loadStrategies();
    }, []);

    const loadStrategies = async () => {
        try {
            setLoading(true);
            const userId = auth.currentUser?.uid;

            const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/strategies${userId ? `?userId=${userId}` : ''}`);

            if (response.data.success) {
                setStrategies(response.data.strategies || []);
            }
        } catch (error: any) {
            console.error('Failed to load strategies:', error);
            setError('Failed to load strategies');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStrategy = async () => {
        try {
            if (!createForm.name || !createForm.description || createForm.instruments.length === 0) {
                setError('Please fill in all required fields');
                return;
            }

            const userId = auth.currentUser?.uid;

            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/strategies`, {
                ...createForm,
                userId
            });

            if (response.data.success) {
                setStrategies(prev => [...prev, response.data.strategy]);
                setShowCreateDialog(false);
                setCreateForm({
                    name: '',
                    description: '',
                    type: 'time_based',
                    instruments: [],
                    timeframe: '5m',
                    logic: ''
                });
                setError(null);
            }
        } catch (error: any) {
            console.error('Failed to create strategy:', error);
            setError('Failed to create strategy');
        }
    };

    const handleDeployStrategy = async (strategyId: string) => {
        try {
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/strategies/${strategyId}/start`);

            if (response.data.success) {
                setStrategies(prev => prev.map(s =>
                    s.id === strategyId ? { ...s, status: 'deployed' as const } : s
                ));
            }
        } catch (error: any) {
            console.error('Failed to deploy strategy:', error);
            setError('Failed to deploy strategy');
        }
    };

    const handleStopStrategy = async (strategyId: string) => {
        try {
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/strategies/${strategyId}/stop`);

            if (response.data.success) {
                setStrategies(prev => prev.map(s =>
                    s.id === strategyId ? { ...s, status: 'stopped' as const } : s
                ));
            }
        } catch (error: any) {
            console.error('Failed to stop strategy:', error);
            setError('Failed to stop strategy');
        }
    };

    const handleDeleteStrategy = async (strategyId: string) => {
        if (!window.confirm('Are you sure you want to delete this strategy?')) return;

        try {
            await axios.delete(`${process.env.REACT_APP_API_BASE_URL}/api/strategies/${strategyId}`);
            setStrategies(prev => prev.filter(s => s.id !== strategyId));
        } catch (error: any) {
            console.error('Failed to delete strategy:', error);
            setError('Failed to delete strategy');
        }
    };

    const handleDuplicateStrategy = async () => {
        if (!selectedStrategy || !duplicateName) return;

        try {
            const userId = auth.currentUser?.uid;
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/strategies`, {
                name: duplicateName,
                description: selectedStrategy.description,
                type: selectedStrategy.type,
                instruments: selectedStrategy.instruments,
                timeframe: selectedStrategy.timeframe,
                logic: selectedStrategy.logic,
                userId
            });

            if (response.data.success) {
                setStrategies(prev => [...prev, response.data.strategy]);
                setShowDuplicateDialog(false);
                setDuplicateName('');
                setSelectedStrategy(null);
            }
        } catch (error: any) {
            console.error('Failed to duplicate strategy:', error);
            setError('Failed to duplicate strategy');
        }
    };

    const handleDeployWithOptions = async () => {
        if (!selectedStrategy || !deployForm.acceptTerms) {
            setError('Please accept terms and conditions');
            return;
        }

        try {
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/strategies/${selectedStrategy.id}/start`, deployForm);

            if (response.data.success) {
                setStrategies(prev => prev.map(s =>
                    s.id === selectedStrategy.id ? { ...s, status: 'deployed' as const } : s
                ));
                setShowDeployDialog(false);
                setSelectedStrategy(null);
                setDeployForm({
                    quantity: 1,
                    broker: '',
                    maxProfit: 0,
                    maxLoss: 2500,
                    squareOffTime: '15:11',
                    deploymentType: 'live',
                    acceptTerms: false
                });
            }
        } catch (error: any) {
            console.error('Failed to deploy strategy:', error);
            setError('Failed to deploy strategy');
        }
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const filteredStrategies = strategies.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const myStrategies = filteredStrategies.filter(s => s.status === 'draft' || s.status === 'stopped');
    const deployedStrategies = filteredStrategies.filter(s => s.status === 'deployed');

    return (
        <Layout>
            <Box sx={{ bgcolor: 'white', minHeight: '100vh', p: 3 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                        Strategies
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setShowCreateDialog(true)}
                        sx={{
                            bgcolor: '#4c6ef5',
                            textTransform: 'none',
                            borderRadius: 2,
                            px: 3,
                            '&:hover': { bgcolor: '#3b5bdb' }
                        }}
                    >
                        Create Strategy
                    </Button>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs
                        value={tabValue}
                        onChange={handleTabChange}
                        sx={{
                            '& .MuiTab-root': {
                                textTransform: 'none',
                                fontSize: '0.95rem',
                                fontWeight: 500,
                                color: '#666',
                                minHeight: 48,
                                '&.Mui-selected': {
                                    color: '#4c6ef5',
                                    fontWeight: 600
                                }
                            },
                            '& .MuiTabs-indicator': {
                                backgroundColor: '#4c6ef5',
                                height: 3,
                                borderRadius: '3px 3px 0 0'
                            }
                        }}
                    >
                        <Tab label="Create Strategy" />
                        <Tab label="My Strategies" />
                        <Tab label="Deployed Strategies" />
                        <Tab label="Strategy Template" />
                        <Tab label="My Portfolio" />
                    </Tabs>
                </Box>

                {/* Tab Content */}
                <TabPanel value={tabValue} index={0}>
                    <Box sx={{ maxWidth: 800 }}>
                        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                            Strategy Type
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
                            <Chip
                                label="Time Based"
                                sx={{
                                    bgcolor: '#e7f5ff',
                                    color: '#1971c2',
                                    fontWeight: 500,
                                    px: 2,
                                    py: 2.5,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: '#d0ebff' }
                                }}
                                onClick={() => setShowCreateDialog(true)}
                            />
                            <Chip
                                label="Indicator Based"
                                variant="outlined"
                                sx={{
                                    borderColor: '#dee2e6',
                                    color: '#666',
                                    fontWeight: 500,
                                    px: 2,
                                    py: 2.5,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    setCreateForm(prev => ({ ...prev, type: 'indicator_based' }));
                                    setShowCreateDialog(true);
                                }}
                            />
                        </Box>

                        <Typography variant="body2" sx={{ color: '#868e96', textAlign: 'center', mt: 4 }}>
                            Click on a strategy type to start creating your trading strategy
                        </Typography>
                    </Box>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : myStrategies.length > 0 ? (
                        <Box>
                            <TextField
                                placeholder="Search Strategies"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                size="small"
                                sx={{ mb: 3, maxWidth: 400 }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: '#adb5bd' }} />
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: 2, bgcolor: '#f8f9fa' }
                                }}
                            />
                            {myStrategies.map((strategy) => (
                                <Card
                                    key={strategy.id}
                                    sx={{
                                        mb: 2,
                                        p: 3,
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                        borderRadius: 3,
                                        border: '1px solid #f1f3f5'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                {strategy.name}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#868e96', mb: 2 }}>
                                                {strategy.description}
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
                                                <Box>
                                                    <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                                                        Type
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                        {strategy.type === 'time_based' ? 'Time Based' : 'Indicator Based'}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                                                        Timeframe
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                        {strategy.timeframe}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                {strategy.instruments.map((inst, idx) => (
                                                    <Chip
                                                        key={idx}
                                                        label={inst}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: '#f1f3f5',
                                                            color: '#495057',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                startIcon={<PlayIcon />}
                                                onClick={() => handleDeployStrategy(strategy.id)}
                                                sx={{
                                                    textTransform: 'none',
                                                    borderRadius: 2,
                                                    bgcolor: '#4c6ef5',
                                                    '&:hover': { bgcolor: '#3b5bdb' }
                                                }}
                                            >
                                                Deploy
                                            </Button>
                                            <IconButton size="small" onClick={() => handleDeleteStrategy(strategy.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Box>
                                    </Box>
                                </Card>
                            ))}
                        </Box>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 8 }}>
                            <Typography variant="h6" sx={{ color: '#868e96', mb: 1 }}>
                                No Strategies Yet
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#adb5bd', mb: 3 }}>
                                Create your first strategy to get started
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => setShowCreateDialog(true)}
                                sx={{
                                    bgcolor: '#4c6ef5',
                                    textTransform: 'none',
                                    borderRadius: 2,
                                    px: 3
                                }}
                            >
                                Create Strategy
                            </Button>
                        </Box>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : deployedStrategies.length > 0 ? (
                        <Box>
                            {deployedStrategies.map((strategy) => (
                                <Card
                                    key={strategy.id}
                                    sx={{
                                        mb: 2,
                                        p: 3,
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                        borderRadius: 3,
                                        border: '1px solid #f1f3f5'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    {strategy.name}
                                                </Typography>
                                                <Chip label="RUNNING" size="small" color="success" />
                                            </Box>
                                            <Typography variant="body2" sx={{ color: '#868e96', mb: 2 }}>
                                                {strategy.description}
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                {strategy.instruments.map((inst, idx) => (
                                                    <Chip
                                                        key={idx}
                                                        label={inst}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: '#f1f3f5',
                                                            color: '#495057',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        </Box>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<StopIcon />}
                                            onClick={() => handleStopStrategy(strategy.id)}
                                            sx={{
                                                textTransform: 'none',
                                                borderRadius: 2,
                                                borderColor: '#fa5252',
                                                color: '#fa5252',
                                                '&:hover': { bgcolor: '#fff5f5', borderColor: '#fa5252' }
                                            }}
                                        >
                                            Stop
                                        </Button>
                                    </Box>
                                </Card>
                            ))}
                        </Box>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 8 }}>
                            <Typography variant="h6" sx={{ color: '#868e96', mb: 1 }}>
                                No Deployed Strategy
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => setTabValue(1)}
                                sx={{
                                    bgcolor: '#4c6ef5',
                                    textTransform: 'none',
                                    borderRadius: 2,
                                    px: 3,
                                    mt: 2
                                }}
                            >
                                View My Strategies
                            </Button>
                        </Box>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={3}>
                    <Box>
                        {/* Search and Filter */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <TextField
                                placeholder="Search Strategies"
                                size="small"
                                sx={{ width: 400 }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: '#adb5bd' }} />
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: 2, bgcolor: 'white' }
                                }}
                            />
                            <Button
                                variant="outlined"
                                startIcon={<FilterIcon />}
                                sx={{
                                    textTransform: 'none',
                                    borderRadius: 2,
                                    borderColor: '#4c6ef5',
                                    color: '#4c6ef5'
                                }}
                            >
                                Filter
                            </Button>
                        </Box>

                        {/* Strategy Template Cards with Graphs */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
                            {STRATEGY_TEMPLATES.filter(t => t.id !== 'custom').map((template, index) => {
                                // Generate mock performance data
                                const maxDD = (Math.random() * 0.5).toFixed(2);
                                const margin = (Math.random() * 0.1).toFixed(2);
                                
                                return (
                                    <Card
                                        key={template.id}
                                        sx={{
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                            borderRadius: 3,
                                            border: '1px solid #f1f3f5',
                                            overflow: 'hidden',
                                            '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }
                                        }}
                                    >
                                        {/* Header */}
                                        <Box sx={{ p: 2, borderBottom: '1px solid #f1f3f5' }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                {template.name}
                                            </Typography>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Box>
                                                    <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                                                        Max DD
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {maxDD}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                                                        Margin
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#12b886' }}>
                                                        ₹{margin}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>

                                        {/* Graph Area */}
                                        <Box sx={{ p: 2, bgcolor: '#f8f9fa', height: 200, position: 'relative' }}>
                                            <svg width="100%" height="100%" viewBox="0 0 300 150" preserveAspectRatio="none">
                                                {/* Grid lines */}
                                                <line x1="0" y1="37.5" x2="300" y2="37.5" stroke="#e9ecef" strokeWidth="1" />
                                                <line x1="0" y1="75" x2="300" y2="75" stroke="#e9ecef" strokeWidth="1" />
                                                <line x1="0" y1="112.5" x2="300" y2="112.5" stroke="#e9ecef" strokeWidth="1" />
                                                
                                                {/* Performance line */}
                                                <path
                                                    d={`M 0,120 Q 50,${110 - index * 10} 75,${100 - index * 15} T 150,${80 - index * 20} Q 200,${60 - index * 15} 225,${50 - index * 10} T 300,${30 - index * 5}`}
                                                    fill="none"
                                                    stroke="#4c6ef5"
                                                    strokeWidth="2"
                                                />
                                                
                                                {/* Fill area under curve */}
                                                <path
                                                    d={`M 0,120 Q 50,${110 - index * 10} 75,${100 - index * 15} T 150,${80 - index * 20} Q 200,${60 - index * 15} 225,${50 - index * 10} T 300,${30 - index * 5} L 300,150 L 0,150 Z`}
                                                    fill="url(#gradient)"
                                                    opacity="0.3"
                                                />
                                                
                                                <defs>
                                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#4c6ef5" stopOpacity="0.4" />
                                                        <stop offset="100%" stopColor="#4c6ef5" stopOpacity="0.05" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            
                                            {/* Y-axis labels */}
                                            <Box sx={{ position: 'absolute', left: 8, top: 8 }}>
                                                <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.65rem' }}>
                                                    {(60 + index * 10).toFixed(2)}k
                                                </Typography>
                                            </Box>
                                            <Box sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}>
                                                <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.65rem' }}>
                                                    {(40 + index * 5).toFixed(2)}k
                                                </Typography>
                                            </Box>
                                            <Box sx={{ position: 'absolute', left: 8, bottom: 8 }}>
                                                <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.65rem' }}>
                                                    0.00
                                                </Typography>
                                            </Box>
                                            
                                            {/* X-axis labels */}
                                            <Box sx={{ position: 'absolute', bottom: 8, left: 50 }}>
                                                <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.65rem' }}>
                                                    Apr
                                                </Typography>
                                            </Box>
                                            <Box sx={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)' }}>
                                                <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.65rem' }}>
                                                    2023
                                                </Typography>
                                            </Box>
                                            <Box sx={{ position: 'absolute', bottom: 8, right: 50 }}>
                                                <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.65rem' }}>
                                                    2024
                                                </Typography>
                                            </Box>
                                            
                                            {/* Current value badge */}
                                            <Box sx={{ 
                                                position: 'absolute', 
                                                right: 16, 
                                                top: 16,
                                                bgcolor: '#1e1e1e',
                                                color: 'white',
                                                px: 1.5,
                                                py: 0.5,
                                                borderRadius: 1,
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                            }}>
                                                01 Apr '24
                                            </Box>
                                        </Box>

                                        {/* Add to Strategy Button */}
                                        <Box sx={{ p: 2 }}>
                                            <Button
                                                variant="outlined"
                                                fullWidth
                                                onClick={() => {
                                                    setSelectedTemplate(template.id);
                                                    setCreateForm({
                                                        name: template.name,
                                                        description: template.description,
                                                        type: 'time_based',
                                                        instruments: template.defaultInstruments || [],
                                                        timeframe: template.defaultTimeframe || '5m',
                                                        logic: template.logic
                                                    });
                                                    setShowCreateDialog(true);
                                                }}
                                                sx={{
                                                    textTransform: 'none',
                                                    borderRadius: 2,
                                                    borderColor: '#e7f5ff',
                                                    bgcolor: '#e7f5ff',
                                                    color: '#1971c2',
                                                    fontWeight: 500,
                                                    '&:hover': { 
                                                        bgcolor: '#d0ebff',
                                                        borderColor: '#d0ebff'
                                                    }
                                                }}
                                            >
                                                Add to my strategy
                                            </Button>
                                        </Box>
                                    </Card>
                                );
                            })}
                        </Box>
                    </Box>
                </TabPanel>

                <TabPanel value={tabValue} index={4}>
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography variant="h6" sx={{ color: '#868e96', mb: 1 }}>
                            No Portfolio summary. Create Bucket!
                        </Typography>
                    </Box>
                </TabPanel>

                {/* Create Strategy Dialog */}
                <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Create New Strategy</DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                            {/* Template Selection */}
                            <FormControl fullWidth>
                                <InputLabel>Strategy Template</InputLabel>
                                <Select
                                    value={selectedTemplate}
                                    onChange={(e) => {
                                        const templateId = e.target.value;
                                        setSelectedTemplate(templateId);
                                        const template = STRATEGY_TEMPLATES.find(t => t.id === templateId);
                                        if (template && template.id !== 'custom') {
                                            setCreateForm({
                                                ...createForm,
                                                name: template.name,
                                                description: template.description,
                                                logic: template.logic,
                                                instruments: template.defaultInstruments || [],
                                                timeframe: template.defaultTimeframe || '5m'
                                            });
                                        } else {
                                            setCreateForm({
                                                name: '',
                                                description: '',
                                                type: 'time_based' as 'time_based' | 'indicator_based',
                                                instruments: [] as string[],
                                                timeframe: '5m',
                                                logic: ''
                                            });
                                        }
                                    }}
                                >
                                    {STRATEGY_TEMPLATES.map((template) => (
                                        <MenuItem key={template.id} value={template.id}>
                                            <Box>
                                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                    {template.name}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#868e96' }}>
                                                    {template.description}
                                                </Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <TextField
                                label="Strategy Name"
                                value={createForm.name}
                                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                fullWidth
                                required
                            />

                            <TextField
                                label="Description"
                                value={createForm.description}
                                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                fullWidth
                                multiline
                                rows={2}
                                required
                            />

                            {/* Strategy Logic */}
                            {createForm.logic && (
                                <Box sx={{ 
                                    p: 2, 
                                    bgcolor: '#f8f9fa', 
                                    borderRadius: 2,
                                    border: '1px solid #e9ecef'
                                }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#495057' }}>
                                        Strategy Logic:
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#495057', lineHeight: 1.6 }}>
                                        {createForm.logic}
                                    </Typography>
                                </Box>
                            )}

                            <FormControl fullWidth>
                                <InputLabel>Strategy Type</InputLabel>
                                <Select
                                    value={createForm.type}
                                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value as any })}
                                >
                                    <MenuItem value="time_based">Time Based</MenuItem>
                                    <MenuItem value="indicator_based">Indicator Based</MenuItem>
                                </Select>
                            </FormControl>

                            <Autocomplete
                                multiple
                                options={POPULAR_SYMBOLS}
                                value={createForm.instruments}
                                onChange={(_, newValue) => setCreateForm({ ...createForm, instruments: newValue })}
                                renderInput={(params) => (
                                    <TextField {...params} label="Trading Instruments" placeholder="Select instruments" required />
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
                                    ))
                                }
                            />

                            <FormControl fullWidth>
                                <InputLabel>Timeframe</InputLabel>
                                <Select
                                    value={createForm.timeframe}
                                    onChange={(e) => setCreateForm({ ...createForm, timeframe: e.target.value })}
                                >
                                    {TIMEFRAMES.map((tf) => (
                                        <MenuItem key={tf} value={tf}>
                                            {tf}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                        <Button variant="contained" onClick={handleCreateStrategy}>
                            Create Strategy
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Duplicate Strategy Dialog */}
                <Dialog open={showDuplicateDialog} onClose={() => setShowDuplicateDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
                        Duplicate {selectedStrategy?.name}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ textAlign: 'center', py: 3 }}>
                            <Box sx={{ 
                                width: 80, 
                                height: 80, 
                                borderRadius: '50%', 
                                bgcolor: '#f59f00', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                margin: '0 auto 24px'
                            }}>
                                <Typography sx={{ fontSize: '2.5rem', color: 'white', fontWeight: 'bold' }}>!</Typography>
                            </Box>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                Are you sure you want to duplicate this Strategy?
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#868e96', mb: 4 }}>
                                This action will create one more strategy of same type.
                            </Typography>
                            <TextField
                                label="Name Of Duplicate Strategy"
                                value={duplicateName}
                                onChange={(e) => setDuplicateName(e.target.value)}
                                fullWidth
                                sx={{ mb: 3 }}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 0 }}>
                        <Button 
                            onClick={() => {
                                setShowDuplicateDialog(false);
                                setDuplicateName('');
                            }}
                            sx={{ 
                                textTransform: 'none',
                                borderRadius: 2,
                                px: 4,
                                color: '#4c6ef5',
                                border: '1px solid #4c6ef5'
                            }}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="contained" 
                            onClick={handleDuplicateStrategy}
                            disabled={!duplicateName}
                            sx={{ 
                                textTransform: 'none',
                                borderRadius: 2,
                                px: 4,
                                bgcolor: '#4c6ef5',
                                '&:hover': { bgcolor: '#3b5bdb' }
                            }}
                        >
                            Duplicate
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Deploy Strategy Dialog */}
                <Dialog open={showDeployDialog} onClose={() => setShowDeployDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Deploy {selectedStrategy?.name}
                        <IconButton onClick={() => setShowDeployDialog(false)} sx={{ color: '#fa5252' }}>
                            <Typography sx={{ fontSize: '1.5rem' }}>×</Typography>
                        </IconButton>
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, py: 2 }}>
                            <Box>
                                <Typography variant="body2" sx={{ color: '#868e96', mb: 1 }}>
                                    Quantity Multiplied
                                </Typography>
                                <TextField
                                    type="number"
                                    value={deployForm.quantity}
                                    onChange={(e) => setDeployForm({ ...deployForm, quantity: parseInt(e.target.value) || 1 })}
                                    fullWidth
                                    sx={{ bgcolor: '#f8f9fa' }}
                                />
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{ color: '#868e96', mb: 1 }}>
                                    Broker Name
                                </Typography>
                                <Select
                                    value={deployForm.broker}
                                    onChange={(e) => setDeployForm({ ...deployForm, broker: e.target.value })}
                                    fullWidth
                                    displayEmpty
                                    sx={{ bgcolor: '#f8f9fa' }}
                                >
                                    <MenuItem value="">Select Broker</MenuItem>
                                    <MenuItem value="zerodha">Zerodha</MenuItem>
                                    <MenuItem value="upstox">Upstox</MenuItem>
                                    <MenuItem value="angelone">Angel One</MenuItem>
                                </Select>
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{ color: '#868e96', mb: 1 }}>
                                    Max Profit (Optional)
                                </Typography>
                                <TextField
                                    type="number"
                                    value={deployForm.maxProfit}
                                    onChange={(e) => setDeployForm({ ...deployForm, maxProfit: parseInt(e.target.value) || 0 })}
                                    fullWidth
                                    sx={{ bgcolor: '#f8f9fa' }}
                                />
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{ color: '#868e96', mb: 1 }}>
                                    Square Off Time
                                </Typography>
                                <TextField
                                    type="time"
                                    value={deployForm.squareOffTime}
                                    onChange={(e) => setDeployForm({ ...deployForm, squareOffTime: e.target.value })}
                                    fullWidth
                                    sx={{ bgcolor: '#f8f9fa' }}
                                />
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{ color: '#868e96', mb: 1 }}>
                                    Max Loss (Optional)
                                </Typography>
                                <TextField
                                    type="number"
                                    value={deployForm.maxLoss}
                                    onChange={(e) => setDeployForm({ ...deployForm, maxLoss: parseInt(e.target.value) || 0 })}
                                    fullWidth
                                    sx={{ bgcolor: '#f8f9fa' }}
                                />
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{ color: '#868e96', mb: 1 }}>
                                    Deployment Type
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        variant={deployForm.deploymentType === 'live' ? 'contained' : 'outlined'}
                                        onClick={() => setDeployForm({ ...deployForm, deploymentType: 'live' })}
                                        sx={{ 
                                            flex: 1,
                                            textTransform: 'none',
                                            borderRadius: 2,
                                            bgcolor: deployForm.deploymentType === 'live' ? '#4c6ef5' : 'transparent',
                                            color: deployForm.deploymentType === 'live' ? 'white' : '#4c6ef5',
                                            borderColor: '#4c6ef5'
                                        }}
                                    >
                                        📡 Live
                                    </Button>
                                    <Button
                                        variant={deployForm.deploymentType === 'test' ? 'contained' : 'outlined'}
                                        onClick={() => setDeployForm({ ...deployForm, deploymentType: 'test' })}
                                        sx={{ 
                                            flex: 1,
                                            textTransform: 'none',
                                            borderRadius: 2,
                                            bgcolor: deployForm.deploymentType === 'test' ? '#4c6ef5' : 'transparent',
                                            color: deployForm.deploymentType === 'test' ? 'white' : '#4c6ef5',
                                            borderColor: '#4c6ef5'
                                        }}
                                    >
                                        📋 Forward Test
                                    </Button>
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <input
                                type="checkbox"
                                checked={deployForm.acceptTerms}
                                onChange={(e) => setDeployForm({ ...deployForm, acceptTerms: e.target.checked })}
                                style={{ width: 20, height: 20 }}
                            />
                            <Typography variant="body2">
                                I accept all the <a href="#" style={{ color: '#4c6ef5', textDecoration: 'underline' }}>terms & conditions</a>
                            </Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 0 }}>
                        <Button 
                            onClick={() => setShowDeployDialog(false)}
                            sx={{ 
                                textTransform: 'none',
                                borderRadius: 2,
                                px: 4,
                                color: '#4c6ef5'
                            }}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="contained" 
                            onClick={handleDeployWithOptions}
                            disabled={!deployForm.acceptTerms || !deployForm.broker}
                            sx={{ 
                                textTransform: 'none',
                                borderRadius: 2,
                                px: 4,
                                bgcolor: deployForm.acceptTerms && deployForm.broker ? '#4c6ef5' : '#dee2e6',
                                '&:hover': { bgcolor: '#3b5bdb' }
                            }}
                        >
                            Deploy
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Layout>
    );
};

export default StrategiesNew;
