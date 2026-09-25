import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Switch,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Tooltip,
  Alert,
  styled
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  ContentCopy,
  Check,
  Visibility,
  VisibilityOff,
  ArrowBack
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { brokerApi, BrokerSummary } from '../services/brokerApi';
import { API_CONFIG } from '../config/api';

// iOS-style clean switch matching Screenshot 1
const CustomSwitch = styled((props: any) => (
  <Switch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
))(() => ({
  width: 42,
  height: 24,
  padding: 0,
  display: 'flex',
  '& .MuiSwitch-switchBase': {
    padding: 2,
    transitionDuration: '200ms',
    '&.Mui-checked': {
      transform: 'translateX(18px)',
      color: '#ffffff',
      '& + .MuiSwitch-track': {
        backgroundColor: '#2563eb',
        opacity: 1,
        border: 0,
      },
    },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 20,
    height: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
    backgroundColor: '#ffffff',
  },
  '& .MuiSwitch-track': {
    borderRadius: 24 / 2,
    backgroundColor: '#cbd5e1',
    opacity: 1,
    transition: 'background-color 200ms ease',
  },
}));

export const Brokers: React.FC = () => {
  const [brokers, setBrokers] = useState<BrokerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'profile'>('list');
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialMethod = searchParams.get('method') === 'token' ? 'token' : 'developer';

  // Form Fields (Matching Screenshot 2) - retain previous input for easy re-auth
  const [clientId, setClientId] = useState(() => localStorage.getItem('dhan_pending_client_id') || localStorage.getItem('dhan_saved_client_id') || '');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [authMethod, setAuthMethod] = useState<'developer' | 'token'>(initialMethod);
  const [showSecret, setShowSecret] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  // Switch states
  const [tradingEngineStates, setTradingEngineStates] = useState<Record<string, boolean>>({});
  const [terminalStates, setTerminalStates] = useState<Record<string, boolean>>({});

  // 3-dots Menu & Actions
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedBroker, setSelectedBroker] = useState<BrokerSummary | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; severity: 'success' | 'info' | 'error' | 'warning' } | null>(null);

  const redirectUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dhan-connect`
    : 'https://web.algorooms.com/connect-broker';

  const fetchBrokers = useCallback(async () => {
    try {
      const [list, engineRes] = await Promise.all([
        brokerApi.getBrokers(),
        axios.get(`${API_CONFIG.BASE_URL}/api/trading/engine/status`).catch(() => ({ data: { success: false, isRunning: false } }))
      ]);

      setBrokers(list);

      const isRunning = engineRes.data?.isRunning ?? false;
      const engines: Record<string, boolean> = {};
      const terminals: Record<string, boolean> = {};

      list.forEach((b) => {
        engines[b.id] = isRunning;
        terminals[b.id] = b.terminalEnabled ?? true;
      });

      setTradingEngineStates(engines);
      setTerminalStates(terminals);

      if (list.length > 0) {
        setViewMode('list');
        setFormSuccess('');
      } else {
        const cached = brokerApi.getActiveBroker();
        if (cached) {
          setBrokers([cached]);
          setViewMode('list');
        } else {
          setViewMode('add');
        }
      }
    } catch (error) {
      console.error('Failed to fetch brokers:', error);
      const cached = brokerApi.getActiveBroker();
      if (cached) {
        setBrokers([cached]);
        setViewMode('list');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleTerminal = (brokerId: string) => {
    setTerminalStates((prev) => ({
      ...prev,
      [brokerId]: !(prev[brokerId] ?? true)
    }));
  };

  const handleToggleTradingEngine = async (brokerId: string) => {
    const current = tradingEngineStates[brokerId] ?? false;
    const next = !current;
    setTradingEngineStates((prev) => ({ ...prev, [brokerId]: next }));
    try {
      if (next) {
        await axios.post(`${API_CONFIG.BASE_URL}/api/trading/engine/start`);
        setActionFeedback({ message: 'Trading Engine enabled and running.', severity: 'success' });
      } else {
        await axios.post(`${API_CONFIG.BASE_URL}/api/trading/engine/stop`);
        setActionFeedback({ message: 'Trading Engine stopped.', severity: 'info' });
      }
    } catch (e: any) {
      setTradingEngineStates((prev) => ({ ...prev, [brokerId]: current }));
      setActionFeedback({ message: 'Failed to toggle trading engine.', severity: 'error' });
    }
  };

  useEffect(() => {
    fetchBrokers();
  }, [fetchBrokers]);

  // Listen for OAuth message from popup or storage event
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DHAN_OAUTH_SUCCESS' && event.data?.broker) {
        setFormSuccess('Dhan broker connected successfully!');
        setSubmitting(false);
        setViewMode('list');
        fetchBrokers();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'dhan_oauth_completed') {
        localStorage.removeItem('dhan_oauth_completed');
        setFormSuccess('Dhan broker connected successfully!');
        setSubmitting(false);
        setViewMode('list');
        fetchBrokers();
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchBrokers]);

  const handleCopyRedirect = () => {
    navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !apiKey.trim() || !apiSecret.trim()) {
      setFormError('Please fill in Broker ID, API Key, and API Secret Key.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      localStorage.setItem('dhan_pending_client_id', clientId.trim());
      localStorage.setItem('dhan_saved_client_id', clientId.trim());

      const res = await brokerApi.generateDhanConsent({
        clientId: clientId.trim(),
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim()
      });

      if (res.success && res.loginUrl) {
        if (res.consentAppId) {
          localStorage.setItem('dhan_pending_consent_id', res.consentAppId);
        }

        setFormSuccess('Redirecting to official Dhan login...');
        // Clean direct redirect - official Dhan OAuth flow
        window.location.href = res.loginUrl;
      } else {
        setFormError(res.message || 'Failed to initiate Dhan authorization session.');
        setSubmitting(false);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Connection failed.');
      setSubmitting(false);
    }
  };

  const handleDirectTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !accessToken.trim()) {
      setFormError('Both Client ID and 24-Hour Access Token are required.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      localStorage.setItem('dhan_saved_client_id', clientId.trim());

      const res = await brokerApi.connectDhan({
        clientId: clientId.trim(),
        accessToken: accessToken.trim()
      });

      if (res.success && res.broker) {
        setFormSuccess('Dhan account verified with live API and connected successfully!');
        setSubmitting(false);
        await fetchBrokers();
        setViewMode('list');
      } else {
        setFormError(res.message || 'Verification failed. Please check your credentials.');
        setSubmitting(false);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to connect Dhan broker.');
      setSubmitting(false);
    }
  };

  const handleTestConnection = async (brokerId: string) => {
    setTestingPing(true);
    const start = Date.now();
    try {
      const f = await brokerApi.getFunds(brokerId);
      const elapsed = Date.now() - start;
      setPingLatency(elapsed);

      // Immediately promote broker status to 'Connected' in state & localStorage
      setBrokers((prev) =>
        prev.map((b) => {
          if (b.id === brokerId || !brokerId || prev.length === 1) {
            return { ...b, status: 'Connected' as const, funds: f || b.funds };
          }
          return b;
        })
      );

      const cached = brokerApi.getActiveBroker();
      if (cached) {
        cached.status = 'Connected';
        if (f) cached.funds = f;
        localStorage.setItem('mavrix_saved_brokers', JSON.stringify([cached]));
      }

      if (f) {
        setActionFeedback({
          message: `Verified DhanHQ Live Connection (${elapsed}ms). Total Balance: ₹${(f.totalAccountBalance || f.availableMargin || 0).toLocaleString()}`,
          severity: 'success'
        });
      } else {
        setActionFeedback({
          message: `Connection responsive & verified (${elapsed}ms)`,
          severity: 'success'
        });
      }
    } catch (e: any) {
      setActionFeedback({
        message: `Dhan Connection Notice: ${e.message}`,
        severity: 'warning'
      });
    } finally {
      setTestingPing(false);
    }
  };

  const handleDisconnect = async (brokerId: string) => {
    try {
      await brokerApi.disconnectBroker(brokerId);
      setBrokers([]);
      setMenuAnchorEl(null);
      setViewMode('add');
      setClientId('');
      setApiKey('');
      setApiSecret('');
    } catch (err) {
      console.error('Failed to disconnect broker', err);
    }
  };

  const handleSquareOff = async () => {
    const brokerToSquare = selectedBroker;
    setMenuAnchorEl(null);
    if (!brokerToSquare) return;
    try {
      setActionFeedback({ message: 'Triggering Square Off on Dhan...', severity: 'info' });

      const res = await brokerApi.squareOff(brokerToSquare.id);
      if (res.success) {
        setActionFeedback({ message: res.message || 'All open positions squared off successfully!', severity: 'success' });
      } else {
        setActionFeedback({ message: res.message || 'Square Off completed (no active positions).', severity: 'info' });
      }
    } catch (err: any) {
      setActionFeedback({ message: err.response?.data?.message || err.message || 'Square Off failed.', severity: 'error' });
    }
  };



  const handleDeleteBroker = async () => {
    const brokerToDelete = selectedBroker;
    setMenuAnchorEl(null);
    if (!brokerToDelete) return;
    try {
      await handleDisconnect(brokerToDelete.id);
      setActionFeedback({ message: 'Broker disconnected successfully.', severity: 'success' });
    } catch (err: any) {
      setActionFeedback({ message: 'Failed to disconnect broker.', severity: 'error' });
    }
  };

  return (
    <Layout>
      {viewMode === 'list' ? (
        /* ========================================================= */
        /* VIEW 1: BROKER LIST (Matching Screenshot 1)               */
        /* ========================================================= */
        <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
              gap: 1.5,
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 2.5,
              px: { xs: 2, sm: 2.5 },
              py: { xs: 1.5, sm: 2 },
              boxShadow: '0 1px 3px 0 rgba(15,23,42,0.04)'
            }}
          >
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  color: '#0f172a',
                  fontSize: { xs: '1.1rem', sm: '1.3rem' },
                  lineHeight: 1.2
                }}
              >
                Broker
              </Typography>
              <Typography
                sx={{
                  color: '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  mt: 0.2
                }}
              >
                Manage your connected brokers
              </Typography>
            </Box>

            <Button
              variant="contained"
              onClick={() => {
                setViewMode('add');
                setFormError('');
                setFormSuccess('');
              }}
              sx={{
                bgcolor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                textTransform: 'none',
                px: { xs: 2, sm: 2.5 },
                py: 1,
                borderRadius: '8px',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
              }}
            >
              + Add Broker
            </Button>
          </Box>

          {/* Action Feedback Banner */}
          {actionFeedback && (
            <Alert
              severity={actionFeedback.severity}
              onClose={() => setActionFeedback(null)}
              sx={{ mb: 2.5, borderRadius: '8px', fontSize: '0.85rem' }}
            >
              {actionFeedback.message}
            </Alert>
          )}

          {/* Brokers Content */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={30} sx={{ color: '#2563eb' }} />
            </Box>
          ) : brokers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ color: '#64748b', fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>
                No broker connected yet.
              </Typography>
              <Button
                variant="contained"
                onClick={() => setViewMode('add')}
                sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700, borderRadius: '8px', '&:hover': { bgcolor: '#1d4ed8' } }}
              >
                + Add Broker
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {brokers.map((broker) => {
                const isConnected = broker.status === 'Connected';
                const terminalOn = terminalStates[broker.id] ?? true;
                const tradingEngineOn = tradingEngineStates[broker.id] ?? false;

                return (
                  <Box
                    key={broker.id}
                    sx={{
                      p: { xs: 2, sm: 2.5 },
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      bgcolor: '#ffffff',
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      justifyContent: 'space-between',
                      gap: { xs: 2, sm: 3 },
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'border-color 0.2s ease',
                      '&:hover': {
                        borderColor: '#cbd5e1'
                      }
                    }}
                  >
                    {/* Left: Logo + Broker Name + Client ID + Connected */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '10px',
                          bgcolor: '#00A25B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: '1.3rem',
                          fontFamily: 'serif',
                          flexShrink: 0
                        }}
                      >
                        ध
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem', lineHeight: 1.2 }}>
                          {broker.broker || 'DHAN'}
                        </Typography>
                        <Typography sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.82rem', mt: 0.3 }}>
                          {broker.clientId || '1108893841'}
                        </Typography>
                        <Typography sx={{ color: '#16a34a', fontWeight: 700, fontSize: '0.78rem', mt: 0.2 }}>
                          {isConnected ? 'Connected' : 'Disconnected'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Center: Strategy Performance */}
                    <Box sx={{ textAlign: { xs: 'left', sm: 'center' }, minWidth: 120 }}>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600 }}>
                        Strategy Performance
                      </Typography>
                      <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', mt: 0.2 }}>
                        0.00
                      </Typography>
                    </Box>

                    {/* Right: Terminal toggle, Trading Engine toggle, 3 dots menu */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2.5, sm: 3 } }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
                        <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>
                          Terminal
                        </Typography>
                        <CustomSwitch
                          checked={terminalOn}
                          onChange={() => handleToggleTerminal(broker.id)}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
                        <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>
                          Trading Engine
                        </Typography>
                        <CustomSwitch
                          checked={tradingEngineOn}
                          onChange={() => handleToggleTradingEngine(broker.id)}
                        />
                      </Box>

                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setMenuAnchorEl(e.currentTarget);
                          setSelectedBroker(broker);
                        }}
                        sx={{ color: '#94a3b8', '&:hover': { color: '#0f172a' } }}
                      >
                        <MoreVertIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      ) : (
        /* ========================================================= */
        /* VIEW 2: ADD YOUR BROKER DETAIL (Matching Screenshot 2)    */
        /* ========================================================= */
        <Box
          sx={{
            width: '100%',
            maxWidth: 500,
            mx: 'auto',
            bgcolor: '#ffffff',
            borderRadius: { xs: 3, sm: 4 },
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
            p: { xs: 2.5, sm: 3.5 }
          }}
        >
          {/* Back Button if brokers exist */}
          {brokers.length > 0 && (
            <Button
              size="small"
              startIcon={<ArrowBack sx={{ fontSize: 16 }} />}
              onClick={() => setViewMode('list')}
              sx={{
                mb: 2,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                color: '#64748b',
                p: 0,
                '&:hover': { bgcolor: 'transparent', color: '#2563eb' }
              }}
            >
              Back to Brokers
            </Button>
          )}

          {/* Heading */}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              color: '#0f172a',
              fontSize: '1.25rem',
              lineHeight: 1.2
            }}
          >
            Connect Dhan Broker
          </Typography>
          <Typography
            sx={{
              color: '#64748b',
              fontSize: '0.82rem',
              mt: 0.5,
              mb: 2.5,
              lineHeight: 1.4
            }}
          >
            Authenticate with DhanHQ to enable live algorithmic trading and position tracking.
          </Typography>

          {/* Dhan Brand Card */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 2,
              mb: 2.5,
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              bgcolor: '#f8fafc',
              gap: 2
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                bgcolor: '#00A25B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.35rem',
                fontFamily: 'serif',
                flexShrink: 0
              }}
            >
              ध
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', lineHeight: 1.2 }}>
                DhanHQ Official Broker
              </Typography>
              <Typography sx={{ color: '#64748b', fontSize: '0.78rem', mt: 0.2 }}>
                Real-time NSE/BSE Trading & Execution API
              </Typography>
            </Box>
          </Box>

          {/* Connection Method Tabs */}
          <Box
            sx={{
              display: 'flex',
              p: 0.5,
              mb: 2.5,
              bgcolor: '#f1f5f9',
              borderRadius: '10px'
            }}
          >
            <Button
              fullWidth
              size="small"
              onClick={() => { setAuthMethod('developer'); setFormError(''); }}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                py: 0.8,
                bgcolor: authMethod === 'developer' ? '#ffffff' : 'transparent',
                color: authMethod === 'developer' ? '#0f172a' : '#64748b',
                boxShadow: authMethod === 'developer' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                '&:hover': {
                  bgcolor: authMethod === 'developer' ? '#ffffff' : '#e2e8f0'
                }
              }}
            >
              Developer API Key (12-Mo)
            </Button>
            <Button
              fullWidth
              size="small"
              onClick={() => { setAuthMethod('token'); setFormError(''); }}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                py: 0.8,
                bgcolor: authMethod === 'token' ? '#ffffff' : 'transparent',
                color: authMethod === 'token' ? '#0f172a' : '#64748b',
                boxShadow: authMethod === 'token' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                '&:hover': {
                  bgcolor: authMethod === 'token' ? '#ffffff' : '#e2e8f0'
                }
              }}
            >
              Direct Access Token (24-Hr)
            </Button>
          </Box>

          {formError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '10px', fontSize: '0.8rem' }}>
              {formError}
            </Alert>
          )}

          {formSuccess && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: '10px', fontSize: '0.8rem' }}>
              {formSuccess}
            </Alert>
          )}

          {/* Form */}
          <form
            onSubmit={authMethod === 'token' ? handleDirectTokenSubmit : handleSubmit}
            autoComplete="off"
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Field 1: Broker ID */}
              <Box>
                <Typography sx={{ fontWeight: 700, color: '#1e293b', display: 'block', mb: 0.6, fontSize: '0.82rem' }}>
                  Broker ID (Dhan Client ID)
                </Typography>
                <TextField
                  placeholder="e.g. 1108893841"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  name="dhan_client_id_no_autofill"
                  autoComplete="off"
                  inputProps={{
                    autoComplete: 'off',
                    spellCheck: 'false'
                  }}
                  InputProps={{
                    sx: {
                      borderRadius: '10px',
                      bgcolor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      '& fieldset': { border: 'none' },
                      '&:hover': { bgcolor: '#f1f5f9' },
                      '&.Mui-focused': { bgcolor: '#ffffff', border: '1.5px solid #2563eb' },
                      fontSize: '0.875rem'
                    }
                  }}
                />
              </Box>

              {authMethod === 'token' ? (
                /* Direct 24-hr Access Token Input */
                <Box>
                  <Typography sx={{ fontWeight: 700, color: '#1e293b', display: 'block', mb: 0.6, fontSize: '0.82rem' }}>
                    24-Hour Access Token
                  </Typography>
                  <TextField
                    placeholder="Paste Dhan Access Token from web.dhan.co"
                    type={showSecret ? 'text' : 'password'}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    required
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                    name="dhan_access_token_no_autofill"
                    autoComplete="new-password"
                    inputProps={{
                      autoComplete: 'new-password',
                      spellCheck: 'false'
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                          <IconButton onClick={() => setShowSecret(!showSecret)} edge="end" size="small">
                            {showSecret ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                      sx: {
                        borderRadius: '10px',
                        bgcolor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        '& fieldset': { border: 'none' },
                        '&:hover': { bgcolor: '#f1f5f9' },
                        '&.Mui-focused': { bgcolor: '#ffffff', border: '1.5px solid #2563eb' },
                        fontSize: '0.82rem'
                      }
                    }}
                  />
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.5 }}>
                    Generate directly from Dhan Web → Profile → Access DhanHQ APIs → Access Token.
                  </Typography>
                </Box>
              ) : (
                /* Developer API Key & Secret Inputs */
                <>
                  {/* Field 2: API Key */}
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: '#1e293b', display: 'block', mb: 0.6, fontSize: '0.82rem' }}>
                      API Key
                    </Typography>
                    <TextField
                      placeholder="Paste Dhan API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      required
                      fullWidth
                      size="small"
                      name="dhan_api_key_no_autofill"
                      autoComplete="new-password"
                      inputProps={{
                        autoComplete: 'new-password',
                        spellCheck: 'false'
                      }}
                      InputProps={{
                        sx: {
                          borderRadius: '10px',
                          bgcolor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          '& fieldset': { border: 'none' },
                          '&:hover': { bgcolor: '#f1f5f9' },
                          '&.Mui-focused': { bgcolor: '#ffffff', border: '1.5px solid #2563eb' },
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                  </Box>

                  {/* Field 3: API Secret Key */}
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: '#1e293b', display: 'block', mb: 0.6, fontSize: '0.82rem' }}>
                      API Secret Key
                    </Typography>
                    <TextField
                      placeholder="Paste Dhan API Secret Key"
                      type={showSecret ? 'text' : 'password'}
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      required
                      fullWidth
                      size="small"
                      name="dhan_api_secret_no_autofill"
                      autoComplete="new-password"
                      inputProps={{
                        autoComplete: 'new-password',
                        spellCheck: 'false'
                      }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowSecret(!showSecret)} edge="end" size="small">
                              {showSecret ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                        sx: {
                          borderRadius: '10px',
                          bgcolor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          '& fieldset': { border: 'none' },
                          '&:hover': { bgcolor: '#f1f5f9' },
                          '&.Mui-focused': { bgcolor: '#ffffff', border: '1.5px solid #2563eb' },
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                  </Box>

                  {/* Redirect URL Box */}
                  <Box sx={{ mt: 0.5, p: 1.5, bgcolor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 600 }}>
                        Redirect URL for Dhan Developer App
                      </Typography>
                      <Tooltip title={copied ? 'Copied!' : 'Copy URL'} arrow>
                        <IconButton size="small" onClick={handleCopyRedirect} sx={{ color: copied ? '#16a34a' : '#64748b', p: 0.4 }}>
                          {copied ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography
                      sx={{
                        color: '#2563eb',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}
                    >
                      {redirectUrl}
                    </Typography>
                  </Box>
                </>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting}
                variant="contained"
                fullWidth
                sx={{
                  mt: 1,
                  py: 1.2,
                  borderRadius: '10px',
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                {submitting ? (
                  <>
                    <CircularProgress size={18} sx={{ color: '#ffffff' }} />
                    Verifying with DhanHQ...
                  </>
                ) : authMethod === 'token' ? (
                  'Connect with Access Token'
                ) : (
                  'Connect to Dhan Broker'
                )}
              </Button>
            </Box>
          </form>
        </Box>
      )}

      {/* 3-dots Dropdown Menu matching user reference screenshot */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          elevation: 3,
          sx: {
            borderRadius: '10px',
            minWidth: 160,
            py: 0.5,
            border: '1px solid #f1f5f9',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
          }
        }}
      >
        <MenuItem
          onClick={() => {
            if (selectedBroker) handleTestConnection(selectedBroker.id);
            setMenuAnchorEl(null);
          }}
          sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', py: 1, px: 2 }}
        >
          Ping & Verify API
        </MenuItem>

        <MenuItem
          onClick={handleSquareOff}
          sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', py: 1, px: 2 }}
        >
          Square Off Positions
        </MenuItem>

        <MenuItem
          onClick={handleDeleteBroker}
          sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#dc2626', py: 1, px: 2 }}
        >
          Disconnect Account
        </MenuItem>
      </Menu>
    </Layout>
  );
};

export default Brokers;