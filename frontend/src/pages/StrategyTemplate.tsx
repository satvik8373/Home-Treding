import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Paper,
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
    Stack
} from '@mui/material';
import {
    TrendingUp,
    ShowChart,
    Timeline,
    Assessment,
    ContentCopy
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
    const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const templates: StrategyTemplate[] = [
        {
            id: 'market-opening-range',
            name: 'Market Opening Range Breakout',
            description: 'Trade based on 9:20 AM candle breakout with strict market opening conditions',
            category: 'Intraday',
            instrumentType: 'OPTIONS',
            timeframe: '5m',
            icon: <TrendingUp />,
            maxDD: '₹0.00',
            margin: '₹0.00',
            logic: [
                '✓ Market opens within ±150 points of previous close',
                '✓ Wait for 9:20 AM 5-minute candle close (A)',
                '✓ Calculate Upper Trigger = A × 1.0009',
                '✓ Calculate Lower Trigger = A × 0.9991',
                '✓ Target = Upper Trigger − Lower Trigger'
            ],
            entryRules: [
                '📈 CALL Entry: Candle closes above Upper Trigger → Buy ATM Call when price breaks candle high',
                '📉 PUT Entry: Candle closes below Lower Trigger → Buy ATM Put when price breaks candle low',
                '💰 Averaging: If premium falls 20 points below entry, buy 1 additional lot (only once)'
            ],
            exitRules: [
                '🎯 Target: Calculated difference (Upper Trigger − Lower Trigger)',
                '🛑 Call SL: Day Low of underlying index',
                '🛑 Put SL: Day High of underlying index',
                '✅ Exit when target or SL hit (including after averaging)'
            ],
            riskManagement: [
                'No trading if market opens beyond ±150 points',
                'Maximum 1 averaging per trade',
                'Strict stop loss at day high/low',
                'Single trade per day per direction'
            ]
        },
        {
            id: 'advanced-delta-neutral',
            name: 'Advanced Delta Neutral',
            description: 'Time-based options strategy with segment-specific execution',
            category: 'Options',
            instrumentType: 'OPTIONS',
            timeframe: '1m',
            icon: <ShowChart />,
            maxDD: '60.00k',
            margin: '₹0.00',
            logic: [
                '✓ Start Time: 09:22',
                '✓ End Time: 15:11',
                '✓ Segment Type: OPTION',
                '✓ Strategy Type: Time Based'
            ],
            entryRules: [
                'Execute at specific time windows',
                'Monitor NIFTY BANK, ATM CE, ATM PE',
                'Delta neutral positioning'
            ],
            exitRules: [
                'Time-based exit at 15:11',
                'Dynamic adjustment based on delta',
                'Profit booking at predefined levels'
            ],
            riskManagement: [
                'Max drawdown: 60k',
                'Position sizing based on margin',
                'Hedged positions only'
            ]
        },
        {
            id: 'sl-strangle-bnf',
            name: '1% SL Strangle BNF',
            description: 'Bank Nifty strangle strategy with 1% stop loss',
            category: 'Options',
            instrumentType: 'OPTIONS',
            timeframe: '5m',
            icon: <Timeline />,
            maxDD: '80.00k',
            margin: '₹0.00',
            logic: [
                '✓ Sell OTM Call and Put (Strangle)',
                '✓ 1% stop loss on each leg',
                '✓ Bank Nifty specific'
            ],
            entryRules: [
                'Sell strangle at market open',
                'Equal distance from ATM',
                'Premium collection strategy'
            ],
            exitRules: [
                '1% SL on individual legs',
                'Time-based exit at 3:15 PM',
                'Profit target: 50% of premium'
            ],
            riskManagement: [
                'Max loss: 1% per leg',
                'Hedge with far OTM options',
                'Position adjustment on breach'
            ]
        },
        {
            id: 'sl-strangle-bn-15',
            name: '1.5% SL Strangle BN',
            description: 'Bank Nifty strangle with wider 1.5% stop loss for better success rate',
            category: 'Options',
            instrumentType: 'OPTIONS',
            timeframe: '5m',
            icon: <Assessment />,
            maxDD: '1.2M',
            margin: '₹0.00',
            logic: [
                '✓ Wider stop loss for trending markets',
                '✓ 1.5% SL on each leg',
                '✓ Higher success rate'
            ],
            entryRules: [
                'Sell strangle after initial volatility',
                'Wider strike selection',
                'Premium optimization'
            ],
            exitRules: [
                '1.5% SL on individual legs',
                'Trailing stop after 30% profit',
                'Time decay advantage'
            ],
            riskManagement: [
                'Max drawdown: 1.2M',
                'Position sizing based on volatility',
                'Dynamic hedge adjustment'
            ]
        }
    ];

    const handleViewDetails = (template: StrategyTemplate) => {
        setSelectedTemplate(template);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setSelectedTemplate(null);
    };

    const handleAddToMyStrategy = (template: StrategyTemplate) => {
        // Navigate to create strategy with pre-filled data
        const fullDescription = `${template.description}

STRATEGY LOGIC:
${template.logic.join('\n')}

RISK MANAGEMENT:
${template.riskManagement.join('\n')}`;

        navigate('/strategies/create', {
            state: {
                template: {
                    name: template.name,
                    description: fullDescription,
                    instrumentType: template.instrumentType,
                    timeframe: template.timeframe,
                    entryRule: template.entryRules.join('\n\n'),
                    exitRule: template.exitRules.join('\n\n'),
                    symbol: template.instrumentType === 'OPTIONS' ? 'NIFTY' : '',
                    stopLossPercent: '2',
                    targetPercent: '5',
                    positionSize: '75',
                    maxPositions: '1'
                }
            }
        });
    };

    return (
        <Layout>
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Box mb={4}>
                    <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
                        Strategy Templates
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Ready-made strategies with proven logic. Clone and customize to your needs.
                    </Typography>
                </Box>

                <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(320px, 1fr))" gap={3}>
                    {templates.map((template) => (
                        <Card 
                            key={template.id} 
                            elevation={2}
                            sx={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: 4
                                }
                            }}
                        >
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box display="flex" alignItems="center" gap={2} mb={2}>
                                    <Box 
                                        sx={{ 
                                            p: 1.5, 
                                            borderRadius: 2, 
                                            bgcolor: 'primary.light',
                                            color: 'primary.main',
                                            display: 'flex'
                                        }}
                                    >
                                        {template.icon}
                                    </Box>
                                    <Box flex={1}>
                                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                                            {template.name}
                                        </Typography>
                                        <Chip 
                                            label={template.category} 
                                            size="small" 
                                            color="primary" 
                                            variant="outlined"
                                        />
                                    </Box>
                                </Box>

                                <Typography variant="body2" color="text.secondary" mb={2}>
                                    {template.description}
                                </Typography>

                                <Divider sx={{ my: 2 }} />

                                <Stack spacing={1}>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="caption" color="text.secondary">
                                            Instrument
                                        </Typography>
                                        <Typography variant="caption" fontWeight="bold">
                                            {template.instrumentType}
                                        </Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="caption" color="text.secondary">
                                            Timeframe
                                        </Typography>
                                        <Typography variant="caption" fontWeight="bold">
                                            {template.timeframe}
                                        </Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="caption" color="text.secondary">
                                            Max DD
                                        </Typography>
                                        <Typography variant="caption" fontWeight="bold" color="error">
                                            {template.maxDD}
                                        </Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="caption" color="text.secondary">
                                            Margin
                                        </Typography>
                                        <Typography variant="caption" fontWeight="bold" color="success.main">
                                            {template.margin}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>

                            <CardActions sx={{ p: 2, pt: 0 }}>
                                <Button 
                                    size="small" 
                                    onClick={() => handleViewDetails(template)}
                                    fullWidth
                                    variant="outlined"
                                >
                                    View Details
                                </Button>
                                <Button 
                                    size="small" 
                                    onClick={() => handleAddToMyStrategy(template)}
                                    fullWidth
                                    variant="contained"
                                    startIcon={<ContentCopy />}
                                >
                                    Add to My Strategy
                                </Button>
                            </CardActions>
                        </Card>
                    ))}
                </Box>

                {/* Details Dialog */}
                <Dialog 
                    open={dialogOpen} 
                    onClose={handleCloseDialog}
                    maxWidth="md"
                    fullWidth
                >
                    {selectedTemplate && (
                        <>
                            <DialogTitle>
                                <Box display="flex" alignItems="center" gap={2}>
                                    <Box 
                                        sx={{ 
                                            p: 1.5, 
                                            borderRadius: 2, 
                                            bgcolor: 'primary.light',
                                            color: 'primary.main',
                                            display: 'flex'
                                        }}
                                    >
                                        {selectedTemplate.icon}
                                    </Box>
                                    <Box>
                                        <Typography variant="h5" fontWeight="bold">
                                            {selectedTemplate.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {selectedTemplate.description}
                                        </Typography>
                                    </Box>
                                </Box>
                            </DialogTitle>
                            <DialogContent dividers>
                                <Stack spacing={3}>
                                    <Box>
                                        <Typography variant="h6" gutterBottom fontWeight="bold">
                                            Strategy Logic
                                        </Typography>
                                        <Stack spacing={1}>
                                            {selectedTemplate.logic.map((item, index) => (
                                                <Typography key={index} variant="body2">
                                                    {item}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>

                                    <Box>
                                        <Typography variant="h6" gutterBottom fontWeight="bold">
                                            Entry Rules
                                        </Typography>
                                        <Stack spacing={1}>
                                            {selectedTemplate.entryRules.map((rule, index) => (
                                                <Typography key={index} variant="body2">
                                                    {rule}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>

                                    <Box>
                                        <Typography variant="h6" gutterBottom fontWeight="bold">
                                            Exit Rules
                                        </Typography>
                                        <Stack spacing={1}>
                                            {selectedTemplate.exitRules.map((rule, index) => (
                                                <Typography key={index} variant="body2">
                                                    {rule}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>

                                    <Box>
                                        <Typography variant="h6" gutterBottom fontWeight="bold">
                                            Risk Management
                                        </Typography>
                                        <Stack spacing={1}>
                                            {selectedTemplate.riskManagement.map((item, index) => (
                                                <Typography key={index} variant="body2">
                                                    • {item}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>
                                </Stack>
                            </DialogContent>
                            <DialogActions sx={{ p: 2 }}>
                                <Button onClick={handleCloseDialog}>
                                    Close
                                </Button>
                                <Button 
                                    variant="contained" 
                                    onClick={() => {
                                        handleAddToMyStrategy(selectedTemplate);
                                        handleCloseDialog();
                                    }}
                                    startIcon={<ContentCopy />}
                                >
                                    Add to My Strategy
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
