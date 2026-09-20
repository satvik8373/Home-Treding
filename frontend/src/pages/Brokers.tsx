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
  Snackbar,
  Alert,
  styled,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  ContentCopy,
  Check,
  Close,
  InfoOutlined,
  Visibility,
  VisibilityOff,
  Refresh,
  DeleteOutline,
  VpnKey,
  ArrowBack,
  AccountCircle
} from '@mui/icons-material';
import Layout from '../components/Layout';
import { brokerApi, BrokerSummary } from '../services/brokerApi';

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
  const [selectedProfileBroker, setSelectedProfileBroker] = useState<BrokerSummary | null>(null);

  // Form Fields (Matching Screenshot 2) - retain previous input for easy re-auth
  const [clientId, setClientId] = useState(() => localStorage.getItem('dhan_pending_client_id') || '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('dhan_pending_api_key') || '');
  const [apiSecret, setApiSecret] = useState(() => localStorage.getItem('dhan_pending_api_secret') || '');
  const [showSecret, setShowSecret] = useState(false);

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Switch states
  const [terminalStates, setTerminalStates] = useState<Record<string, boolean>>({});
  const [tradingEngineStates, setTradingEngineStates] = useState<Record<string, boolean>>({});

  // Static IP Management
  const [ipDetails, setIpDetails] = useState<{
    primaryIP?: string;
    secondaryIP?: string;
    detectedIP?: string;
    modifyDatePrimary?: string;
    modifyDateSecondary?: string;
    ipMatchStatus?: 'MATCH' | 'MISMATCH';
    ordersAllowed?: boolean;
  } | null>(null);
  const [showIpManager, setShowIpManager] = useState(false);
  const [updatingIp, setUpdatingIp] = useState(false);
  const [ipActionMessage, setIpActionMessage] = useState('');

  // 3-dots Menu & Actions
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedBroker, setSelectedBroker] = useState<BrokerSummary | null>(null);
  const [assignIpDialogOpen, setAssignIpDialogOpen] = useState(false);
  const [staticIpInput, setStaticIpInput] = useState('171.61.160.213');
  const [assigningIp, setAssigningIp] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'info' | 'error' | 'warning'>('success');

  const redirectUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dhan-connect`
    : 'https://web.algorooms.com/connect-broker';

  const fetchBrokers = useCallback(async () => {
    try {
      const list = await brokerApi.getBrokers();
      setBrokers(list);

      const terms: Record<string, boolean> = {};
      const engines: Record<string, boolean> = {};

      list.forEach((b) => {
        terms[b.id] = b.terminalEnabled ?? (b.status === 'Connected');
        engines[b.id] = b.tradingEngineEnabled ?? (b.status === 'Connected');
      });

      setTerminalStates(terms);
      setTradingEngineStates(engines);

      // If connected brokers exist, show the broker list view and fetch live Static IP!
      if (list.length > 0) {
        setViewMode('list');
        setFormSuccess('');
        try {
          const ipRes = await brokerApi.getStaticIP();
          if (ipRes.success && ipRes.ipDetails) {
            setIpDetails(ipRes.ipDetails);
          }
        } catch (_) {}
      } else {
        setViewMode('add');
      }
    } catch (error) {
      console.error('Failed to fetch brokers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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
      localStorage.setItem('dhan_pending_api_key', apiKey.trim());
      localStorage.setItem('dhan_pending_api_secret', apiSecret.trim());

      const res = await brokerApi.generateDhanConsent({
        clientId: clientId.trim(),
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim()
      });

      if (res.success && res.loginUrl) {
        if (res.consentAppId) {
          localStorage.setItem('dhan_pending_consent_id', res.consentAppId);
        }

        setFormSuccess('Redirecting to Dhan authentication...');
        const width = 600;
        const height = 750;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          res.loginUrl,
          'DhanLogin',
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
        );

        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          window.location.href = res.loginUrl;
        }

        // Active background poller in case popup cross-origin communication is blocked
        const pollInterval = setInterval(async () => {
          try {
            const freshList = await brokerApi.getBrokers();
            if (freshList && freshList.length > 0) {
              clearInterval(pollInterval);
              setBrokers(freshList);
              setViewMode('list');
              setSubmitting(false);
              setFormSuccess('');
            }
          } catch (_) {}
        }, 2000);

        setTimeout(() => clearInterval(pollInterval), 150000);
      } else {
        setFormError(res.message || 'Failed to initiate Dhan authorization session.');
        setSubmitting(false);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Connection failed.');
      setSubmitting(false);
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
      setSnackbarMessage('Triggering Square Off on Dhan...');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);

      const res = await brokerApi.squareOff(brokerToSquare.id);
      if (res.success) {
        setSnackbarMessage(res.message || 'All open positions squared off successfully!');
        setSnackbarSeverity('success');
      } else {
        setSnackbarMessage(res.message || 'Square Off completed (no active positions).');
        setSnackbarSeverity('info');
      }
    } catch (err: any) {
      setSnackbarMessage(err.response?.data?.message || err.message || 'Square Off failed.');
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleOpenAssignIp = () => {
    const broker = selectedBroker;
    setMenuAnchorEl(null);
    setStaticIpInput(broker?.staticIp || ipDetails?.primaryIP || '171.61.160.213');
    setAssignIpDialogOpen(true);
  };

  const handleSaveStaticIp = async () => {
    if (!staticIpInput.trim()) return;
    setAssigningIp(true);
    try {
      const res = await brokerApi.updateStaticIP({
        ip: staticIpInput.trim(),
        ipFlag: 'PRIMARY',
        brokerId: selectedBroker?.id,
        isModify: Boolean(selectedBroker?.staticIp && selectedBroker.staticIp !== 'Not Assigned')
      });
      if (res.success) {
        setSnackbarMessage('Static IP assigned successfully to Dhan!');
        setSnackbarSeverity('success');
        setAssignIpDialogOpen(false);
        fetchBrokers();
      } else {
        setSnackbarMessage(res.message || 'Failed to assign Static IP on Dhan.');
        setSnackbarSeverity('error');
      }
    } catch (err: any) {
      setSnackbarMessage(err.response?.data?.message || err.message || 'Failed to assign Static IP.');
      setSnackbarSeverity('error');
    } finally {
      setAssigningIp(false);
      setSnackbarOpen(true);
    }
  };

  const handleDeleteBroker = async () => {
    const brokerToDelete = selectedBroker;
    setMenuAnchorEl(null);
    if (!brokerToDelete) return;
    try {
      await handleDisconnect(brokerToDelete.id);
      setSnackbarMessage('Broker deleted successfully.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (err: any) {
      setSnackbarMessage('Failed to delete broker.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  return (
    <Layout>
      {viewMode === 'list' ? (
        /* ========================================================= */
        /* VIEW 1: BROKER LIST (Matching Screenshot 1)               */
        /* ========================================================= */
        <Box
          sx={{
            width: '100%',
            maxWidth: 960,
            mx: 'auto',
            bgcolor: '#ffffff',
            borderRadius: { xs: 3, sm: 4 },
            border: '1px solid #eef2f6',
            boxShadow: '0 2px 12px -2px rgba(0, 0, 0, 0.04)',
            p: { xs: 2.5, sm: 4 }
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
              gap: 1.5
            }}
          >
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  color: '#0f172a',
                  fontSize: { xs: '1.25rem', sm: '1.45rem' },
                  lineHeight: 1.2
                }}
              >
                Broker
              </Typography>
              <Typography
                sx={{
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  mt: 0.3
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
                borderRadius: '10px',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
              }}
            >
              + Add Broker
            </Button>
          </Box>

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
                sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
              >
                + Add Broker
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {brokers.map((broker) => {
                const isConnected = broker.status === 'Connected';
                const terminalOn = terminalStates[broker.id] ?? isConnected;
                const tradingEngineOn = tradingEngineStates[broker.id] ?? isConnected;

                return (
                  <React.Fragment key={broker.id}>
                    <Box
                      sx={{
                        p: { xs: 2, sm: 2.5 },
                        borderRadius: '14px',
                        border: '1px solid #eaedf0',
                        bgcolor: '#ffffff',
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'stretch', md: 'center' },
                        justifyContent: 'space-between',
                        gap: { xs: 2, md: 3 },
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          borderColor: '#cbd5e1'
                        }
                      }}
                    >
                      {/* Left: Dhan Avatar + Name + Client ID + Static IP + Status */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            bgcolor: '#00A25B',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 900,
                            fontSize: '1.4rem',
                            fontFamily: 'serif',
                            flexShrink: 0
                          }}
                        >
                          ध
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem', lineHeight: 1.2 }}>
                            {broker.broker || 'Dhan'}
                          </Typography>
                          <Typography sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.8rem', mt: 0.2 }}>
                            {broker.clientId}
                          </Typography>
                          <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', mt: 0.3, fontWeight: 500 }}>
                            Static IP: {broker.staticIp || (ipDetails?.primaryIP ? ipDetails.primaryIP : 'Not Assigned')}
                          </Typography>
                          <Typography
                            sx={{
                              color: isConnected ? '#16a34a' : '#ef4444',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              mt: 0.2
                            }}
                          >
                            {isConnected ? 'Connected' : 'Not Connected'}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Middle & Right section */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: { xs: 'space-between', md: 'flex-end' },
                          gap: { xs: 2, md: 5 },
                          width: { xs: '100%', md: 'auto' },
                          pt: { xs: 1.5, md: 0 },
                          borderTop: { xs: '1px solid #f1f5f9', md: 'none' }
                        }}
                      >
                        {/* Strategy Performance */}
                        <Box sx={{ textAlign: { xs: 'left', md: 'center' } }}>
                          <Typography sx={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem', display: 'block' }}>
                            Strategy Performance
                          </Typography>
                          <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.1rem', mt: 0.2 }}>
                            0.00
                          </Typography>
                        </Box>

                        {/* Switches & Dots Menu */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 } }}>
                          {/* Terminal Switch */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>
                              Terminal
                            </Typography>
                            <CustomSwitch
                              checked={terminalOn}
                              onChange={() => setTerminalStates(prev => ({ ...prev, [broker.id]: !prev[broker.id] }))}
                            />
                          </Box>

                          {/* Trading Engine Switch */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>
                              Trading Engine
                            </Typography>
                            <CustomSwitch
                              checked={tradingEngineOn}
                              onChange={() => setTradingEngineStates(prev => ({ ...prev, [broker.id]: !prev[broker.id] }))}
                            />
                          </Box>

                          {/* 3-dots Menu Button */}
                          <Box
                            onClick={(e) => {
                              setMenuAnchorEl(e.currentTarget);
                              setSelectedBroker(broker);
                            }}
                            sx={{
                              bgcolor: '#f1f5f9',
                              borderRadius: '8px',
                              width: 32,
                              height: 32,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              '&:hover': { bgcolor: '#e2e8f0' }
                            }}
                          >
                            <MoreVertIcon sx={{ fontSize: 18, color: '#64748b' }} />
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </React.Fragment>
                );
              })}
            </Box>
          )}
        </Box>
      ) : viewMode === 'profile' ? (
        /* ========================================================= */
        /* VIEW 3: BROKER PROFILE & STATIC IP                        */
        /* ========================================================= */
        <Box
          sx={{
            width: '100%',
            maxWidth: 520,
            mx: 'auto',
            bgcolor: '#ffffff',
            borderRadius: { xs: 3, sm: 4 },
            border: '1px solid #eef2f6',
            boxShadow: '0 2px 12px -2px rgba(0, 0, 0, 0.04)',
            p: { xs: 2.5, sm: 4 }
          }}
        >
          {/* Back Button */}
          <Button
            size="small"
            startIcon={<ArrowBack sx={{ fontSize: 16 }} />}
            onClick={() => setViewMode('list')}
            sx={{
              mb: 2.5,
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

          {/* Profile Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                bgcolor: '#00A25B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.6rem',
                fontFamily: 'serif',
                flexShrink: 0
              }}
            >
              ध
            </Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.2rem', lineHeight: 1.2 }}>
                  Dhan Account Profile
                </Typography>
                <Box
                  sx={{
                    px: 1,
                    py: 0.2,
                    borderRadius: '12px',
                    bgcolor: '#dcfce7',
                    color: '#16a34a',
                    fontWeight: 700,
                    fontSize: '0.72rem'
                  }}
                >
                  Connected
                </Box>
              </Box>
              <Typography sx={{ color: '#64748b', fontSize: '0.82rem', mt: 0.3 }}>
                Client ID: {selectedProfileBroker?.clientId || brokers[0]?.clientId || '1108893841'}
              </Typography>
            </Box>
          </Box>

          {/* Profile Details List */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
            {/* Primary Static IP Row */}
            <Box
              sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <Box>
                <Typography sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                  Primary Static IP (SEBI Whitelisted)
                </Typography>
                <Typography sx={{ color: '#2563eb', fontWeight: 800, fontSize: '1.1rem', mt: 0.3, letterSpacing: '0.02em' }}>
                  171.61.160.213
                </Typography>
                <Typography sx={{ color: '#16a34a', fontSize: '0.72rem', fontWeight: 600, mt: 0.2 }}>
                  ● Active &amp; Whitelisted on DhanHQ
                </Typography>
              </Box>
              <Tooltip title={copied ? 'Copied!' : 'Copy IP'} arrow>
                <IconButton
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText('171.61.160.213');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', p: 1 }}
                >
                  {copied ? <Check sx={{ fontSize: 18, color: '#16a34a' }} /> : <ContentCopy sx={{ fontSize: 18, color: '#64748b' }} />}
                </IconButton>
              </Tooltip>
            </Box>

            {/* Secondary IP Row */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: '10px',
                bgcolor: '#ffffff',
                border: '1px solid #eef2f6'
              }}
            >
              <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>
                Secondary IP (IPv6 Egress)
              </Typography>
              <Typography sx={{ color: '#334155', fontWeight: 600, fontSize: '0.8rem', mt: 0.2, wordBreak: 'break-all' }}>
                2401:4900:8fed:3ec7:f129:9d2e:a131:74ea
              </Typography>
            </Box>

            {/* Trading Authorization */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: '10px',
                bgcolor: '#ffffff',
                border: '1px solid #eef2f6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <Box>
                <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>
                  Order Placement Status
                </Typography>
                <Typography sx={{ color: '#16a34a', fontWeight: 700, fontSize: '0.85rem' }}>
                  Live Trading Authorized
                </Typography>
              </Box>
              <Box
                sx={{
                  px: 1.2,
                  py: 0.3,
                  borderRadius: '8px',
                  bgcolor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#16a34a',
                  fontWeight: 700,
                  fontSize: '0.72rem'
                }}
              >
                Whitelisted
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                fetchBrokers();
                setViewMode('list');
              }}
              sx={{
                py: 1.2,
                borderRadius: '10px',
                bgcolor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.875rem',
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
              }}
            >
              Done / Return to Brokers
            </Button>
            <Button
              variant="outlined"
              href="https://web.dhan.co"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                py: 1.2,
                borderRadius: '10px',
                borderColor: '#e2e8f0',
                color: '#334155',
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'none',
                whiteSpace: 'nowrap',
                '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' }
              }}
            >
              web.dhan.co ↗
            </Button>
          </Box>
        </Box>
      ) : (
        /* ========================================================= */
        /* VIEW 2: ADD YOUR BROKER DETAIL (Matching Screenshot 2)    */
        /* ========================================================= */
        <Box
          sx={{
            width: '100%',
            maxWidth: 460,
            mx: 'auto',
            bgcolor: '#ffffff',
            borderRadius: { xs: 3, sm: 4 },
            border: '1px solid #eef2f6',
            boxShadow: '0 2px 12px -2px rgba(0, 0, 0, 0.04)',
            p: { xs: 2.5, sm: 4 }
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
            Add Your Broker Detail
          </Typography>
          <Typography
            sx={{
              color: '#64748b',
              fontSize: '0.8125rem',
              mt: 0.5,
              mb: 2.5,
              lineHeight: 1.4
            }}
          >
            Enter the login information or tokens required by your broker so we can finish the setup.
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
              bgcolor: '#ffffff',
              gap: 2
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: '#00A25B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.5rem',
                fontFamily: 'serif',
                flexShrink: 0
              }}
            >
              ध
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem', lineHeight: 1.2 }}>
                Dhan
              </Typography>
              <Box
                onClick={() => setShowGuide(!showGuide)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.8,
                  cursor: 'pointer',
                  mt: 0.5,
                  '&:hover': { opacity: 0.8 }
                }}
              >
                <Typography sx={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 500 }}>
                  How to add Dhan?
                </Typography>
                <Box
                  sx={{
                    width: 18,
                    height: 13,
                    bgcolor: '#ef4444',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box
                    sx={{
                      width: 0,
                      height: 0,
                      borderTop: '3px solid transparent',
                      borderBottom: '3px solid transparent',
                      borderLeft: '5px solid #ffffff'
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Guide Alert */}
          {showGuide && (
            <Alert severity="info" sx={{ mb: 2.5, borderRadius: '10px', fontSize: '0.78rem' }}>
              1. Go to <strong>web.dhan.co</strong> → Profile → <strong>Access DhanHQ APIs</strong>.<br />
              2. Select <strong>API Key</strong>, enter your App Name, and paste the Redirect URL below.<br />
              3. Generate the 12-month key &amp; secret and paste them below!
            </Alert>
          )}

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
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Field 1: Broker ID */}
              <Box>
                <Typography sx={{ fontWeight: 700, color: '#1e293b', display: 'block', mb: 0.6, fontSize: '0.82rem' }}>
                  Broker ID
                </Typography>
                <TextField
                  placeholder="Enter Broker ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  InputProps={{
                    sx: {
                      borderRadius: '10px',
                      bgcolor: '#f4f7fb',
                      border: '1px solid #e2e8f0',
                      '& fieldset': { border: 'none' },
                      '&:hover': { bgcolor: '#edf2f7' },
                      '&.Mui-focused': { bgcolor: '#ffffff', border: '1.5px solid #2563eb' },
                      fontSize: '0.875rem'
                    }
                  }}
                />
              </Box>

              {/* Field 2: API Key */}
              <Box>
                <Typography sx={{ fontWeight: 700, color: '#1e293b', display: 'block', mb: 0.6, fontSize: '0.82rem' }}>
                  API Key
                </Typography>
                <TextField
                  placeholder="API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  InputProps={{
                    sx: {
                      borderRadius: '10px',
                      bgcolor: '#f4f7fb',
                      border: '1px solid #e2e8f0',
                      '& fieldset': { border: 'none' },
                      '&:hover': { bgcolor: '#edf2f7' },
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
                  placeholder="API Secret Key"
                  type={showSecret ? 'text' : 'password'}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  required
                  fullWidth
                  size="small"
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
                      bgcolor: '#f4f7fb',
                      border: '1px solid #e2e8f0',
                      '& fieldset': { border: 'none' },
                      '&:hover': { bgcolor: '#edf2f7' },
                      '&.Mui-focused': { bgcolor: '#ffffff', border: '1.5px solid #2563eb' },
                      fontSize: '0.875rem'
                    }
                  }}
                />
              </Box>

              {/* Redirect URL matching Screenshot 2 */}
              <Box sx={{ mt: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.5 }}>
                  <Typography sx={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>
                    Redirect Url:
                  </Typography>
                  <Tooltip title="Copy this exact redirect URL to your DhanHQ developer portal app settings." arrow>
                    <InfoOutlined sx={{ fontSize: 15, color: '#64748b', cursor: 'pointer' }} />
                  </Tooltip>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1
                  }}
                >
                  <Typography
                    sx={{
                      color: '#2563eb',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {redirectUrl}
                  </Typography>
                  <Tooltip title={copied ? 'Copied!' : 'Copy URL'} arrow>
                    <IconButton size="small" onClick={handleCopyRedirect} sx={{ color: copied ? '#16a34a' : '#64748b', p: 0.5, flexShrink: 0 }}>
                      {copied ? <Check sx={{ fontSize: 18 }} /> : <ContentCopy sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="contained"
                disabled={submitting || !clientId || !apiKey || !apiSecret}
                sx={{
                  mt: 1.5,
                  height: 48,
                  borderRadius: '12px',
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' },
                  '&.Mui-disabled': { bgcolor: '#93c5fd', color: '#ffffff' }
                }}
              >
                {submitting ? <CircularProgress size={22} sx={{ color: '#ffffff' }} /> : 'Submit'}
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
          onClick={handleSquareOff}
          sx={{ fontSize: '0.85rem', fontWeight: 500, color: '#1e293b', py: 0.8, px: 2 }}
        >
          Square Off
        </MenuItem>

        <MenuItem
          onClick={handleOpenAssignIp}
          sx={{ fontSize: '0.85rem', fontWeight: 500, color: '#1e293b', py: 0.8, px: 2 }}
        >
          Assign Static IP
        </MenuItem>

        <MenuItem
          onClick={handleDeleteBroker}
          sx={{ fontSize: '0.85rem', fontWeight: 500, color: '#ef4444', py: 0.8, px: 2 }}
        >
          Delete
        </MenuItem>
      </Menu>

      {/* Assign Static IP Dialog */}
      <Dialog
        open={assignIpDialogOpen}
        onClose={() => setAssignIpDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            maxWidth: 440,
            width: '100%',
            p: 1,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Assign Static IP
          <IconButton size="small" onClick={() => setAssignIpDialogOpen(false)} sx={{ color: '#94a3b8' }}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography sx={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
            Assign your dedicated static IP to whitelist with DhanHQ API for secure trading execution.
          </Typography>

          <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600, mb: 0.5 }}>
              Dedicated Server Static IP
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#2563eb', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em' }}>
                {staticIpInput || '171.61.160.213'}
              </Typography>
              <Tooltip title={copiedIp ? 'Copied!' : 'Copy IP'} arrow>
                <IconButton
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(staticIpInput || '171.61.160.213');
                    setCopiedIp(true);
                    setTimeout(() => setCopiedIp(false), 2000);
                  }}
                  sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', p: 0.8 }}
                >
                  {copiedIp ? <Check sx={{ fontSize: 16, color: '#16a34a' }} /> : <ContentCopy sx={{ fontSize: 16, color: '#64748b' }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <TextField
            fullWidth
            label="Static IP to Whitelist"
            value={staticIpInput}
            onChange={(e) => setStaticIpInput(e.target.value)}
            size="small"
            placeholder="171.61.160.213"
            helperText="Enter 171.61.160.213 or your custom static IP"
            sx={{ mt: 0.5 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button
            onClick={() => setAssignIpDialogOpen(false)}
            sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveStaticIp}
            disabled={assigningIp || !staticIpInput.trim()}
            sx={{
              bgcolor: '#2563eb',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              borderRadius: '8px',
              px: 2.5,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
            }}
          >
            {assigningIp ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Assign Static IP'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Feedback Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Redirect URL copied to clipboard!"
      />
    </Layout>
  );
};

export default Brokers;