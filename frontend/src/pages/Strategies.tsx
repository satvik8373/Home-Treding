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
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Autocomplete
} from '@mui/material';
import { Add, Edit, Delete, PlayArrow, Pause, Close, Assessment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import firestoreService, { Strategy } from '../services/firestoreService';
import Layout from '../components/Layout';

// Popular Indian stocks list
const POPULAR_STOCKS = [
  // Indices
  'NIFTY 50', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY',
  // Top stocks
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
  'BHARTIARTL', 'KOTAKBANK', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA',
  'TITAN', 'ULTRACEMCO', 'BAJFINANCE', 'NESTLEIND', 'WIPRO', 'HCLTECH', 'TECHM',
  'POWERGRID', 'NTPC', 'ONGC', 'TATAMOTORS', 'TATASTEEL', 'ADANIPORTS', 'JSWSTEEL',
  'INDUSINDBK', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'EICHERMOT', 'BAJAJFINSV', 'GRASIM',
  'HINDALCO', 'COALINDIA', 'BPCL', 'BRITANNIA', 'SHREECEM', 'HEROMOTOCO', 'TATACONSUM',
  'APOLLOHOSP', 'SBILIFE', 'HDFCLIFE', 'BAJAJ-AUTO', 'M&M', 'ADANIENT', 'ADANIGREEN',
  'VEDL', 'GODREJCP', 'DABUR', 'HAVELLS', 'PIDILITIND', 'BERGEPAINT', 'SIEMENS',
  'DLF', 'GAIL', 'AMBUJACEM', 'ACC', 'BANDHANBNK', 'BANKBARODA', 'PNB', 'CANBK'
];

const Strategies: React.FC = () => {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [strategyType, setStrategyType] = useState<'time' | 'indicator'>('time');

  // Entry conditions state
  const [longEntryConditions, setLongEntryConditions] = useState([
    { indicator: '', comparator: '', value: '' }
  ]);
  const [shortEntryConditions, setShortEntryConditions] = useState([
    { indicator: '', comparator: '', value: '' }
  ]);
  const [exitConditions, setExitConditions] = useState([
    { indicator: '', comparator: '', value: '' }
  ]);

  const [formData, setFormData] = useState({
    name: '',
    strategyType: 'time',
    // Instruments
    selectedInstruments: [] as string[],
    // Common fields
    orderType: 'MIS',
    startTime: '09:16',
    squareOffTime: '15:15',

    // Time-based fields
    orderLegs: '',

    // Indicator-based fields
    transactionType: 'both',
    chartType: 'candle',
    interval: '5Min',
    useCombinedChart: false,
    maxTradeCycle: 1,

    // Risk management (common)
    profitAmount: '',
    lossAmount: '',
    noTradeAfter: '15:15',
    profitTrailing: 'no',

    // For Firestore compatibility
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
      const savedType = (strategy as any).strategyType || 'time';
      setStrategyType(savedType);
      setFormData({
        name: strategy.name,
        strategyType: savedType,
        selectedInstruments: (strategy as any).selectedInstruments || (strategy.symbol ? [strategy.symbol] : []),
        orderType: (strategy as any).orderType || 'MIS',
        startTime: (strategy as any).startTime || '09:16',
        squareOffTime: (strategy as any).squareOffTime || '15:15',
        orderLegs: (strategy as any).orderLegs || '',
        transactionType: (strategy as any).transactionType || 'both',
        chartType: (strategy as any).chartType || 'candle',
        interval: (strategy as any).interval || '5Min',
        useCombinedChart: (strategy as any).useCombinedChart || false,
        maxTradeCycle: (strategy as any).maxTradeCycle || 1,
        profitAmount: (strategy as any).profitAmount || '',
        lossAmount: (strategy as any).lossAmount || '',
        noTradeAfter: (strategy as any).noTradeAfter || '15:15',
        profitTrailing: (strategy as any).profitTrailing || 'no',
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
      setStrategyType('time');
      setFormData({
        name: '',
        strategyType: 'time',
        selectedInstruments: [],
        orderType: 'MIS',
        startTime: '09:16',
        squareOffTime: '15:15',
        orderLegs: '',
        transactionType: 'both',
        chartType: 'candle',
        interval: '5Min',
        useCombinedChart: false,
        maxTradeCycle: 1,
        profitAmount: '',
        lossAmount: '',
        noTradeAfter: '15:15',
        profitTrailing: 'no',
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
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setError('You must be logged in');
        return;
      }

      if (!formData.name) {
        setError('Please enter strategy name');
        return;
      }

      const strategyData = {
        name: formData.name,
        description: `${strategyType === 'time' ? 'Time-based' : 'Indicator-based'} strategy - ${formData.selectedInstruments.join(', ')}`,
        instrumentType: formData.instrumentType,
        symbol: formData.selectedInstruments.length > 0 ? formData.selectedInstruments[0] : 'NIFTY 50',
        timeframe: strategyType === 'indicator' ? formData.interval : formData.timeframe,
        entryRule: strategyType === 'indicator'
          ? `Long: ${longEntryConditions.map(c => `${c.indicator} ${c.comparator} ${c.value}`).join(', ')}, Short: ${shortEntryConditions.map(c => `${c.indicator} ${c.comparator} ${c.value}`).join(', ')}`
          : formData.entryRule || 'Time-based entry',
        exitRule: exitConditions.length > 0 && exitConditions[0].indicator
          ? exitConditions.map(c => `${c.indicator} ${c.comparator} ${c.value}`).join(', ')
          : formData.exitRule || 'Time-based exit',
        stopLossPercent: formData.lossAmount ? parseFloat(formData.lossAmount) : formData.stopLossPercent,
        targetPercent: formData.profitAmount ? parseFloat(formData.profitAmount) : formData.targetPercent,
        positionSize: formData.positionSize,
        status: 'draft' as const,
        // Store all form data
        selectedInstruments: formData.selectedInstruments,
        strategyType: strategyType,
        orderType: formData.orderType,
        startTime: formData.startTime,
        squareOffTime: formData.squareOffTime,
        orderLegs: formData.orderLegs,
        transactionType: formData.transactionType,
        chartType: formData.chartType,
        interval: formData.interval,
        useCombinedChart: formData.useCombinedChart,
        maxTradeCycle: formData.maxTradeCycle,
        profitAmount: formData.profitAmount,
        lossAmount: formData.lossAmount,
        noTradeAfter: formData.noTradeAfter,
        profitTrailing: formData.profitTrailing
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
                      <Box>
                        <Typography variant="h6">
                          {strategy.name}
                        </Typography>
                        <Chip
                          label={(strategy as any).strategyType === 'indicator' ? 'Indicator' : 'Time'}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
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
                      title={strategy.status === 'live' ? 'Pause Strategy' : 'Start Strategy'}
                    >
                      {strategy.status === 'live' ? <Pause /> : <PlayArrow />}
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="primary"
                      onClick={() => window.open(`/strategy-test?strategyId=${strategy.id}`, '_blank')}
                      title="Test Strategy"
                    >
                      <Assessment />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handleOpenDialog(strategy)}
                      title="Edit Strategy"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="error" 
                      onClick={() => handleDelete(strategy.id)}
                      title="Delete Strategy"
                    >
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

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
              {/* Strategy Template Selector */}
              {!editingStrategy && (
                <Box>
                  <TextField
                    select
                    fullWidth
                    label="Strategy Template (Optional)"
                    helperText="Select a pre-configured strategy template or create from scratch"
                    onChange={(e) => {
                      if (e.target.value === 'fcb009') {
                        // Auto-populate strategy with complete logic
                        setStrategyType('indicator');
                        setFormData({
                          ...formData,
                          name: 'First Candle Breakout with Averaging',
                          strategyType: 'indicator',
                          selectedInstruments: ['NIFTY 50'],
                          symbol: 'NIFTY 50',
                          orderType: 'MIS',
                          startTime: '09:16',
                          squareOffTime: '15:15',
                          transactionType: 'both',
                          chartType: 'candle',
                          interval: '5Min',
                          useCombinedChart: false,
                          maxTradeCycle: 2,
                          profitAmount: 'Dynamic',
                          lossAmount: 'Day_High_Low',
                          noTradeAfter: '15:15',
                          profitTrailing: 'no',
                          entryRule: 'Gap ±150pts → First Candle 9:20 → Upper(A×1.0009)/Lower(A×0.9991) → Trigger Candle → Breakout → Average if -20pts',
                          exitRule: 'Target: Upper-Lower Trigger Diff | SL: Day High/Low | Close after averaging',
                          instrumentType: 'INDEX',
                          timeframe: '5m'
                        });
                        // Set entry conditions
                        setLongEntryConditions([
                          { indicator: 'Gap_Filter', comparator: '<=', value: '150' },
                          { indicator: 'First_Candle_9:20', comparator: 'close', value: 'A' },
                          { indicator: 'Candle_Close', comparator: '>', value: 'Upper_Trigger(A×1.0009)' },
                          { indicator: 'Price', comparator: '>', value: 'Call_Trigger_High' },
                          { indicator: 'Premium_Loss', comparator: '>=', value: '20_Add_1_Lot' }
                        ]);
                        setShortEntryConditions([
                          { indicator: 'Gap_Filter', comparator: '<=', value: '150' },
                          { indicator: 'First_Candle_9:20', comparator: 'close', value: 'A' },
                          { indicator: 'Candle_Close', comparator: '<', value: 'Lower_Trigger(A×0.9991)' },
                          { indicator: 'Price', comparator: '<', value: 'Put_Trigger_Low' },
                          { indicator: 'Premium_Loss', comparator: '>=', value: '20_Add_1_Lot' }
                        ]);
                        setExitConditions([
                          { indicator: 'Target', comparator: '=', value: 'Upper_Trigger-Lower_Trigger' },
                          { indicator: 'Call_SL', comparator: '=', value: 'Day_Low' },
                          { indicator: 'Put_SL', comparator: '=', value: 'Day_High' },
                          { indicator: 'Close_After', comparator: '=', value: 'Target_or_SL_Hit' }
                        ]);
                      }
                    }}
                  >
                    <MenuItem value="fcb009">
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          First Candle Breakout with Averaging
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Gap filter → Triggers → Breakout → 20pt Averaging → Dynamic Target
                        </Typography>
                      </Box>
                    </MenuItem>
                  </TextField>
                  
                  {/* Strategy Description Box */}
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      📋 First Candle Breakout with Averaging Strategy
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                      If the market opens within <strong>±150 points</strong> of the previous day's close, only then trading is allowed; otherwise, no trades for the day. 
                      After market opens, wait for the <strong>5-minute candle at 9:20 AM</strong> and mark its Close as <strong>A</strong>. 
                      Calculate <strong>Upper Trigger = A × 1.0009</strong>, <strong>Lower Trigger = A × 0.9991</strong>, and the <strong>Target = Upper Trigger − Lower Trigger</strong>. 
                      If any candle closes above the Upper Trigger, that candle becomes the <strong>Call Trigger Candle</strong>, and an <strong>ATM Call</strong> is bought only when price breaks above the high of this candle. 
                      If any candle closes below the Lower Trigger, that candle becomes the <strong>Put Trigger Candle</strong>, and an <strong>ATM Put</strong> is bought only when price breaks below the low of this candle. 
                      After entering a trade, if the <strong>option premium falls 20 points below the entry price</strong>, one additional lot is bought (averaging) <strong>only once</strong>. 
                      The <strong>Stop Loss for Call is the Day Low</strong> of the underlying index, and <strong>Stop Loss for Put is the Day High</strong> of the index, while the <strong>target is the calculated difference (Upper Trigger − Lower Trigger)</strong>. 
                      Once target or SL is hit (including after averaging), the trade is closed. 
                      Stop-loss for a Call trade is the <strong>Day Low</strong> of the index, and for a Put trade is the <strong>Day High</strong> of the index, 
                      while the target is a <strong>fixed profit point value</strong> on the premium (not percentage).
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label="Gap: ±150 pts" size="small" color="primary" />
                      <Chip label="First Candle: 9:20 AM" size="small" color="primary" />
                      <Chip label="Triggers: A×1.0009/0.9991" size="small" color="primary" />
                      <Chip label="Averaging: -20pts → +1 Lot" size="small" color="warning" />
                      <Chip label="Target: Upper-Lower Diff" size="small" color="success" />
                      <Chip label="SL: Day High/Low" size="small" color="error" />
                    </Box>
                  </Alert>
                </Box>
              )}

              {/* Strategy Name */}
              <TextField
                fullWidth
                label="Strategy Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter strategy name"
              />

              {/* Strategy Type Selection */}
              <FormControl component="fieldset">
                <FormLabel>Strategy Type</FormLabel>
                <RadioGroup
                  row
                  value={strategyType}
                  onChange={(e) => {
                    setStrategyType(e.target.value as 'time' | 'indicator');
                    setFormData({ ...formData, strategyType: e.target.value });
                  }}
                >
                  <FormControlLabel value="time" control={<Radio />} label="Time Based" />
                  <FormControlLabel value="indicator" control={<Radio />} label="Indicator Based" />
                </RadioGroup>
              </FormControl>

              <Divider />

              {/* Common Fields */}
              <Typography variant="subtitle1" fontWeight={600}>Select Instruments</Typography>

              {/* Instrument Selection with Search */}
              <Autocomplete
                multiple
                freeSolo
                options={POPULAR_STOCKS}
                value={formData.selectedInstruments}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    selectedInstruments: newValue,
                    symbol: newValue.length > 0 ? newValue[0] : ''
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search and Select Stocks"
                    placeholder="Type to search stocks (e.g., RELIANCE, TCS, NIFTY 50)"
                    helperText="Select one or more stocks/indices. You can also type custom symbols."
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option}
                      {...getTagProps({ index })}
                      color="primary"
                      size="small"
                    />
                  ))
                }
              />

              <FormControl component="fieldset">
                <FormLabel>Order Type</FormLabel>
                <RadioGroup
                  row
                  name="orderType"
                  value={formData.orderType}
                  onChange={handleChange}
                >
                  <FormControlLabel value="MIS" control={<Radio />} label="MIS" />
                  <FormControlLabel value="CNC" control={<Radio />} label="CNC" />
                  <FormControlLabel value="BTST" control={<Radio />} label="BTST" />
                </RadioGroup>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Start Time"
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  label="Square Off"
                  name="squareOffTime"
                  type="time"
                  value={formData.squareOffTime}
                  onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

              {/* Time-Based Specific Fields */}
              {strategyType === 'time' && (
                <>
                  <TextField
                    fullWidth
                    label="Order Legs"
                    name="orderLegs"
                    value={formData.orderLegs}
                    onChange={handleChange}
                    placeholder="Define order legs"
                    multiline
                    rows={2}
                  />
                </>
              )}

              {/* Indicator-Based Specific Fields */}
              {strategyType === 'indicator' && (
                <>
                  <FormControl component="fieldset">
                    <FormLabel>Transaction Type</FormLabel>
                    <RadioGroup
                      row
                      name="transactionType"
                      value={formData.transactionType}
                      onChange={handleChange}
                    >
                      <FormControlLabel value="both" control={<Radio />} label="Both Side" />
                      <FormControlLabel value="long" control={<Radio />} label="Only Long" />
                      <FormControlLabel value="short" control={<Radio />} label="Only Short" />
                    </RadioGroup>
                  </FormControl>

                  <FormControl component="fieldset">
                    <FormLabel>Chart Type</FormLabel>
                    <RadioGroup
                      row
                      name="chartType"
                      value={formData.chartType}
                      onChange={handleChange}
                    >
                      <FormControlLabel value="candle" control={<Radio />} label="Candle" />
                      <FormControlLabel value="heikin" control={<Radio />} label="Heikin-Ashi" />
                    </RadioGroup>
                  </FormControl>

                  <TextField
                    fullWidth
                    select
                    label="Interval"
                    name="interval"
                    value={formData.interval}
                    onChange={handleChange}
                  >
                    <MenuItem value="1Min">1 Min</MenuItem>
                    <MenuItem value="3Min">3 Min</MenuItem>
                    <MenuItem value="5Min">5 Min</MenuItem>
                    <MenuItem value="10Min">10 Min</MenuItem>
                    <MenuItem value="15Min">15 Min</MenuItem>
                    <MenuItem value="30Min">30 Min</MenuItem>
                    <MenuItem value="1H">1 Hour</MenuItem>
                  </TextField>

                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={600}>Entry conditions</Typography>
                      <FormControlLabel
                        control={
                          <input
                            type="checkbox"
                            checked={formData.useCombinedChart}
                            onChange={(e) => setFormData({ ...formData, useCombinedChart: e.target.checked })}
                          />
                        }
                        label="Use Combined Chart"
                      />
                    </Box>

                    {/* Long Entry Condition */}
                    <Typography variant="body2" color="success.main" fontWeight={600} sx={{ mb: 1 }}>
                      Long Entry condition
                    </Typography>
                    {longEntryConditions.map((condition, index) => (
                      <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                          select
                          label="Select Indicator"
                          value={condition.indicator}
                          onChange={(e) => {
                            const newConditions = [...longEntryConditions];
                            newConditions[index].indicator = e.target.value;
                            setLongEntryConditions(newConditions);
                          }}
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">Select Indicator</MenuItem>
                          <MenuItem value="0.09">0.09</MenuItem>

                      
                        </TextField>

                        <TextField
                          select
                          label="Select Comparator"
                          value={condition.comparator}
                          onChange={(e) => {
                            const newConditions = [...longEntryConditions];
                            newConditions[index].comparator = e.target.value;
                            setLongEntryConditions(newConditions);
                          }}
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">Select Comparator</MenuItem>
                          <MenuItem value=">">Greater than (&gt;)</MenuItem>
                          <MenuItem value="<">Less than (&lt;)</MenuItem>
                          <MenuItem value="=">Equal to (=)</MenuItem>
                          <MenuItem value=">=">Greater than or equal (≥)</MenuItem>
                          <MenuItem value="<=">Less than or equal (≤)</MenuItem>
                          <MenuItem value="crosses_above">Crosses above</MenuItem>
                          <MenuItem value="crosses_below">Crosses below</MenuItem>
                        </TextField>

                        <TextField
                          select
                          label="Select Indicator"
                          value={condition.value}
                          onChange={(e) => {
                            const newConditions = [...longEntryConditions];
                            newConditions[index].value = e.target.value;
                            setLongEntryConditions(newConditions);
                          }}
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">Select Indicator</MenuItem>
                          <MenuItem value="20">20</MenuItem>
                          <MenuItem value="30">30</MenuItem>
                          <MenuItem value="50">50</MenuItem>
                          <MenuItem value="70">70</MenuItem>
                          <MenuItem value="80">80</MenuItem>
                          <MenuItem value="EMA">EMA</MenuItem>
                          <MenuItem value="SMA">SMA</MenuItem>
                          <MenuItem value="Price">Price</MenuItem>
                        </TextField>

                        {index > 0 && (
                          <IconButton
                            color="error"
                            onClick={() => {
                              const newConditions = longEntryConditions.filter((_, i) => i !== index);
                              setLongEntryConditions(newConditions);
                            }}
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </Box>
                    ))}

                    {/* Short Entry Condition */}
                    <Typography variant="body2" color="error.main" fontWeight={600} sx={{ mb: 1, mt: 2 }}>
                      Short Entry condition
                    </Typography>
                    {shortEntryConditions.map((condition, index) => (
                      <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                          select
                          label="Select Indicator"
                          value={condition.indicator}
                          onChange={(e) => {
                            const newConditions = [...shortEntryConditions];
                            newConditions[index].indicator = e.target.value;
                            setShortEntryConditions(newConditions);
                          }}
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">Select Indicator</MenuItem>
                          <MenuItem value="0.09">0.09</MenuItem>
                         
                        </TextField>

                        <TextField
                          select
                          label="Select Comparator"
                          value={condition.comparator}
                          onChange={(e) => {
                            const newConditions = [...shortEntryConditions];
                            newConditions[index].comparator = e.target.value;
                            setShortEntryConditions(newConditions);
                          }}
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">Select Comparator</MenuItem>
                          <MenuItem value=">">Greater than (&gt;)</MenuItem>
                          <MenuItem value="<">Less than (&lt;)</MenuItem>
                          <MenuItem value="=">Equal to (=)</MenuItem>
                          <MenuItem value="crosses_above">Crosses above</MenuItem>
                          <MenuItem value="crosses_below">Crosses below</MenuItem>
                        </TextField>

                        <TextField
                          select
                          label="Select Indicator"
                          value={condition.value}
                          onChange={(e) => {
                            const newConditions = [...shortEntryConditions];
                            newConditions[index].value = e.target.value;
                            setShortEntryConditions(newConditions);
                          }}
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">Select Indicator</MenuItem>
                          <MenuItem value="20">20</MenuItem>
                          <MenuItem value="30">30</MenuItem>
                          <MenuItem value="50">50</MenuItem>
                          <MenuItem value="70">70</MenuItem>
                          <MenuItem value="80">80</MenuItem>
                        </TextField>

                        {index > 0 && (
                          <IconButton
                            color="error"
                            onClick={() => {
                              const newConditions = shortEntryConditions.filter((_, i) => i !== index);
                              setShortEntryConditions(newConditions);
                            }}
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </Box>
                    ))}

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setLongEntryConditions([...longEntryConditions, { indicator: '', comparator: '', value: '' }]);
                        setShortEntryConditions([...shortEntryConditions, { indicator: '', comparator: '', value: '' }]);
                      }}
                      sx={{ mb: 2 }}
                    >
                      Add Condition +
                    </Button>

                    {/* Exit Conditions */}
                    <FormControlLabel
                      control={
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (!e.target.checked) {
                              setExitConditions([{ indicator: '', comparator: '', value: '' }]);
                            }
                          }}
                        />
                      }
                      label="Exit conditions (Optional)"
                      sx={{ mb: 1 }}
                    />
                  </Box>

                  <TextField
                    fullWidth
                    label="Max Trade Cycle"
                    name="maxTradeCycle"
                    type="number"
                    value={formData.maxTradeCycle}
                    onChange={handleChange}
                    inputProps={{ min: 1 }}
                  />
                </>
              )}

              <Divider />

              {/* Risk Management */}
              <Typography variant="subtitle1" fontWeight={600}>Risk Management</Typography>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Exit When Over All Profit In Amount (INR)"
                  name="profitAmount"
                  value={formData.profitAmount}
                  onChange={handleChange}
                  placeholder="Target profit amount"
                />
                <TextField
                  fullWidth
                  label="Exit When Over All Loss In Amount (INR)"
                  name="lossAmount"
                  value={formData.lossAmount}
                  onChange={handleChange}
                  placeholder="Stop loss amount"
                />
              </Box>

              <TextField
                fullWidth
                label="No Trade After"
                name="noTradeAfter"
                type="time"
                value={formData.noTradeAfter}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />

              <FormControl component="fieldset">
                <FormLabel>Profit Trailing</FormLabel>
                <RadioGroup
                  row
                  name="profitTrailing"
                  value={formData.profitTrailing}
                  onChange={handleChange}
                >
                  <FormControlLabel value="no" control={<Radio />} label="No Trailing" />
                  <FormControlLabel value="lock" control={<Radio />} label="Lock Fix Profit" />
                  <FormControlLabel value="trail" control={<Radio />} label="Trail Profit" />
                  <FormControlLabel value="lockTrail" control={<Radio />} label="Lock and Trail" />
                </RadioGroup>
              </FormControl>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!formData.name}
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
