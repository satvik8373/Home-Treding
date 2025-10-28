import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Card, CardContent } from '@mui/material';
import { CheckCircle, Error } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';

const DhanCallback: React.FC = () => {
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Dhan login...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code && state) {
          // Successful login from Dhan
          setStatus('success');
          setMessage('✅ Dhan login successful! Terminal activated.');
          
          // Close this popup window after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
        } else {
          // No code received - might be an error
          const error = urlParams.get('error');
          if (error) {
            setStatus('error');
            setMessage(`❌ Dhan login failed: ${error}`);
          } else {
            setStatus('success');
            setMessage('✅ Dhan login completed. You can close this window.');
            setTimeout(() => {
              window.close();
            }, 2000);
          }
        }
      } catch (error) {
        setStatus('error');
        setMessage('❌ Error processing Dhan callback');
      }
    };

    handleCallback();
  }, [location]);

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