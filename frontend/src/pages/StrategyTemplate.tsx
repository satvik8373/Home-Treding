import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    Stack,
    useMediaQuery,
    useTheme,
    Alert
} from '@mui/material';
import {
    TrendingUp,
    ContentCopy,
    CheckCircle
} from '@mui/icons-material';
import Layout from '../components/Layout';

interface StrategyTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    instrumentType: string;
    timeframe: string;
    logic: string[];
    entryRules: string[];
    exitRules: string[];
    riskManagement: string[];
    maxDD: string;
    margin: string;
    icon: React.ReactNode;
}

const StrategyTemplate: React.FC = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    // MX Strategies - 5-Minute Trigger Candle Strategy
    const mxStrategy: StrategyTemplate = {
        id: 'mx-5min-trigger',
        name: 'MX Strategies - 5-Minute Trigger Candle',
        description: 'Professional 5-minute trigger candle strategy for Index Options with automatic Dhan API integration',
        category: 'Professional',
        instrumentType: 'OPTIONS',
        timeframe: '5m',
        icon: <TrendingUp />,
        maxDD: '₹2,500',
        margin: '₹50,000',
        logic: [
            '✓ Market opens within ±150 points of previous close',
            '✓ Wait for 9:20 AM 5-minute candle close (A)',
            '✓ Calculate Upper Trigger = A × 1.0009',
            '✓ Calculate Lower Trigger = A × 0.9991',
            '✓ Target = Upper Trigger − Lower Trigger',
            '✓ Watch for trigger candle formation',
            '✓ Enter on breakout of trigger candle high/low'
        ],
        entryRules: [
            '� CALL UEntry:',
            '  • Candle closes above Upper Trigger',
            '  • Wait for price to break trigger candle HIGH',
            '  • Buy ATM Call option immediately',
            '',
            '� PUT Enltry:',
            '  • Candle closes below Lower Trigger',
            '  • Wait for price to break trigger candle LOW',
            '  • Buy ATM Put option immediately',
            '',
            '💰 Averaging (Only Once):',
            '  • If premium falls 20 points below entry',
            '  • Add 1 additional lot at current price',
            '  • No further averaging allowed'
        ],
        exitRules: [
            '🎯 Target Exit:',
            '  • Exit when premium reaches calculated target',
            '  • Target = (Upper Trigger − Lower Trigger)',
            '  • Close all positions including averaged lots',
            '',
            '🛑 Stop Loss - CALL:',
            '  • Exit if underlying index touches Day Low',
            '  • Close all positions immediately',
            '',
            '🛑 Stop Loss - PUT:',
            '  • Exit if underlying index touches Day High',
            '  • Close all positions immediately',
            '',
            '⏰ Time-Based Exit:',
            '  • Square off all positions by 3:15 PM',
            '  • No overnight positions'
        ],
        riskManagement: [
            '❌ No trading if market opens beyond ±150 points',
            '✅ Maximum 1 averaging per trade (at -20 points)',
            '✅ Strict stop loss at day high/low',
            '✅ Single trade per day per direction',
            '✅ Automatic position sizing based on margin',
            '✅ Real-time P&L tracking',
            '✅ Automatic square-off at 3:15 PM'
        ]
    };

    const handleViewDetails = (template: StrategyTemplate) => {
        setSelectedTemplate(template);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setSelectedTemplate(null);
    };

    const handleAddToMyStrategy = (template: StrategyTemplate) => {
        // Open duplicate dialog instead of navigating directly
        setSelectedTemplate(template);
        setDialogOpen(true);
    };

    const handleConfirmAddStrategy = () => {
        if (!selectedTemplate) return;

        const fullDescription = `${selectedTemplate.description}

STRATEGY LOGIC:
${selectedTemplate.logic.join('\n')}

ENTRY RULES:
${selectedTemplate.entryRules.join('\n')}

EXIT RULES:
${selectedTemplate.exitRules.join('\n')}

RISK MANAGEMENT:
${selectedTemplate.riskManagement.join('\n')}

DHAN API INTEGRATION:
This strategy automatically connects to Dhan API for:
- Real-time market data monitoring
- Automatic order placement
- Position tracking and management
- Stop loss and target execution
- Averaging logic implementation

REQUIREMENTS:
- Active Dhan account with API access
- Sufficient margin (₹50,000 recommended)
- Broker connection configured in AlgoRooms
- Terminal activated for live trading`;

        navigate('/strategies', {
            state: {
                addStrategy: true,
                template: {
                    name: selectedTemplate.name,
                    description: fullDescription,
                    instrumentType: selectedTemplate.instrumentType,
                    timeframe: selectedTemplate.timeframe,
                    entryRule: selectedTemplate.entryRules.join('\n\n'),
                    exitRule: selectedTemplate.exitRules.join('\n\n'),
                    symbol: 'BANKNIFTY',
                    stopLossPercent: '2',
                    targetPercent: '5',
                    positionSize: '1',
                    maxPositions: '2', // 1 initial + 1 averaging
                    strategyType: 'time-based',
                    orderType: 'MIS',
                    startTime: '09:16',
                    squareOffTime: '15:15',
                    tradingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI']
                }
            }
        });
        setDialogOpen(false);
    };

    return (
        <Layout>
            <Container 
                maxWidth="xl" 
                sx={{ 
                    mt: { xs: 2, sm: 3, md: 4 }, 
                    mb: { xs: 10, sm: 4 },
                    px: { xs: 1, sm: 2, md: 3 }
                }}
            >
                {/* Header */}
                <Box mb={{ xs: 2, sm: 3, md: 4 }}>
                    <Typography 
                        variant="h4" 
                        component="h1" 
                        fontWeight="bold" 
                        gutterBottom
                        sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
                    >
                        MX Strategies
                    </Typography>
                    <Typography 
                        variant="body1" 
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                        Professional algorithmic trading strategy with automatic Dhan API integration
                    </Typography>
                </Box>

                {/* Alert Box */}
                <Alert 
                    severity="info" 
                    sx={{ 
                        mb: { xs: 2, sm: 3 },
                        fontSize: { xs: '0.8rem', sm: '0.875rem' }
                    }}
                >
                    <strong>Live Trading Ready:</strong> This strategy automatically connects to your Dhan account for real-time order execution. Ensure your broker is connected and terminal is activated.
                </Alert>

                {/* Strategy Card */}
                <Card
                    elevation={3}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 6
                        },
                        border: '2px solid #4c6ef5'
                    }}
                >
                    <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
                        {/* Header */}
                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <Box
                                sx={{
                                    p: { xs: 1, sm: 1.5 },
                                    borderRadius: 2,
                                    bgcolor: 'primary.light',
                                    color: 'primary.main',
                                    display: 'flex'
                                }}
                            >
                                {mxStrategy.icon}
                            </Box>
                            <Box flex={1}>
                                <Typography 
                                    variant="h5" 
                                    fontWeight="bold" 
                                    gutterBottom
                                    sx={{ 
                                        fontSize: { xs: '1.1rem', sm: '1.3rem' },
                                        lineHeight: 1.3,
                                        mb: 1
                                    }}
                                >
                                    {mxStrategy.name}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                    <Chip
                                        label={mxStrategy.category}
                                        size="small"
                                        color="primary"
                                        sx={{ height: { xs: 20, sm: 24 }, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                                    />
                                    <Chip
                                        icon={<CheckCircle sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }} />}
                                        label="Dhan API Ready"
                                        size="small"
                                        color="success"
                                        sx={{ height: { xs: 20, sm: 24 }, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                                    />
                                </Stack>
                            </Box>
                        </Box>

                        <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            mb={2}
                            sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                        >
                            {mxStrategy.description}
                        </Typography>

                        <Divider sx={{ my: 2 }} />

                        {/* Strategy Details */}
                        <Stack spacing={1.5}>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                    Instrument
                                </Typography>
                                <Typography variant="caption" fontWeight="bold" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                    {mxStrategy.instrumentType}
                                </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                    Timeframe
                                </Typography>
                                <Typography variant="caption" fontWeight="bold" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                    {mxStrategy.timeframe}
                                </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                    Max Drawdown
                                </Typography>
                                <Typography variant="caption" fontWeight="bold" color="error" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                    {mxStrategy.maxDD}
                                </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                    Recommended Margin
                                </Typography>
                                <Typography variant="caption" fontWeight="bold" color="success.main" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                    {mxStrategy.margin}
                                </Typography>
                            </Box>
                        </Stack>

                        {/* Quick Preview */}
                        <Box mt={3}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={1} sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                                Strategy Highlights
                            </Typography>
                            <Stack spacing={0.5}>
                                {mxStrategy.logic.slice(0, 4).map((item, index) => (
                                    <Typography 
                                        key={index} 
                                        variant="caption" 
                                        sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                                    >
                                        {item}
                                    </Typography>
                                ))}
                            </Stack>
                        </Box>
                    </CardContent>

                    <CardActions sx={{ p: { xs: 1.5, sm: 2 }, pt: 0, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                        <Button
                            size="small"
                            onClick={() => handleViewDetails(mxStrategy)}
                            fullWidth
                            variant="outlined"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                        >
                            View Full Details
                        </Button>
                        <Button
                            size="small"
                            onClick={() => handleAddToMyStrategy(mxStrategy)}
                            fullWidth
                            variant="contained"
                            startIcon={<ContentCopy sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                        >
                            Add to My Strategies
                        </Button>
                    </CardActions>
                </Card>

                {/* Details Dialog */}
                <Dialog
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    maxWidth="md"
                    fullWidth
                    fullScreen={isMobile}
                    PaperProps={{
                        sx: {
                            m: { xs: 0, sm: 2 },
                            maxHeight: { xs: '100%', sm: '90vh' }
                        }
                    }}
                >
                    {selectedTemplate && (
                        <>
                            <DialogTitle sx={{ p: { xs: 2, sm: 3 } }}>
                                <Box display="flex" alignItems="center" gap={2}>
                                    <Box
                                        sx={{
                                            p: { xs: 1, sm: 1.5 },
                                            borderRadius: 2,
                                            bgcolor: 'primary.light',
                                            color: 'primary.main',
                                            display: 'flex'
                                        }}
                                    >
                                        {selectedTemplate.icon}
                                    </Box>
                                    <Box flex={1}>
                                        <Typography 
                                            variant="h5" 
                                            fontWeight="bold"
                                            sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' } }}
                                        >
                                            {selectedTemplate.name}
                                        </Typography>
                                        <Typography 
                                            variant="body2" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                                        >
                                            {selectedTemplate.description}
                                        </Typography>
                                    </Box>
                                </Box>
                            </DialogTitle>
                            <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
                                <Stack spacing={{ xs: 2.5, sm: 3 }}>
                                    <Box>
                                        <Typography 
                                            variant="h6" 
                                            gutterBottom 
                                            fontWeight="bold"
                                            sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                                        >
                                            Strategy Logic
                                        </Typography>
                                        <Stack spacing={1}>
                                            {selectedTemplate.logic.map((item, index) => (
                                                <Typography 
                                                    key={index} 
                                                    variant="body2"
                                                    sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                                                >
                                                    {item}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>

                                    <Box>
                                        <Typography 
                                            variant="h6" 
                                            gutterBottom 
                                            fontWeight="bold"
                                            sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                                        >
                                            Entry Rules
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            {selectedTemplate.entryRules.map((rule, index) => (
                                                <Typography 
                                                    key={index} 
                                                    variant="body2"
                                                    sx={{ 
                                                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                                        whiteSpace: 'pre-line'
                                                    }}
                                                >
                                                    {rule}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>

                                    <Box>
                                        <Typography 
                                            variant="h6" 
                                            gutterBottom 
                                            fontWeight="bold"
                                            sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                                        >
                                            Exit Rules
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            {selectedTemplate.exitRules.map((rule, index) => (
                                                <Typography 
                                                    key={index} 
                                                    variant="body2"
                                                    sx={{ 
                                                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                                        whiteSpace: 'pre-line'
                                                    }}
                                                >
                                                    {rule}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>

                                    <Box>
                                        <Typography 
                                            variant="h6" 
                                            gutterBottom 
                                            fontWeight="bold"
                                            sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                                        >
                                            Risk Management
                                        </Typography>
                                        <Stack spacing={1}>
                                            {selectedTemplate.riskManagement.map((item, index) => (
                                                <Typography 
                                                    key={index} 
                                                    variant="body2"
                                                    sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                                                >
                                                    {item}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>

                                    <Alert severity="success" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                        <strong>Dhan API Integration:</strong> This strategy will automatically connect to your Dhan account for live trading. All order placement, position tracking, and risk management will be handled automatically.
                                    </Alert>
                                </Stack>
                            </DialogContent>
                            <DialogActions sx={{ p: { xs: 2, sm: 2 }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                                <Button 
                                    onClick={handleCloseDialog}
                                    fullWidth={isMobile}
                                    sx={{ fontSize: { xs: '0.875rem', sm: '0.9375rem' } }}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        handleAddToMyStrategy(selectedTemplate);
                                        handleCloseDialog();
                                    }}
                                    startIcon={<ContentCopy />}
                                    fullWidth={isMobile}
                                    sx={{ fontSize: { xs: '0.875rem', sm: '0.9375rem' } }}
                                >
                                    Add to My Strategies
                                </Button>
                            </DialogActions>
                        </>
                    )}
                </Dialog>
            </Container>
        </Layout>
    );
};

export default StrategyTemplate;
