import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Select,
  MenuItem
} from '@mui/material';
import {
  ArrowBack,
  Add,
  DeleteOutline,
  ContentCopy,
  InfoOutlined,
  AccessTime,
  CheckCircleOutline,
  EditOutlined
} from '@mui/icons-material';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

interface StrategyLegForm {
  id: string;
  action: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE';
  quantity: number;
  expiry: string;
  strikeCriteria: string;
  strikeType: string;
  slType: string;
  slValue: number;
  slOnPrice: string;
  tpType: string;
  tpValue: number;
  tpOnPrice: string;
  isActive: boolean;
}

const INSTRUMENT_PRESETS = [
  { name: 'NIFTY 50', lotSize: 65, exchange: 'NSE' },
  { name: 'NIFTY BANK', lotSize: 30, exchange: 'NSE' },
  { name: 'FINNIFTY', lotSize: 60, exchange: 'NSE' },
  { name: 'MIDCPNIFTY', lotSize: 75, exchange: 'NSE' },
  { name: 'SENSEX', lotSize: 20, exchange: 'BSE' },
  { name: 'RELIANCE', lotSize: 50, exchange: 'NSE' },
  { name: 'TCS', lotSize: 50, exchange: 'NSE' }
];

export const CreateStrategy: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const editId = params.id || searchParams.get('edit') || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 1. Strategy Type
  const [strategyType, setStrategyType] = useState<string>('Option Trading-Time Based');

  // 2. Select Instruments
  const [underlyingType, setUnderlyingType] = useState<'Spot' | 'Future'>('Spot');
  const [instrumentName, setInstrumentName] = useState('NIFTY BANK');
  const [lotSize, setLotSize] = useState(30);
  const [exchange, setExchange] = useState('NSE');

  // 3. Order Type & Timing
  const [orderType, setOrderType] = useState('MIS');
  const [startTime, setStartTime] = useState('09:16');
  const [squareOffTime, setSquareOffTime] = useState('15:10');
  const [tradingDays, setTradingDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);

  // 4. Strategy Legs
  const [legs, setLegs] = useState<StrategyLegForm[]>([
    {
      id: 'leg-1',
      action: 'SELL',
      optionType: 'CE',
      quantity: 30,
      expiry: 'MONTHLY',
      strikeCriteria: 'ATM pt',
      strikeType: 'ATM 0',
      slType: 'SL%',
      slValue: 1,
      slOnPrice: 'On Price',
      tpType: 'TP%',
      tpValue: 0,
      tpOnPrice: 'On Price',
      isActive: true
    },
    {
      id: 'leg-2',
      action: 'SELL',
      optionType: 'PE',
      quantity: 30,
      expiry: 'MONTHLY',
      strikeCriteria: 'ATM pt',
      strikeType: 'ATM 0',
      slType: 'SL%',
      slValue: 1,
      slOnPrice: 'On Price',
      tpType: 'TP%',
      tpValue: 0,
      tpOnPrice: 'On Price',
      isActive: true
    }
  ]);

  // 5. Risk Management
  const [exitOnLoss, setExitOnLoss] = useState('2200.10');
  const [exitOnProfit, setExitOnProfit] = useState('2200');
  const [noTradeAfter, setNoTradeAfter] = useState('15:10');
  const [profitTrailingMode, setProfitTrailingMode] = useState('Trail Profit');
  const [trailLockAmount, setTrailLockAmount] = useState('1200');
  const [trailStepAmount, setTrailStepAmount] = useState('200');

  // 6. Advanced Features
  const [advancedFeatures, setAdvancedFeatures] = useState<{ [key: string]: boolean }>({
    moveSlToCost: false,
    exitAllOnSlTgt: false,
    waitAndTrade: false,
    premiumDifference: false,
    trailSl: false,
    reEntryExecute: false
  });

  // 7. Strategy Name
  const [strategyName, setStrategyName] = useState('1 % SL strangle BNF');

  useEffect(() => {
    const fetchToEdit = async () => {
      if (!editId) {
        const template = (location.state as any)?.template;
        if (template) {
          if (template.name) setStrategyName(template.name);
          if (template.symbol) {
            setInstrumentName(template.symbol);
            const found = INSTRUMENT_PRESETS.find((p) => p.name === template.symbol);
            if (found) {
              setLotSize(found.lotSize);
              setExchange(found.exchange);
            }
          }
        }
        return;
      }

      try {
        setLoading(true);
        // Try strategy first, then template
        const [stratRes, tmplRes] = await Promise.all([
          axios.get(`${API_CONFIG.BASE_URL}/api/strategies/${editId}`).catch(() => null),
          axios.get(`${API_CONFIG.BASE_URL}/api/strategies/templates/${editId}`).catch(() => null)
        ]);

        const data = stratRes?.data?.strategy || tmplRes?.data?.template || stratRes?.data?.template;
        if (data) {
          if (data.name) setStrategyName(data.name);

          // Instrument & lot size
          const targetSymbol = data.symbol || data.symbols?.[0] || 'NIFTY BANK';
          setInstrumentName(targetSymbol);

          const preset = INSTRUMENT_PRESETS.find(
            (p) => p.name.toUpperCase() === targetSymbol.toUpperCase()
          );
          if (data.lotSize) {
            setLotSize(Number(data.lotSize));
          } else if (preset) {
            setLotSize(preset.lotSize);
          } else if (targetSymbol.toUpperCase().includes('BANK')) {
            setLotSize(30);
          } else {
            setLotSize(65);
          }

          if (data.underlyingType) setUnderlyingType(data.underlyingType);
          if (data.strategyType) {
            if (data.strategyType.includes('Indicator')) {
              setStrategyType(data.segmentType === 'EQUITY' ? 'Stocks & Futures -Indicator Based' : 'Option Trading-Indicator Based');
            } else {
              setStrategyType('Option Trading-Time Based');
            }
          }
          if (data.orderType) setOrderType(data.orderType);

          // Timing & Days
          if (data.startTime) setStartTime(String(data.startTime).replace(/\s*(AM|PM)/gi, '').trim());
          if (data.endTime || data.squareOffTime) {
            setSquareOffTime(String(data.endTime || data.squareOffTime).replace(/\s*(AM|PM)/gi, '').trim());
          }
          if (data.noTradeAfter) setNoTradeAfter(String(data.noTradeAfter));
          if (data.tradingDays && Array.isArray(data.tradingDays)) setTradingDays(data.tradingDays);

          // Legs
          if (data.legs && Array.isArray(data.legs) && data.legs.length > 0) {
            setLegs(data.legs.map((l: any, idx: number) => ({
              id: l.id || `leg-${idx + 1}`,
              action: l.action || 'SELL',
              optionType: l.optionType || (idx % 2 === 0 ? 'CE' : 'PE'),
              quantity: Number(l.quantity) || data.lotSize || 30,
              expiry: l.expiry || 'MONTHLY',
              strikeCriteria: l.strikeCriteria || 'ATM pt',
              strikeType: l.strikeType || l.strike || 'ATM 0',
              slType: l.slType || 'SL%',
              slValue: l.slValue !== undefined ? Number(l.slValue) : 1,
              slOnPrice: l.slOnPrice || 'On Price',
              tpType: l.tpType || l.targetType || 'TP%',
              tpValue: l.tpValue !== undefined ? Number(l.tpValue) : (l.targetValue !== undefined ? Number(l.targetValue) : 0),
              tpOnPrice: l.tpOnPrice || 'On Price',
              isActive: l.isActive !== undefined ? Boolean(l.isActive) : true
            })));
          }

          // Risk
          if (data.maxLoss) setExitOnLoss(String(data.maxLoss));
          if (data.maxProfit) setExitOnProfit(String(data.maxProfit));

          // Trailing SL
          if (data.trailingSl) {
            const tsl = String(data.trailingSl);
            if (tsl.includes('Lock and Trail')) setProfitTrailingMode('Lock and Trail');
            else if (tsl.includes('Lock Fix Profit')) setProfitTrailingMode('Lock Fix Profit');
            else if (tsl.includes('Trail Profit')) setProfitTrailingMode('Trail Profit');
            else if (tsl.includes('No Trailing')) setProfitTrailingMode('No Trailing');

            const match = tsl.match(/\((\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\)/);
            if (match) {
              setTrailLockAmount(match[1]);
              setTrailStepAmount(match[2]);
            }
          }

          // Advanced features
          if (data.advancedFeatures && typeof data.advancedFeatures === 'object') {
            setAdvancedFeatures((prev) => ({ ...prev, ...data.advancedFeatures }));
          }
        }
      } catch (e) {
        console.error('Failed to load strategy for edit:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchToEdit();
  }, [editId, location.state]);

  const handleInstrumentChange = (newInstrument: string) => {
    setInstrumentName(newInstrument);
    const preset = INSTRUMENT_PRESETS.find((p) => p.name === newInstrument);
    if (preset) {
      setLotSize(preset.lotSize);
      setExchange(preset.exchange);
      // Auto-update leg quantities to default lot size
      setLegs((prev) =>
        prev.map((leg) => ({
          ...leg,
          quantity: preset.lotSize
        }))
      );
    }
  };

  const handleDayToggle = (day: string) => {
    setTradingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleAddLeg = () => {
    const newLeg: StrategyLegForm = {
      id: `leg-${Date.now()}`,
      action: 'SELL',
      optionType: legs.length % 2 === 0 ? 'CE' : 'PE',
      quantity: lotSize,
      expiry: 'MONTHLY',
      strikeCriteria: 'ATM pt',
      strikeType: 'ATM 0',
      slType: 'SL%',
      slValue: 1,
      slOnPrice: 'On Price',
      tpType: 'TP%',
      tpValue: 0,
      tpOnPrice: 'On Price',
      isActive: true
    };
    setLegs((prev) => [...prev, newLeg]);
  };

  const handleCopyLeg = (index: number) => {
    setLegs((prev) => {
      const original = prev[index];
      if (!original) return prev;
      const copy: StrategyLegForm = {
        ...original,
        id: `leg-${Date.now()}`
      };
      return [...prev, copy];
    });
  };

  const handleRemoveLeg = (index: number) => {
    setLegs((prev) => {
      if (prev.length <= 1) return prev;
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleUpdateLeg = (index: number, updates: Partial<StrategyLegForm>) => {
    setLegs((prev) => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length) {
        updated[index] = { ...updated[index], ...updates };
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: strategyName.trim(),
        author: 'Trader',
        segmentType: strategyType.includes('Stocks') ? 'EQUITY' : 'OPTION',
        strategyType: strategyType.includes('Indicator') ? 'Indicator Based' : 'Time Based',
        symbol: instrumentName,
        underlyingType,
        orderType,
        lotSize: Number(lotSize) || 30,
        startTime,
        endTime: squareOffTime,
        tradingDays,
        legs: legs.map((l) => ({
          id: l.id,
          action: l.action,
          symbol: instrumentName,
          strike: l.strikeType || 'ATM 0',
          strikeType: l.strikeType || 'ATM 0',
          strikeCriteria: l.strikeCriteria || 'ATM pt',
          optionType: l.optionType,
          quantity: Number(l.quantity) || lotSize,
          expiry: l.expiry || 'MONTHLY',
          slType: l.slType || 'SL%',
          slValue: l.slValue !== undefined && l.slValue !== null ? Number(l.slValue) : 1,
          slOnPrice: l.slOnPrice || 'On Price',
          targetType: l.tpType || 'TP%',
          targetValue: l.tpValue !== undefined && l.tpValue !== null ? Number(l.tpValue) : 0,
          tpType: l.tpType || 'TP%',
          tpValue: l.tpValue !== undefined && l.tpValue !== null ? Number(l.tpValue) : 0,
          tpOnPrice: l.tpOnPrice || 'On Price',
          isActive: l.isActive
        })),
        maxProfit: Number(exitOnProfit) || 2200,
        maxLoss: Number(exitOnLoss) || 2200.10,
        noTradeAfter,
        trailingSl: `${profitTrailingMode} (${trailLockAmount}/${trailStepAmount})`,
        advancedFeatures,
        status: 'active'
      };

      if (editId) {
        await axios.put(
          `${API_CONFIG.BASE_URL}/api/strategies/${editId}`,
          payload
        ).catch(async () => {
          // If not in custom strategies, update template
          await axios.put(
            `${API_CONFIG.BASE_URL}/api/strategies/templates/${editId}`,
            payload
          );
        });
      } else {
        await axios.post(
          `${API_CONFIG.BASE_URL}/api/strategies`,
          payload
        );
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/strategies');
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save strategy.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        {/* Top Navigation & Status Bar */}
        <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/strategies')}
            sx={{
              color: '#2563eb',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              p: 0,
              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
            }}
          >
            Back to Strategies
          </Button>

          {editId && (
            <Chip
              icon={<EditOutlined sx={{ fontSize: '15px !important' }} />}
              label={`Editing Strategy ID: ${editId}`}
              sx={{
                bgcolor: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 700,
                fontSize: '0.8rem',
                border: '1px solid #bfdbfe'
              }}
            />
          )}
        </Box>

        {/* Header Title */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', mb: 0.5 }}>
            {editId ? `Edit Strategy Logic: ${strategyName}` : 'Create New Strategy'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Customize all execution legs, timings, instrument contracts, and profit/loss parameters with real-time broker synchronization.
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}
        {success && (
          <Alert severity="success" icon={<CheckCircleOutline />} sx={{ mb: 2.5, borderRadius: 2 }}>
            {editId ? 'Strategy updated successfully! Redirecting...' : 'Strategy created successfully! Redirecting...'}
          </Alert>
        )}

        {/* 2-Column Grid Layout */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1fr' }, gap: 3 }}>
          {/* LEFT COLUMN: Strategy Type, Select Instruments, Order Type, Risk Management */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Card 1: Strategy Type */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 1.5, fontSize: '0.95rem' }}>
                1. Strategy Execution Type
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  'Option Trading-Time Based',
                  'Option Trading-Indicator Based',
                  'Stocks & Futures -Indicator Based'
                ].map((type) => (
                  <FormControlLabel
                    key={type}
                    control={
                      <Radio
                        checked={strategyType === type}
                        onChange={() => setStrategyType(type)}
                        sx={{ color: '#94a3b8', '&.Mui-checked': { color: '#2563eb' } }}
                      />
                    }
                    label={<Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{type}</Typography>}
                  />
                ))}
              </Box>
            </Paper>

            {/* Card 2: Select Instruments & Contract */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                  2. Select Instrument & Contract
                </Typography>
                <Chip
                  label={`${underlyingType} Mode`}
                  size="small"
                  sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '0.72rem' }}
                />
              </Box>

              {/* Underlying Toggle */}
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>
                  Underlying Type
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1 }}>
                  Choose reference used for calculations and strike selection.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant={underlyingType === 'Spot' ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setUnderlyingType('Spot')}
                    sx={{
                      bgcolor: underlyingType === 'Spot' ? '#2563eb' : 'transparent',
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2,
                      px: 2.5
                    }}
                  >
                    Spot
                  </Button>
                  <Button
                    variant={underlyingType === 'Future' ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setUnderlyingType('Future')}
                    sx={{
                      bgcolor: underlyingType === 'Future' ? '#2563eb' : 'transparent',
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2,
                      px: 2.5
                    }}
                  >
                    Future
                  </Button>
                </Box>
              </Box>

              {/* Interactive Instrument & Lot Size Controls */}
              <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr' }, gap: 2, mb: 2 }}>
                  {/* Select Instrument Dropdown */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, display: 'block', mb: 0.8 }}>
                      TRADING INSTRUMENT
                    </Typography>
                    <Select
                      size="small"
                      value={instrumentName}
                      onChange={(e) => handleInstrumentChange(e.target.value)}
                      fullWidth
                      sx={{
                        bgcolor: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        '& .MuiSelect-select': { py: 1 }
                      }}
                    >
                      {INSTRUMENT_PRESETS.map((item) => (
                        <MenuItem key={item.name} value={item.name} sx={{ fontWeight: 600 }}>
                          {item.name} ({item.exchange} • Lot {item.lotSize})
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>

                  {/* Lot Size with Plus/Minus buttons */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, display: 'block', mb: 0.8 }}>
                      LOT SIZE (QTY PER LOT)
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2, overflow: 'hidden' }}>
                      <Button
                        size="small"
                        onClick={() => setLotSize((prev) => Math.max(1, prev - 5))}
                        sx={{ minWidth: 36, p: 0.5, color: '#334155', fontWeight: 800, bgcolor: '#f1f5f9' }}
                      >
                        -
                      </Button>
                      <TextField
                        size="small"
                        type="number"
                        value={lotSize}
                        onChange={(e) => setLotSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        inputProps={{ min: 1, style: { textAlign: 'center', padding: '6px 4px', fontWeight: 700 } }}
                        sx={{ flex: 1, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
                      />
                      <Button
                        size="small"
                        onClick={() => setLotSize((prev) => prev + 5)}
                        sx={{ minWidth: 36, p: 0.5, color: '#334155', fontWeight: 800, bgcolor: '#f1f5f9' }}
                      >
                        +
                      </Button>
                    </Box>
                  </Box>
                </Box>

                {/* Exchange info row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1.5, borderTop: '1px solid #e2e8f0' }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                    Active Exchange: <strong style={{ color: '#0f172a' }}>{exchange}</strong>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                    Segment: <strong style={{ color: '#2563eb' }}>{strategyType.includes('Stocks') ? 'EQUITY' : 'OPTION'}</strong>
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Card 3: Order Type & Timing */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5, fontSize: '0.95rem' }}>
                3. Order Type & Timing Schedule
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
                Configure order placement type, entry window, and auto square-off timing.
              </Typography>

              <RadioGroup row value={orderType} onChange={(e) => setOrderType(e.target.value)} sx={{ mb: 2 }}>
                <FormControlLabel value="MIS" control={<Radio size="small" sx={{ color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }} />} label={<Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>MIS (Intraday)</Typography>} />
                <FormControlLabel value="CNC" control={<Radio size="small" sx={{ color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }} />} label={<Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>CNC (Delivery)</Typography>} />
                <FormControlLabel value="NRML" control={<Radio size="small" sx={{ color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }} />} label={<Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>NRML (Normal)</Typography>} />
                <FormControlLabel value="BTST" control={<Radio size="small" sx={{ color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }} />} label={<Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>BTST</Typography>} />
              </RadioGroup>

              {/* Start Time & Square Off Inputs */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Start Time (IST)
                  </Typography>
                  <TextField
                    size="small"
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="09:16"
                    InputProps={{ endAdornment: <AccessTime sx={{ fontSize: 18, color: '#94a3b8' }} /> }}
                    fullWidth
                  />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Square Off Time (IST)
                  </Typography>
                  <TextField
                    size="small"
                    type="text"
                    value={squareOffTime}
                    onChange={(e) => setSquareOffTime(e.target.value)}
                    placeholder="15:10"
                    InputProps={{ endAdornment: <AccessTime sx={{ fontSize: 18, color: '#94a3b8' }} /> }}
                    fullWidth
                  />
                </Box>
              </Box>

              {/* Trading Day Pills */}
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.8 }}>
                  Active Trading Days
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day) => {
                    const isSelected = tradingDays.includes(day);
                    return (
                      <Button
                        key={day}
                        variant={isSelected ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => handleDayToggle(day)}
                        sx={{
                          minWidth: 52,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          bgcolor: isSelected ? '#eff6ff' : 'transparent',
                          color: isSelected ? '#2563eb' : '#64748b',
                          borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                          boxShadow: 'none',
                          '&:hover': { bgcolor: isSelected ? '#dbeafe' : '#f8fafc', boxShadow: 'none' }
                        }}
                      >
                        {day}
                      </Button>
                    );
                  })}
                </Box>
              </Box>
            </Paper>

            {/* Card 4: Risk Management */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                  4. Risk Management & Profit Trailing
                </Typography>
                <Tooltip title="Global strategy profit and loss controls">
                  <InfoOutlined sx={{ fontSize: 16, color: '#94a3b8' }} />
                </Tooltip>
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
                Control your trading outcomes by setting global limits on losses and profits, and automating profit lock & trail rules.
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 2, mb: 2, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                  Exit When Over All Loss In Amount (₹ INR)
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  value={exitOnLoss}
                  onChange={(e) => setExitOnLoss(e.target.value)}
                  fullWidth
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 2, mb: 2, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                  Exit When Over All Profit In Amount (₹ INR)
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  value={exitOnProfit}
                  onChange={(e) => setExitOnProfit(e.target.value)}
                  fullWidth
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 2, mb: 2.5, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                  No Trade After (Time)
                </Typography>
                <TextField
                  size="small"
                  value={noTradeAfter}
                  onChange={(e) => setNoTradeAfter(e.target.value)}
                  placeholder="15:10"
                  InputProps={{ endAdornment: <AccessTime sx={{ fontSize: 18, color: '#94a3b8' }} /> }}
                  fullWidth
                />
              </Box>

              {/* Profit Trailing Mode */}
              <Box sx={{ mt: 1, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, display: 'block', mb: 1 }}>
                  Profit Trailing Rules
                </Typography>
                <RadioGroup row value={profitTrailingMode} onChange={(e) => setProfitTrailingMode(e.target.value)} sx={{ gap: 1, mb: 1.5 }}>
                  <FormControlLabel value="No Trailing" control={<Radio size="small" />} label={<Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>No Trailing</Typography>} />
                  <FormControlLabel value="Lock Fix Profit" control={<Radio size="small" />} label={<Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Lock Fix Profit</Typography>} />
                  <FormControlLabel value="Trail Profit" control={<Radio size="small" />} label={<Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Trail Profit</Typography>} />
                  <FormControlLabel value="Lock and Trail" control={<Radio size="small" />} label={<Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Lock and Trail</Typography>} />
                </RadioGroup>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem', display: 'block', mb: 0.5 }}>Lock Threshold (₹)</Typography>
                    <TextField size="small" value={trailLockAmount} onChange={(e) => setTrailLockAmount(e.target.value)} fullWidth />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem', display: 'block', mb: 0.5 }}>Trail Step (₹)</Typography>
                    <TextField size="small" value={trailStepAmount} onChange={(e) => setTrailStepAmount(e.target.value)} fullWidth />
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* RIGHT COLUMN: Strategy Legs, Advance Features, Strategy Name & Save */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Card 5: Strategy Legs */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                    5. Strategy Legs ({legs.length})
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Individually customize strikes, stop losses, and target profits per leg.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add />}
                  onClick={handleAddLeg}
                  sx={{
                    bgcolor: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 2,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
                  }}
                >
                  Add Leg
                </Button>
              </Box>

              {/* Legs Container */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {legs.map((leg, idx) => (
                  <Paper
                    key={leg.id}
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 2.5,
                      border: '1px solid #e2e8f0',
                      bgcolor: leg.isActive ? '#ffffff' : '#f8fafc',
                      opacity: leg.isActive ? 1 : 0.75,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Leg Header Row */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          Leg {idx + 1}:
                        </Typography>
                        <Chip
                          label={`${leg.action} ${leg.optionType}`}
                          size="small"
                          sx={{
                            bgcolor: leg.action === 'BUY' ? '#dcfce7' : '#fee2e2',
                            color: leg.action === 'BUY' ? '#166534' : '#991b1b',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            height: 22
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                          label={leg.isActive ? 'ACTIVE' : 'DISABLED'}
                          size="small"
                          onClick={() => handleUpdateLeg(idx, { isActive: !leg.isActive })}
                          clickable
                          sx={{
                            bgcolor: leg.isActive ? '#dbeafe' : '#f1f5f9',
                            color: leg.isActive ? '#1e40af' : '#64748b',
                            fontWeight: 800,
                            fontSize: '0.68rem',
                            height: 22
                          }}
                        />
                        <IconButton size="small" onClick={() => handleCopyLeg(idx)} sx={{ color: '#f59e0b' }}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                        {legs.length > 1 && (
                          <IconButton size="small" onClick={() => handleRemoveLeg(idx)} sx={{ color: '#ef4444' }}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>

                    {/* Subtitle badge */}
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2, fontSize: '0.75rem' }}>
                      {leg.action} {leg.optionType} • {instrumentName} • Qty {leg.quantity} • Strike {leg.strikeType} • SL {leg.slValue}% • TP {leg.tpValue}%
                    </Typography>

                    {/* Leg Controls Grid: Row 1 (Qty, Position, Option Type) */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 1.5, mb: 1.5 }}>
                      {/* Qty Counter with Manual Typing Support */}
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>Qty (Shares)</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 2, bgcolor: '#ffffff', overflow: 'hidden' }}>
                          <Button
                            size="small"
                            onClick={() => handleUpdateLeg(idx, { quantity: Math.max(1, (Number(leg.quantity) || lotSize) - lotSize) })}
                            sx={{ minWidth: 32, p: 0.5, color: '#334155', fontWeight: 800, bgcolor: '#f8fafc', borderRadius: 0, '&:hover': { bgcolor: '#f1f5f9' } }}
                          >
                            -
                          </Button>
                          <TextField
                            size="small"
                            type="number"
                            value={leg.quantity}
                            onChange={(e) => handleUpdateLeg(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                            inputProps={{
                              min: 1,
                              style: { textAlign: 'center', padding: '5px 4px', fontWeight: 700, fontSize: '0.88rem' }
                            }}
                            sx={{
                              flex: 1,
                              '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                            }}
                          />
                          <Button
                            size="small"
                            onClick={() => handleUpdateLeg(idx, { quantity: (Number(leg.quantity) || 0) + lotSize })}
                            sx={{ minWidth: 32, p: 0.5, color: '#334155', fontWeight: 800, bgcolor: '#f8fafc', borderRadius: 0, '&:hover': { bgcolor: '#f1f5f9' } }}
                          >
                            +
                          </Button>
                        </Box>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>Lot: {lotSize}</Typography>
                      </Box>

                      {/* Position Toggle (BUY / SELL) */}
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>Position</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button
                            variant={leg.action === 'BUY' ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => handleUpdateLeg(idx, { action: 'BUY' })}
                            sx={{ flex: 1, textTransform: 'none', fontWeight: 700, bgcolor: leg.action === 'BUY' ? '#dcfce7' : 'transparent', color: leg.action === 'BUY' ? '#166534' : '#64748b', borderColor: '#d1d5db', boxShadow: 'none' }}
                          >
                            BUY
                          </Button>
                          <Button
                            variant={leg.action === 'SELL' ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => handleUpdateLeg(idx, { action: 'SELL' })}
                            sx={{ flex: 1, textTransform: 'none', fontWeight: 700, bgcolor: leg.action === 'SELL' ? '#fee2e2' : 'transparent', color: leg.action === 'SELL' ? '#991b1b' : '#64748b', borderColor: '#d1d5db', boxShadow: 'none' }}
                          >
                            SELL
                          </Button>
                        </Box>
                      </Box>

                      {/* Option Type Toggle (Call / Put) */}
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>Option Type</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button
                            variant={leg.optionType === 'CE' ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => handleUpdateLeg(idx, { optionType: 'CE' })}
                            sx={{ flex: 1, textTransform: 'none', fontWeight: 700, bgcolor: leg.optionType === 'CE' ? '#eff6ff' : 'transparent', color: leg.optionType === 'CE' ? '#1e40af' : '#64748b', borderColor: '#d1d5db', boxShadow: 'none' }}
                          >
                            Call (CE)
                          </Button>
                          <Button
                            variant={leg.optionType === 'PE' ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => handleUpdateLeg(idx, { optionType: 'PE' })}
                            sx={{ flex: 1, textTransform: 'none', fontWeight: 700, bgcolor: leg.optionType === 'PE' ? '#fdf2f8' : 'transparent', color: leg.optionType === 'PE' ? '#9d174d' : '#64748b', borderColor: '#d1d5db', boxShadow: 'none' }}
                          >
                            Put (PE)
                          </Button>
                        </Box>
                      </Box>
                    </Box>

                    {/* Expiry, Strike Criteria, Strike Type Row */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, mb: 1.5 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>Expiry</Typography>
                        <Select
                          size="small"
                          value={leg.expiry}
                          onChange={(e) => handleUpdateLeg(idx, { expiry: e.target.value })}
                          fullWidth
                          sx={{ bgcolor: '#ffffff', fontSize: '0.85rem' }}
                        >
                          <MenuItem value="WEEKLY">WEEKLY</MenuItem>
                          <MenuItem value="NEXT WEEKLY">NEXT WEEKLY</MenuItem>
                          <MenuItem value="MONTHLY">MONTHLY</MenuItem>
                          <MenuItem value="QUARTERLY">QUARTERLY</MenuItem>
                        </Select>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>Strike Criteria</Typography>
                        <Select
                          size="small"
                          value={leg.strikeCriteria}
                          onChange={(e) => handleUpdateLeg(idx, { strikeCriteria: e.target.value })}
                          fullWidth
                          sx={{ bgcolor: '#ffffff', fontSize: '0.85rem' }}
                        >
                          <MenuItem value="ATM pt">ATM pt</MenuItem>
                          <MenuItem value="ATM %">ATM %</MenuItem>
                          <MenuItem value="Delta">Delta</MenuItem>
                          <MenuItem value="Premium Range">Premium Range</MenuItem>
                        </Select>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>Strike Type</Typography>
                        <TextField
                          size="small"
                          value={leg.strikeType}
                          onChange={(e) => handleUpdateLeg(idx, { strikeType: e.target.value })}
                          placeholder="ATM 0"
                          fullWidth
                          sx={{ bgcolor: '#ffffff' }}
                        />
                      </Box>
                    </Box>

                    {/* Stop Loss Row */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, mb: 1.5 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>SL Type</Typography>
                        <Select
                          size="small"
                          value={leg.slType}
                          onChange={(e) => handleUpdateLeg(idx, { slType: e.target.value })}
                          fullWidth
                          sx={{ bgcolor: '#ffffff', fontSize: '0.85rem' }}
                        >
                          <MenuItem value="SL%">SL%</MenuItem>
                          <MenuItem value="Points">Points</MenuItem>
                          <MenuItem value="Underlying %">Underlying %</MenuItem>
                        </Select>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>SL Value</Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={leg.slValue}
                          onChange={(e) => handleUpdateLeg(idx, { slValue: Number(e.target.value) })}
                          fullWidth
                          sx={{ bgcolor: '#ffffff' }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>SL On Price</Typography>
                        <Select
                          size="small"
                          value={leg.slOnPrice}
                          onChange={(e) => handleUpdateLeg(idx, { slOnPrice: e.target.value })}
                          fullWidth
                          sx={{ bgcolor: '#ffffff', fontSize: '0.85rem' }}
                        >
                          <MenuItem value="On Price">On Price</MenuItem>
                          <MenuItem value="On Underlying">On Underlying</MenuItem>
                        </Select>
                      </Box>
                    </Box>

                    {/* Target Profit Row */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>TP Type</Typography>
                        <Select
                          size="small"
                          value={leg.tpType}
                          onChange={(e) => handleUpdateLeg(idx, { tpType: e.target.value })}
                          fullWidth
                          sx={{ bgcolor: '#ffffff', fontSize: '0.85rem' }}
                        >
                          <MenuItem value="TP%">TP%</MenuItem>
                          <MenuItem value="Points">Points</MenuItem>
                          <MenuItem value="Underlying %">Underlying %</MenuItem>
                        </Select>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>TP Value</Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={leg.tpValue}
                          onChange={(e) => handleUpdateLeg(idx, { tpValue: Number(e.target.value) })}
                          fullWidth
                          sx={{ bgcolor: '#ffffff' }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>TP On Price</Typography>
                        <Select
                          size="small"
                          value={leg.tpOnPrice}
                          onChange={(e) => handleUpdateLeg(idx, { tpOnPrice: e.target.value })}
                          fullWidth
                          sx={{ bgcolor: '#ffffff', fontSize: '0.85rem' }}
                        >
                          <MenuItem value="On Price">On Price</MenuItem>
                          <MenuItem value="On Underlying">On Underlying</MenuItem>
                        </Select>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Paper>

            {/* Card 6: Advance Execution Features */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                  6. Advanced Execution Controls
                </Typography>
                <Tooltip title="Dynamic stop-loss movement and execution controls">
                  <InfoOutlined sx={{ fontSize: 16, color: '#94a3b8' }} />
                </Tooltip>
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
                Enable dynamic stop-loss to cost, multi-leg synchronization, and conditional order triggers.
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                {[
                  { key: 'moveSlToCost', label: 'Move SL to Cost' },
                  { key: 'exitAllOnSlTgt', label: 'Exit All on SL/Tgt' },
                  { key: 'waitAndTrade', label: 'Wait & Trade' },
                  { key: 'premiumDifference', label: 'Premium Difference' },
                  { key: 'trailSl', label: 'Trail SL' },
                  { key: 'reEntryExecute', label: 'Re Entry/Execute' }
                ].map((feat) => (
                  <FormControlLabel
                    key={feat.key}
                    control={
                      <Checkbox
                        size="small"
                        checked={advancedFeatures[feat.key]}
                        onChange={(e) => setAdvancedFeatures({ ...advancedFeatures, [feat.key]: e.target.checked })}
                      />
                    }
                    label={<Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>{feat.label}</Typography>}
                  />
                ))}
              </Box>
            </Paper>

            {/* Card 7: Strategy Name & Save/Deploy Action */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 1, fontSize: '0.95rem' }}>
                7. Strategy Name & Save
              </Typography>
              <TextField
                size="small"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder="Enter strategy name"
                fullWidth
                sx={{ mb: 2.5 }}
              />

              <Button
                variant="contained"
                fullWidth
                disabled={loading}
                onClick={handleSubmit}
                sx={{
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  textTransform: 'none',
                  borderRadius: 2.5,
                  py: 1.4,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
                }}
              >
                {loading ? (
                  <CircularProgress size={22} color="inherit" />
                ) : editId ? (
                  'Save & Update Strategy Logic'
                ) : (
                  'Save & Deploy Strategy'
                )}
              </Button>
            </Paper>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
};

export default CreateStrategy;
