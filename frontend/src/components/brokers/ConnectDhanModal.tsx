import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper
} from '@mui/material';
import {
  Close,
  Visibility,
  VisibilityOff,
  Security,
  Key,
  OpenInNew,
  CheckCircle,
  AccountBalance
} from '@mui/icons-material';
import { brokerApi } from '../../services/brokerApi';

interface ConnectDhanModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (broker: any) => void;
}

export const ConnectDhanModal: React.FC<ConnectDhanModalProps> = ({ open, onClose, onSuccess }) => {
  const [tab, setTab] = useState<number>(0);
  const [clientId, setClientId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !accessToken.trim()) {
      setError('Please provide both Dhan Client ID and Access Token.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await brokerApi.connectDhan({
        clientId: clientId.trim(),
        accessToken: accessToken.trim()
      });

      if (res.success) {
        onSuccess(res.broker);
        handleClose();
      } else {
        setError(res.message || 'Connection failed.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to validate Dhan credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await brokerApi.getDhanLoginUrl(clientId || undefined);
      if (res.loginUrl) {
        window.open(res.loginUrl, '_blank', 'width=600,height=750,noopener,noreferrer');
      } else {
        setError('Failed to generate OAuth Consent URL.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initialize Dhan OAuth.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setClientId('');
      setAccessToken('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', p: 1, borderRadius: 2, color: '#6366f1' }}>
            <AccountBalance />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
              Connect Dhan Account
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Official DhanHQ v2 Integration
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} disabled={loading} size="small">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab icon={<Key sx={{ fontSize: 18 }} />} iconPosition="start" label="API Access Token" sx={{ fontSize: '0.8125rem', textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<Security sx={{ fontSize: 18 }} />} iconPosition="start" label="Partner OAuth Consent" sx={{ fontSize: '0.8125rem', textTransform: 'none', fontWeight: 600 }} />
        </Tabs>
      </Box>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5 }}>
            {error}
          </Alert>
        )}

        {tab === 0 ? (
          <form onSubmit={handleConnectToken}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Dhan Client ID"
                placeholder="e.g. 1108893841"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                fullWidth
                size="small"
                helperText="10-digit Dhan Client ID from Dhan App / Profile"
              />

              <TextField
                label="API Access Token"
                placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOi..."
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                required
                fullWidth
                multiline={showToken}
                rows={showToken ? 3 : 1}
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowToken(!showToken)} edge="end" size="small">
                        {showToken ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                helperText="Daily Access Token generated from Dhan Developer Portal"
              />

              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', display: 'block', mb: 0.5 }}>
                  Security & Privacy:
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1.5 }}>
                  Your token is encrypted with AES-256-GCM before saving. Tokens are never exposed to the frontend or shared with third parties.
                </Typography>
              </Paper>
            </Box>

            <DialogActions sx={{ px: 0, pt: 3 }}>
              <Button onClick={handleClose} disabled={loading} color="inherit">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !clientId || !accessToken}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                sx={{ px: 3, fontWeight: 600 }}
              >
                {loading ? 'Validating...' : 'Connect Dhan'}
              </Button>
            </DialogActions>
          </form>
        ) : (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Box sx={{ width: 56, height: 56, bgcolor: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
              <Security sx={{ fontSize: 32, color: '#6366f1' }} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Authorize via Dhan Partner Consent
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3, maxWidth: 420, mx: 'auto' }}>
              Authorize Home-Treding using your Dhan credentials without sharing passwords or daily API tokens.
            </Typography>

            <Button
              variant="contained"
              size="large"
              endIcon={<OpenInNew />}
              onClick={handleOAuthLogin}
              disabled={loading}
              sx={{ px: 4, py: 1.2, fontWeight: 700 }}
            >
              Open Dhan Login
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
