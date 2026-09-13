import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Card, CardContent } from '@mui/material';
import { CheckCircle, Error } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

const DhanCallback: React.FC = () => {
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Dhan OAuth login...');

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          if (isMounted) {
            setStatus('error');
            setMessage(`Dhan OAuth failed: ${error}`);
          }
          return;
        }

        if (code && state) {
          if (isMounted) {
            setMessage('Processing Dhan Partner OAuth callback...');
          }

          // Get connection ID from localStorage
          const connectionId = localStorage.getItem('dhan_connection_id');
          
          if (!connectionId) {
            if (isMounted) {
              setStatus('error');
              setMessage('Connection session not found. Please try connecting again.');
            }
            return;
          }

          // Send code and connection ID to Dhan Partner callback endpoint
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
            
            // Notify parent window about successful Dhan Partner connection
            if (window.opener) {
              window.opener.postMessage({
                type: 'DHAN_PARTNER_SUCCESS',
                data: response.data.broker
              }, '*');
            }
            
            // Close this popup window after 3 seconds
            timer = setTimeout(() => {
              window.close();
            }, 3000);
          } else {
            if (isMounted) {
              setStatus('error');
              setMessage(`Dhan Partner connection failed: ${response.data.message}`);
            }
          }
        } else {
          if (isMounted) {
            setStatus('error');
            setMessage('Missing authorization code or state parameter');
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
  }, [location.search]);

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      bgcolor: 'grey.50',
      p: 2
    }}>
      <Card sx={{ maxWidth: 400, textAlign: 'center' }}>
        <CardContent sx={{ p: 4 }}>
          {status === 'loading' && (
            <>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Processing Dhan Login
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {message}
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom color="success.main">
                Login Successful!
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {message}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 2 }}>
                This window will close automatically...
              </Typography>
            </>
          )}

          {status === 'error' && (
            <>
              <Error sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom color="error.main">
                Login Failed
              </Typography>
              <Alert severity="error" sx={{ mt: 2 }}>
                {message}
              </Alert>
              <Typography variant="caption" display="block" sx={{ mt: 2 }}>
                Please close this window and try again.
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DhanCallback;