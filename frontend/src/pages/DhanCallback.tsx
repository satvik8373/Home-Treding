import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  TextField,
  Button,
  IconButton,
  InputAdornment
} from '@mui/material';
import { CheckCircle, Error, Visibility, VisibilityOff, AccountBalance, Check } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

const DhanCallback: React.FC = () => {
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'prompt_creds' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Dhan authentication...');

  const urlParams = new URLSearchParams(location.search);
  const tokenId = urlParams.get('tokenId') || urlParams.get('token_id') || '';
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const errorParam = urlParams.get('error');

  // Manual fallback inputs if localStorage is empty
  const [clientId, setClientId] = useState(localStorage.getItem('dhan_pending_client_id') || '');
  const [apiKey, setApiKey] = useState(localStorage.getItem('dhan_pending_api_key') || '');
  const [apiSecret, setApiSecret] = useState(localStorage.getItem('dhan_pending_api_secret') || '');
  const [showSecret, setShowSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    const handleCallback = async () => {
      try {
        if (errorParam) {
          if (isMounted) {
            setStatus('error');
            setMessage(`Dhan authorization rejected: ${errorParam}`);
          }
          return;
        }

        // 1. Handle Official DhanHQ Developer Flow with tokenId
        if (tokenId) {
          if (isMounted) {
            setMessage('Exchanging Dhan Token ID with official DhanHQ servers...');
          }

          const consentAppId = localStorage.getItem('dhan_pending_consent_id') || undefined;
          const storedApiKey = localStorage.getItem('dhan_pending_api_key') || undefined;
          const storedApiSecret = localStorage.getItem('dhan_pending_api_secret') || undefined;
          const storedClientId = localStorage.getItem('dhan_pending_client_id') || undefined;

          try {
            const response = await axios.post(`${API_CONFIG.BASE_URL}/api/brokers/dhan/consume-consent`, {
              tokenId,
              consentAppId,
              clientId: storedClientId,
              apiKey: storedApiKey,
              apiSecret: storedApiSecret
            });

            if (response.data.success) {
              localStorage.removeItem('dhan_pending_consent_id');
              localStorage.removeItem('dhan_pending_api_key');
              localStorage.removeItem('dhan_pending_api_secret');
              localStorage.removeItem('dhan_pending_client_id');

              if (isMounted) {
                setStatus('success');
                setMessage('Dhan Account successfully authorized and connected!');
              }

              localStorage.setItem('dhan_oauth_completed', String(Date.now()));

              if (window.opener) {
                try {
                  window.opener.postMessage({
                    type: 'DHAN_OAUTH_SUCCESS',
                    broker: response.data.broker
                  }, '*');
                } catch (_) {}
              }

              timer = setTimeout(() => {
                try {
                  if (window.opener && !window.opener.closed) {
                    window.close();
                    return;
                  }
                } catch (_) {}
                window.location.href = '/brokers';
              }, 1200);
              return;
            } else {
              // If backend needed credentials
              if (isMounted) {
                setStatus('prompt_creds');
                setMessage('Please provide your API Key and Secret to finish authorizing this token.');
              }
              return;
            }
          } catch (err: any) {
            // Need credentials
            if (isMounted) {
              setStatus('prompt_creds');
              setMessage('Enter your API credentials below to complete authorization for this Token ID.');
            }
            return;
          }
        }

        // 2. Handle Legacy Partner OAuth Flow (code + state)
        if (code && state) {
          if (isMounted) {
            setMessage('Processing Dhan Partner OAuth callback...');
          }

          const connectionId = localStorage.getItem('dhan_connection_id');
          if (!connectionId) {
            if (isMounted) {
              setStatus('error');
              setMessage('Connection session not found. Please try connecting again.');
            }
            return;
          }

          const response = await axios.post(`${API_CONFIG.BASE_URL}/api/dhan-partner/callback`, {
            code,
            state,
            connectionId
          });

          if (response.data.success) {
            if (isMounted) {
              setStatus('success');
              setMessage('Dhan Partner connected successfully. Terminal activated.');
            }

            if (window.opener) {
              window.opener.postMessage({
                type: 'DHAN_PARTNER_SUCCESS',
                data: response.data.broker
              }, '*');
            }

            timer = setTimeout(() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/brokers';
              }
            }, 2500);
          } else {
            if (isMounted) {
              setStatus('error');
              setMessage(`Dhan Partner connection failed: ${response.data.message}`);
            }
          }
        } else if (!tokenId) {
          if (isMounted) {
            setStatus('error');
            setMessage('No tokenId or authorization code found in URL.');
          }
        }
      } catch (error: any) {
        if (isMounted) {
          setStatus('error');
          setMessage(`OAuth processing failed: ${error.response?.data?.message || error.message}`);
        }
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [location.search, tokenId, code, state, errorParam]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) return;

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/brokers/dhan/consume-consent`, {
        tokenId,
        clientId: clientId.trim() || undefined,
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim()
      });

      if (response.data.success) {
        setStatus('success');
        setMessage('Dhan Account successfully authorized and connected!');

        localStorage.setItem('dhan_oauth_completed', String(Date.now()));

        if (window.opener) {
          try {
            window.opener.postMessage({
              type: 'DHAN_OAUTH_SUCCESS',
              broker: response.data.broker
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
          window.location.href = '/brokers';
        }, 1200);
      } else {
        setMessage(response.data.message || 'Verification failed. Please check credentials.');
      }
    } catch (err: any) {
      setMessage(err.response?.data?.message || err.message || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      bgcolor: '#f8fafc',
      p: 2
    }}>
      <Card sx={{ maxWidth: 440, width: '100%', textAlign: 'center', borderRadius: 3, boxShadow: '0 20px 45px -10px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: 4 }}>
          {status === 'loading' && (
            <>
              <CircularProgress size={44} sx={{ color: '#2563eb', mb: 2.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                Authorizing Dhan Connection
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {message}
              </Typography>
            </>
          )}

          {status === 'prompt_creds' && (
            <Box component="form" onSubmit={handleManualSubmit} sx={{ textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#00A25B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem' }}>
                  ध
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Complete Dhan Connection
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Token ID detected from Dhan login
                  </Typography>
                </Box>
              </Box>

              <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.75rem' }}>
                Dhan Token ID: <code>{tokenId.slice(0, 16)}...</code>
              </Alert>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.5 }}>
                    Broker ID (Client ID)
                  </Typography>
                  <TextField
                    placeholder="Enter Broker ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    fullWidth
                    size="small"
                    InputProps={{ sx: { borderRadius: 2, bgcolor: '#f8fafc', fontSize: '0.875rem' } }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.5 }}>
                    API Key
                  </Typography>
                  <TextField
                    placeholder="Enter API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                    fullWidth
                    size="small"
                    InputProps={{ sx: { borderRadius: 2, bgcolor: '#f8fafc', fontSize: '0.875rem' } }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.5 }}>
                    API Secret Key
                  </Typography>
                  <TextField
                    placeholder="Enter API Secret Key"
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
                      sx: { borderRadius: 2, bgcolor: '#f8fafc', fontSize: '0.875rem' }
                    }}
                  />
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting || !apiKey || !apiSecret}
                  sx={{
                    mt: 1,
                    py: 1.2,
                    borderRadius: 2.5,
                    bgcolor: '#2563eb',
                    fontWeight: 700,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#1d4ed8' }
                  }}
                >
                  {submitting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Complete Setup & Connect'}
                </Button>
              </Box>
            </Box>
          )}

          {status === 'success' && (
            <>
              <CheckCircle sx={{ fontSize: 56, color: '#16a34a', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#16a34a', mb: 1 }}>
                Login Successful!
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {message}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 2, color: '#94a3b8' }}>
                Redirecting to your dashboard...
              </Typography>
            </>
          )}

          {status === 'error' && (
            <>
              <Error sx={{ fontSize: 56, color: '#ef4444', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#ef4444', mb: 1 }}>
                Authorization Failed
              </Typography>
              <Alert severity="error" sx={{ mt: 2, mb: 2, borderRadius: 2, fontSize: '0.8rem' }}>
                {message}
              </Alert>
              <Button
                variant="outlined"
                onClick={() => window.location.href = '/brokers'}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Back to Brokers
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DhanCallback;