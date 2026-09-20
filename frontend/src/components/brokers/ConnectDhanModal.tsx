import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Tabs,
  Tab,
  Tooltip,
  Snackbar
} from '@mui/material';
import {
  Close,
  Visibility,
  VisibilityOff,
  ContentCopy,
  Check,
  InfoOutlined,
  Key,
  VpnKey,
  HelpOutline
} from '@mui/icons-material';
import { brokerApi } from '../../services/brokerApi';

interface ConnectDhanModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (broker: any) => void;
}

export const ConnectDhanModal: React.FC<ConnectDhanModalProps> = ({ open, onClose, onSuccess }) => {
  const [tab, setTab] = useState<number>(0); // 0: Official API Key & Secret, 1: Direct Access Token

  // Form inputs matching user image
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Direct token inputs
  const [directToken, setDirectToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Detect origin for redirect URL
  const redirectUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/connect-broker`
    : 'https://web.algorooms.com/connect-broker';

  // Listen for OAuth success message from Dhan login popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DHAN_OAUTH_SUCCESS' && event.data?.broker) {
        onSuccess(event.data.broker);
        handleClose();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess]);

  const handleCopyRedirect = () => {
    navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Step 1: Submit API Key & Secret
  const handleSubmitOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !apiKey.trim() || !apiSecret.trim()) {
      setError('Please fill in Broker ID, API Key, and API Secret Key.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Store credentials locally for step 3 consumption
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

        // Open official Dhan consent login window
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
          // Popup blocked - direct redirect
          window.location.href = res.loginUrl;
        }
      } else {
        setError(res.message || 'Failed to initiate Dhan authorization session.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to communicate with Dhan server.');
    } finally {
      setLoading(false);
    }
  };

  // Direct Access Token submission
  const handleSubmitDirectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !directToken.trim()) {
      setError('Please enter both Broker ID (Client ID) and Access Token.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await brokerApi.connectDhan({
        clientId: clientId.trim(),
        accessToken: directToken.trim()
      });

      if (res.success) {
        onSuccess(res.broker);
        handleClose();
      } else {
        setError(res.message || 'Connection failed.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Invalid Dhan Access Token.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      onClose();
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3.5,
            p: 1.5,
            boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.15), 0 0 1px 1px rgba(0,0,0,0.05)'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 0, pt: 1.5, px: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.25rem', lineHeight: 1.3 }}>
              Add Your Broker Detail
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, fontSize: '0.8125rem', lineHeight: 1.4 }}>
              Enter the login information or tokens required by your broker so we can finish the setup.
            </Typography>
          </Box>
          <IconButton onClick={handleClose} disabled={loading} size="small" sx={{ color: '#94a3b8', mt: -0.5 }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        {/* Minimal Tab Switcher */}
        <Box sx={{ px: 2, pt: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, val) => { setTab(val); setError(''); }}
            sx={{
              minHeight: 36,
              bgcolor: '#f1f5f9',
              borderRadius: 2,
              p: 0.5,
              '& .MuiTabs-indicator': { display: 'none' }
            }}
          >
            <Tab
              label="Official API Key & Secret"
              icon={<VpnKey sx={{ fontSize: 16 }} />}
              iconPosition="start"
              sx={{
                flex: 1,
                minHeight: 32,
                fontSize: '0.75rem',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
                color: tab === 0 ? '#1e293b' : '#64748b',
                bgcolor: tab === 0 ? '#ffffff' : 'transparent',
                boxShadow: tab === 0 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            />
            <Tab
              label="Direct Token (24h)"
              icon={<Key sx={{ fontSize: 16 }} />}
              iconPosition="start"
              sx={{
                flex: 1,
                minHeight: 32,
                fontSize: '0.75rem',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
                color: tab === 1 ? '#1e293b' : '#64748b',
                bgcolor: tab === 1 ? '#ffffff' : 'transparent',
                boxShadow: tab === 1 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            />
          </Tabs>
        </Box>

        <DialogContent sx={{ pt: 2, px: 2, pb: 1 }}>
          {/* Dhan Profile Card (Matching User Screenshot) */}
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 2,
              mb: 2.5,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff'
            }}
          >
            {/* Dhan Circular Green Badge */}
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
                mr: 2,
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(0, 162, 91, 0.25)'
              }}
            >
              ध
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                Dhan
              </Typography>
              <Box
                onClick={() => setShowTutorial(true)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.7,
                  cursor: 'pointer',
                  mt: 0.4,
                  '&:hover': { opacity: 0.8 }
                }}
              >
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                  How to add Dhan?
                </Typography>
                <Box
                  sx={{
                    width: 18,
                    height: 14,
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
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.8rem' }}>
              {error}
            </Alert>
          )}

          {tab === 0 ? (
            /* TAB 0: Official API Key & Secret OAuth Flow */
            <form onSubmit={handleSubmitOAuth}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Field 1: Broker ID */}
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.75, fontSize: '0.8125rem' }}>
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
                        borderRadius: 2,
                        bgcolor: '#f8fafc',
                        fontSize: '0.875rem',
                        '& fieldset': { borderColor: '#e2e8f0' },
                        '&:hover fieldset': { borderColor: '#cbd5e1' },
                        '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                      }
                    }}
                  />
                </Box>

                {/* Field 2: API Key */}
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.75, fontSize: '0.8125rem' }}>
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
                        borderRadius: 2,
                        bgcolor: '#f8fafc',
                        fontSize: '0.875rem',
                        '& fieldset': { borderColor: '#e2e8f0' },
                        '&:hover fieldset': { borderColor: '#cbd5e1' },
                        '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                      }
                    }}
                  />
                </Box>

                {/* Field 3: API Secret Key */}
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.75, fontSize: '0.8125rem' }}>
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
                          <IconButton onClick={() => setShowSecret(!showSecret)} edge="end" size="small" sx={{ color: '#94a3b8' }}>
                            {showSecret ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                      sx: {
                        borderRadius: 2,
                        bgcolor: '#f8fafc',
                        fontSize: '0.875rem',
                        '& fieldset': { borderColor: '#e2e8f0' },
                        '&:hover fieldset': { borderColor: '#cbd5e1' },
                        '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                      }
                    }}
                  />
                </Box>

                {/* Redirect Url Section (Matching Screenshot) */}
                <Box sx={{ mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8125rem' }}>
                      Redirect Url:
                    </Typography>
                    <Tooltip title="Configure this exact redirect URL in your Dhan Web portal under Access DhanHQ APIs." arrow>
                      <InfoOutlined sx={{ fontSize: 14, color: '#94a3b8', cursor: 'pointer' }} />
                    </Tooltip>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 1.5,
                      py: 1,
                      bgcolor: '#f8fafc',
                      borderRadius: 2,
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#2563eb',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        pr: 1
                      }}
                    >
                      {redirectUrl}
                    </Typography>
                    <Tooltip title={copied ? 'Copied!' : 'Copy Redirect URL'} arrow>
                      <IconButton size="small" onClick={handleCopyRedirect} sx={{ color: copied ? '#16a34a' : '#64748b', p: 0.5 }}>
                        {copied ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Submit Button (Matching Screenshot) */}
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !clientId || !apiKey || !apiSecret}
                  sx={{
                    mt: 1.5,
                    py: 1.3,
                    borderRadius: 3,
                    bgcolor: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                    '&:hover': {
                      bgcolor: '#1d4ed8'
                    }
                  }}
                >
                  {loading ? <CircularProgress size={20} sx={{ color: '#ffffff' }} /> : 'Submit'}
                </Button>
              </Box>
            </form>
          ) : (
            /* TAB 1: Direct 24-Hour Access Token */
            <form onSubmit={handleSubmitDirectToken}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.75, fontSize: '0.8125rem' }}>
                    Broker ID (Client ID)
                  </Typography>
                  <TextField
                    placeholder="Enter Broker ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                    fullWidth
                    size="small"
                    InputProps={{
                      sx: { borderRadius: 2, bgcolor: '#f8fafc', fontSize: '0.875rem' }
                    }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.75, fontSize: '0.8125rem' }}>
                    Daily Access Token
                  </Typography>
                  <TextField
                    placeholder="Paste 24-hour Access Token"
                    type={showToken ? 'text' : 'password'}
                    value={directToken}
                    onChange={(e) => setDirectToken(e.target.value)}
                    required
                    fullWidth
                    size="small"
                    multiline={showToken}
                    rows={showToken ? 3 : 1}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowToken(!showToken)} edge="end" size="small" sx={{ color: '#94a3b8' }}>
                            {showToken ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                      sx: { borderRadius: 2, bgcolor: '#f8fafc', fontSize: '0.875rem' }
                    }}
                    helperText="Generated from web.dhan.co > Profile > Access DhanHQ APIs"
                  />
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !clientId || !directToken}
                  sx={{
                    mt: 1.5,
                    py: 1.3,
                    borderRadius: 3,
                    bgcolor: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                    '&:hover': {
                      bgcolor: '#1d4ed8'
                    }
                  }}
                >
                  {loading ? <CircularProgress size={20} sx={{ color: '#ffffff' }} /> : 'Submit'}
                </Button>
              </Box>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Tutorial / Help Dialog */}
      <Dialog
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HelpOutline sx={{ color: '#2563eb' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              How to Connect DhanHQ API
            </Typography>
          </Box>
          <IconButton onClick={() => setShowTutorial(false)} size="small">
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                1
              </Box>
              <Typography variant="body2" sx={{ color: '#334155' }}>
                Login to <strong>web.dhan.co</strong> with your Dhan credentials.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                2
              </Box>
              <Typography variant="body2" sx={{ color: '#334155' }}>
                Go to <strong>My Profile</strong> &gt; <strong>Access DhanHQ APIs</strong>.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                3
              </Box>
              <Typography variant="body2" sx={{ color: '#334155' }}>
                Toggle selection to <strong>API Key</strong>, enter your App Name, and paste the <strong>Redirect URL</strong> shown in the form.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                4
              </Box>
              <Typography variant="body2" sx={{ color: '#334155' }}>
                Click <strong>Generate API Key</strong>. Copy your <strong>Broker ID (Client ID)</strong>, <strong>API Key</strong>, and <strong>API Secret Key</strong> into this form and click <strong>Submit</strong>!
              </Typography>
            </Box>
          </Box>
          <Button
            fullWidth
            variant="contained"
            onClick={() => setShowTutorial(false)}
            sx={{ mt: 3, borderRadius: 2, bgcolor: '#0f172a', fontWeight: 700, textTransform: 'none' }}
          >
            Got It
          </Button>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Redirect URL copied to clipboard!"
      />
    </>
  );
};
