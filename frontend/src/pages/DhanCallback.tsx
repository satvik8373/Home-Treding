import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Button
} from '@mui/material';
import { CheckCircle, Error, ArrowBack } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

const DhanCallback: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Dhan authentication...');
  const [brokerInfo, setBrokerInfo] = useState<any>(null);

  const urlParams = new URLSearchParams(location.search);
  const tokenId = urlParams.get('tokenId') || urlParams.get('token_id') || '';
  const errorParam = urlParams.get('error') || urlParams.get('error_description');

  useEffect(() => {
    let isMounted = true;

    const handleCallback = async () => {
      if (errorParam) {
        if (isMounted) {
          setStatus('error');
          setMessage(`Dhan authentication rejected: ${errorParam}`);
        }
        return;
      }

      if (!tokenId) {
        if (isMounted) {
          setStatus('error');
          setMessage('No Dhan authorization Token ID found in URL.');
        }
        return;
      }

      try {
        if (isMounted) {
          setMessage('Exchanging Token ID with official DhanHQ servers...');
        }

        const storedClientId = localStorage.getItem('dhan_pending_client_id') || localStorage.getItem('dhan_saved_client_id') || undefined;
        const consentAppId = localStorage.getItem('dhan_pending_consent_id') || undefined;

        const ep = `${API_CONFIG.BASE_URL}/api/brokers/dhan/consume-consent`;
        const response = await axios.post(ep, {
          tokenId,
          consentAppId,
          clientId: storedClientId
        }, { timeout: 15000 });

        if (response?.data?.success) {
          const broker = response.data.broker;
          setBrokerInfo(broker);

          // Retain verified client ID in localStorage
          if (storedClientId) localStorage.setItem('dhan_saved_client_id', storedClientId);

          if (broker) {
            localStorage.setItem('mavrix_saved_brokers', JSON.stringify([broker]));
          }
          localStorage.setItem('dhan_oauth_completed', String(Date.now()));

          if (isMounted) {
            setStatus('success');
            setMessage('Dhan broker connected and verified successfully!');
          }

          // If opened as popup, notify parent
          if (window.opener) {
            try {
              window.opener.postMessage({
                type: 'DHAN_OAUTH_SUCCESS',
                broker
              }, '*');
            } catch (_) {}
          }

          // Redirect to /brokers after brief success display
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
          if (isMounted) {
            setStatus('error');
            setMessage(errDetail);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          const code = err.response?.status;
          if (code === 401) {
            setMessage('Dhan authorization token has expired (single-use 60s TTL) or your API Key / Secret needs refresh. Please start a fresh login or connect using your 24-hr Direct Access Token.');
          } else if (code === 404) {
            setMessage('Unable to reach broker consent endpoint. Please return to Brokers to reconnect.');
          } else {
            setMessage(err.response?.data?.message || 'Authorization failed with Dhan server. Please try again.');
          }
        }
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [tokenId, errorParam, navigate]);

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
      <Card sx={{ maxWidth: 440, width: '100%', textAlign: 'center', borderRadius: 3, boxShadow: '0 20px 45px -10px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: 4 }}>
          {isProductionDomain && tokenId && (
            <Box sx={{ mb: 2.5, p: 1.5, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2, textAlign: 'left' }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>
                Testing on Localhost?
              </Typography>
              <Typography sx={{ fontSize: '0.74rem', color: '#1d4ed8', mb: 1, mt: 0.2 }}>
                Dhan redirected to the production domain configured in your Dhan developer account.
              </Typography>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  window.location.href = `http://localhost:3000/dhan-connect?tokenId=${encodeURIComponent(tokenId)}`;
                }}
                sx={{
                  bgcolor: '#4f46e5',
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: '#4338ca' }
                }}
              >
                Forward to http://localhost:3000
              </Button>
            </Box>
          )}

          {status === 'loading' && (
            <>
              <CircularProgress size={44} sx={{ color: '#4f46e5', mb: 2.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                Authorizing Dhan Connection
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {message}
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle sx={{ fontSize: 56, color: '#16a34a', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                Connected & Verified!
              </Typography>
              <Typography variant="body2" sx={{ color: '#16a34a', fontWeight: 600, mb: 2 }}>
                {message}
              </Typography>
              {brokerInfo && (
                <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, p: 2, mb: 2, textAlign: 'left' }}>
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
            </>
          )}

          {status === 'error' && (
            <>
              <Error sx={{ fontSize: 56, color: '#dc2626', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                Connection Failed
              </Typography>
              <Alert severity="error" sx={{ mb: 3, textAlign: 'left', borderRadius: 2, fontSize: '0.8rem' }}>
                {message}
              </Alert>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  variant="contained"
                  startIcon={<ArrowBack />}
                  onClick={() => navigate('/brokers', { replace: true })}
                  sx={{
                    bgcolor: '#4f46e5',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 2,
                    py: 1,
                    '&:hover': { bgcolor: '#4338ca' }
                  }}
                >
                  Back to Brokers (Fresh Login)
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/brokers?method=token', { replace: true })}
                  sx={{
                    borderColor: '#c7d2fe',
                    color: '#4f46e5',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 2,
                    py: 1,
                    '&:hover': { bgcolor: '#eef2ff', borderColor: '#4f46e5' }
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