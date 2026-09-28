import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  ArrowBack,
  Visibility,
  VisibilityOff,
  Key as KeyIcon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

const DhanCallback: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(location.search);
  const tokenId = urlParams.get('tokenId') || urlParams.get('token_id') || '';
  const errorParam = urlParams.get('error') || urlParams.get('error_description');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'input_required'>('loading');
  const [message, setMessage] = useState('Processing Dhan authentication...');
  const [brokerInfo, setBrokerInfo] = useState<any>(null);

  // Manual key fallback inputs if not cached in localStorage
  const [inputClientId, setInputClientId] = useState(() =>
    localStorage.getItem('dhan_pending_client_id') || localStorage.getItem('dhan_saved_client_id') || ''
  );
  const [inputApiKey, setInputApiKey] = useState(() =>
    localStorage.getItem('dhan_pending_api_key') || ''
  );
  const [inputApiSecret, setInputApiSecret] = useState(() =>
    localStorage.getItem('dhan_pending_api_secret') || ''
  );
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const exchangeConsent = useCallback(async (keys: { apiKey: string; apiSecret: string; clientId?: string }) => {
    if (!tokenId) {
      setStatus('error');
      setMessage('No Dhan authorization Token ID found in URL.');
      return;
    }

    const { apiKey, apiSecret, clientId } = keys;

    if (!apiKey.trim() || !apiSecret.trim()) {
      setStatus('input_required');
      setMessage('API Key and API Secret Key are required to consume consent. Please enter them below.');
      return;
    }

    try {
      setStatus('loading');
      setMessage('Exchanging Token ID with official DhanHQ servers...');

      const consentAppId = localStorage.getItem('dhan_pending_consent_id') || undefined;
      const ep = `${API_CONFIG.BASE_URL}/api/brokers/dhan/consume-consent`;

      const response = await axios.post(ep, {
        tokenId: tokenId.trim(),
        consentAppId,
        clientId: clientId ? clientId.trim() : undefined,
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim()
      }, { timeout: 15000 });

      if (response?.data?.success) {
        const broker = response.data.broker;
        setBrokerInfo(broker);

        if (broker) {
          localStorage.setItem('dhan_connected_broker', JSON.stringify(broker));
        }
        if (clientId) localStorage.setItem('dhan_saved_client_id', clientId.trim());
        localStorage.removeItem('dhan_pending_api_key');
        localStorage.removeItem('dhan_pending_api_secret');
        localStorage.removeItem('dhan_pending_consent_id');
        localStorage.setItem('dhan_oauth_completed', String(Date.now()));

        setStatus('success');
        setMessage('Dhan broker connected and verified successfully!');

        if (window.opener) {
          try {
            window.opener.postMessage({
              type: 'DHAN_OAUTH_SUCCESS',
              broker
            }, '*');
          } catch (_) {}
        }

        setTimeout(() => {
          try {
            if (window.opener && !window.opener.closed) {
              window.close();
              return;
            }
          } catch (_) {}
          navigate('/brokers', { replace: true });
        }, 1500);
      } else {
        const errDetail = response?.data?.message || 'Failed to exchange token with DhanHQ';
        if (errDetail.toLowerCase().includes('api key') || errDetail.toLowerCase().includes('required')) {
          setStatus('input_required');
        } else {
          setStatus('error');
        }
        setMessage(errDetail);
      }
    } catch (err: any) {
      const code = err.response?.status;
      const respMsg = err.response?.data?.message || '';

      if (code === 401) {
        setStatus('error');
        setMessage('Dhan authorization token has expired (single-use 60s TTL) or your API Key / Secret does not match. Please start a fresh login or connect using your 24-hr Direct Access Token.');
      } else if (code === 400 && (respMsg.toLowerCase().includes('api key') || respMsg.toLowerCase().includes('required'))) {
        setStatus('input_required');
        setMessage('API Key and API Secret Key are required to consume consent. Please enter them below.');
      } else if (code === 404) {
        setStatus('error');
        setMessage('Unable to reach broker consent endpoint. Please return to Brokers to reconnect.');
      } else {
        setStatus('error');
        setMessage(respMsg || err.message || 'Authorization failed with Dhan server. Please try again.');
      }
    }
  }, [tokenId, navigate]);

  useEffect(() => {
    if (errorParam) {
      setStatus('error');
      setMessage(`Dhan authentication rejected: ${errorParam}`);
      return;
    }

    if (!tokenId) {
      setStatus('error');
      setMessage('No Dhan authorization Token ID found in URL.');
      return;
    }

    // Auto-attempt token exchange if keys were stored in localStorage prior to redirect
    const cachedApiKey = localStorage.getItem('dhan_pending_api_key');
    const cachedApiSecret = localStorage.getItem('dhan_pending_api_secret');
    const cachedClientId = localStorage.getItem('dhan_pending_client_id') || localStorage.getItem('dhan_saved_client_id') || '';

    if (cachedApiKey && cachedApiSecret) {
      exchangeConsent({
        apiKey: cachedApiKey,
        apiSecret: cachedApiSecret,
        clientId: cachedClientId
      });
    } else {
      // Keys were not cached in this browser session; prompt user inline so they can consume the active tokenId
      setStatus('input_required');
      setMessage('API Key and API Secret Key are required to consume consent.');
    }
  }, [tokenId, errorParam, exchangeConsent]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputApiKey.trim() || !inputApiSecret.trim()) {
      setMessage('Please enter both API Key and API Secret Key.');
      return;
    }
    setIsSubmittingManual(true);
    await exchangeConsent({
      apiKey: inputApiKey.trim(),
      apiSecret: inputApiSecret.trim(),
      clientId: inputClientId.trim()
    });
    setIsSubmittingManual(false);
  };

  const isProductionDomain = typeof window !== 'undefined' &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1');

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      bgcolor: '#f8fafc',
      p: 2
    }}>
      <Card sx={{
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
        bgcolor: '#ffffff'
      }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          {isProductionDomain && tokenId && (
            <Box sx={{ mb: 2.5, p: 1.5, bgcolor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'left' }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                Testing on Localhost?
              </Typography>
              <Typography sx={{ fontSize: '0.74rem', color: '#64748b', mb: 1, mt: 0.2 }}>
                Dhan redirected to the production domain configured in your Dhan developer account.
              </Typography>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  window.location.href = `http://localhost:3000/dhan-connect?tokenId=${encodeURIComponent(tokenId)}`;
                }}
                sx={{
                  bgcolor: '#2563eb',
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '6px',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
                }}
              >
                Forward to http://localhost:3000
              </Button>
            </Box>
          )}

          {status === 'loading' && (
            <Box sx={{ py: 3 }}>
              <CircularProgress size={44} sx={{ color: '#2563eb', mb: 2.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                Authorizing Dhan Connection
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {message}
              </Typography>
            </Box>
          )}

          {status === 'success' && (
            <Box sx={{ py: 2 }}>
              <CheckCircle sx={{ fontSize: 56, color: '#16a34a', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                Connected & Verified!
              </Typography>
              <Typography variant="body2" sx={{ color: '#16a34a', fontWeight: 600, mb: 2 }}>
                {message}
              </Typography>
              {brokerInfo && (
                <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', p: 2, mb: 2, textAlign: 'left' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700 }}>
                    Broker: {brokerInfo.broker || 'DHAN'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#166534' }}>
                    Client ID: {brokerInfo.clientId}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#15803d', mt: 0.5 }}>
                    Status: Verified & Ready for live trading
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Returning to Brokers dashboard...
              </Typography>
            </Box>
          )}

          {status === 'input_required' && (
            <Box sx={{ textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '8px',
                    bgcolor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb'
                  }}
                >
                  <KeyIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', lineHeight: 1.2 }}>
                    Complete 12-Month Connection
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: '0.78rem', mt: 0.2 }}>
                    Enter credentials to exchange active authorization token
                  </Typography>
                </Box>
              </Box>

              <Alert severity="info" sx={{ mb: 2.5, borderRadius: '8px', fontSize: '0.78rem' }}>
                {message}
              </Alert>

              <form onSubmit={handleManualSubmit} autoComplete="off">
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem', mb: 0.5 }}>
                      Broker ID (Dhan Client ID)
                    </Typography>
                    <TextField
                      placeholder="e.g. 1000000001"
                      value={inputClientId}
                      onChange={(e) => setInputClientId(e.target.value)}
                      fullWidth
                      size="small"
                      InputProps={{
                        sx: {
                          borderRadius: '8px',
                          bgcolor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          '& fieldset': { border: 'none' },
                          '&:hover': { bgcolor: '#f1f5f9' },
                          '&.Mui-focused': { bgcolor: '#ffffff', border: '1.5px solid #2563eb' },
                          fontSize: '0.85rem'
                        }
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem', mb: 0.5 }}>
                      API Key (App ID)
                    </Typography>
                    <TextField
                      placeholder="Paste Dhan API Key"
                      value={inputApiKey}
                      onChange={(e) => setInputApiKey(e.target.value)}
                      required
                      fullWidth
                      size="small"
                      InputProps={{
                        sx: {
                          borderRadius: '8px',
                          bgcolor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          '& fieldset': { border: 'none' },
                          '&:hover': { bgcolor: '#f1f5f9' },
                          '&.Mui-focused': { bgcolor: '#ffffff', border: '1.5px solid #2563eb' },
                          fontSize: '0.85rem'
                        }
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem', mb: 0.5 }}>
                      API Secret Key
                    </Typography>
                    <TextField
                      placeholder="Paste Dhan API Secret Key"
                      type={showSecret ? 'text' : 'password'}
                      value={inputApiSecret}
                      onChange={(e) => setInputApiSecret(e.target.value)}
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
                          borderRadius: '8px',
                          bgcolor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          '& fieldset': { border: 'none' },
                          '&:hover': { bgcolor: '#f1f5f9' },
                          '&.Mui-focused': { bgcolor: '#ffffff', border: '1.5px solid #2563eb' },
                          fontSize: '0.85rem'
                        }
                      }}
                    />
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmittingManual}
                    sx={{
                      bgcolor: '#2563eb',
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: '8px',
                      py: 1.1,
                      mt: 0.5,
                      boxShadow: 'none',
                      '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
                    }}
                  >
                    {isSubmittingManual ? 'Validating with Dhan...' : 'Complete Connection Now'}
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<ArrowBack />}
                    onClick={() => navigate('/brokers', { replace: true })}
                    sx={{
                      borderColor: '#e2e8f0',
                      color: '#64748b',
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: '8px',
                      py: 0.9,
                      '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' }
                    }}
                  >
                    Back to Brokers (Fresh Login)
                  </Button>
                </Box>
              </form>
            </Box>
          )}

          {status === 'error' && (
            <>
              <ErrorIcon sx={{ fontSize: 56, color: '#dc2626', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                Connection Failed
              </Typography>
              <Alert severity="error" sx={{ mb: 3, textAlign: 'left', borderRadius: '8px', fontSize: '0.8rem' }}>
                {message}
              </Alert>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  variant="contained"
                  startIcon={<ArrowBack />}
                  onClick={() => navigate('/brokers', { replace: true })}
                  sx={{
                    bgcolor: '#2563eb',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '8px',
                    py: 1,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }
                  }}
                >
                  Back to Brokers (Fresh Login)
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/brokers?method=token', { replace: true })}
                  sx={{
                    borderColor: '#e2e8f0',
                    color: '#2563eb',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '8px',
                    py: 1,
                    '&:hover': { bgcolor: '#eff6ff', borderColor: '#2563eb' }
                  }}
                >
                  Connect via Direct Access Token (Instant)
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DhanCallback;
