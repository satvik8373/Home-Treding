/**
 * OAuth Callback Page
 * Handles the redirect from broker's OAuth login
 */

import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // Check for errors from OAuth provider
      if (error) {
        setStatus('error');
        setMessage(`Authentication failed: ${error}`);
        
        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-error',
            message: error
          }, window.location.origin);
          
          setTimeout(() => window.close(), 3000);
        }
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setStatus('error');
        setMessage('Invalid callback parameters');
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-error',
            message: 'Invalid callback parameters'
          }, window.location.origin);
          
          setTimeout(() => window.close(), 3000);
        }
        return;
      }

      try {
        // Exchange code for tokens
        const response = await axios.get(`${API_BASE}/api/oauth/callback`, {
          params: { code, state }
        });

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to exchange code for tokens');
        }

        const { accessToken, refreshToken, expiresIn, userId } = response.data.data;

        setStatus('success');
        setMessage('✅ Authentication successful! Closing window...');

        // Send tokens to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-success',
            accessToken,
            refreshToken,
            expiresIn,
            userId
          }, window.location.origin);

          // Close popup after 2 seconds
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          // If not in popup, redirect to brokerage page
          setTimeout(() => {
            navigate('/brokerage');
          }, 2000);
        }

      } catch (error: any) {
        console.error('OAuth callback error:', error);
        
        setStatus('error');
        setMessage(error.response?.data?.message || error.message || 'Authentication failed');

        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-error',
            message: error.message
          }, window.location.origin);

          setTimeout(() => window.close(), 3000);
        }
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 3,
        textAlign: 'center'
      }}
    >
      {status === 'loading' && (
        <>
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h6" gutterBottom>
            Authenticating...
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Please wait while we complete the authentication
          </Typography>
        </>
      )}

      {status === 'success' && (
        <>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3
            }}
          >
            <Typography variant="h3" color="white">
              ✓
            </Typography>
          </Box>
          <Typography variant="h6" gutterBottom color="success.main">
            Authentication Successful!
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {message}
          </Typography>
        </>
      )}

      {status === 'error' && (
        <>
          <Alert severity="error" sx={{ mb: 3, maxWidth: 500 }}>
            <Typography variant="body1" gutterBottom>
              <strong>Authentication Failed</strong>
            </Typography>
            <Typography variant="body2">
              {message}
            </Typography>
          </Alert>
          <Typography variant="body2" color="textSecondary">
            This window will close automatically...
          </Typography>
        </>
      )}
    </Box>
  );
};

export default OAuthCallback;
