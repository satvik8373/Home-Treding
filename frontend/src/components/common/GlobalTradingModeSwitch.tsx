import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography
} from '@mui/material';
import {
  WarningAmber as WarningIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  ScienceOutlined,
  BoltOutlined
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTradingMode } from '../../context/TradingModeContext';

export const GlobalTradingModeSwitch: React.FC = () => {
  const { isLive, isBrokerConnected, broker, isLoading, setMode } = useTradingMode();
  const navigate = useNavigate();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [connectPromptOpen, setConnectPromptOpen] = useState(false);

  const handleSelectMode = (target: 'paper' | 'live') => {
    if (target === 'paper') {
      if (!isLive) return;
      setMode('paper');
    } else {
      if (isLive) return;
      if (!isBrokerConnected) {
        setConnectPromptOpen(true);
      } else {
        setConfirmOpen(true);
      }
    }
  };

  const handleConfirmLive = async () => {
    setConfirmOpen(false);
    const res = await setMode('live');
    if (res.requiresBroker) {
      setConnectPromptOpen(true);
    }
  };

  return (
    <>
      {/* Clean segmented mode toggle */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          p: '2px',
          bgcolor: '#f1f5f9',
          borderRadius: 1.5,
          border: '1px solid #e2e8f0',
          userSelect: 'none'
        }}
      >
        <Button
          size="small"
          onClick={() => handleSelectMode('paper')}
          disabled={isLoading}
          startIcon={<ScienceOutlined sx={{ fontSize: 13 }} />}
          sx={{
            py: 0.3,
            px: 1.2,
            minHeight: 26,
            borderRadius: 1.2,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.01em',
            bgcolor: !isLive ? '#0f172a' : 'transparent',
            color: !isLive ? '#ffffff' : '#64748b',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: !isLive ? '#1e293b' : '#e8edf3',
              boxShadow: 'none'
            }
          }}
        >
          Paper
        </Button>

        <Button
          size="small"
          onClick={() => handleSelectMode('live')}
          disabled={isLoading}
          startIcon={<BoltOutlined sx={{ fontSize: 13 }} />}
          sx={{
            py: 0.3,
            px: 1.2,
            minHeight: 26,
            borderRadius: 1.2,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.01em',
            bgcolor: isLive ? '#dc2626' : 'transparent',
            color: isLive ? '#ffffff' : '#64748b',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: isLive ? '#b91c1c' : '#e8edf3',
              boxShadow: 'none'
            }
          }}
        >
          Real
        </Button>
      </Box>

      {/* Live Money Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            p: 0,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, pt: 2, px: 2.5 }}>
          <Box
            sx={{
              p: 0.8,
              borderRadius: 1.5,
              bgcolor: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <WarningIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#991b1b', lineHeight: 1.2 }}>
              Enable Real Money Trading?
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Broker: {broker?.accountName || 'DhanHQ'} ({broker?.maskedClientId || broker?.clientId || 'Connected'})
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ py: 1.5, px: 2.5 }}>
          <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fee2e2', mb: 2 }}>
            <Typography variant="body2" sx={{ color: '#7f1d1d', fontSize: '0.82rem', lineHeight: 1.5 }}>
              Every trade signal and manual order will execute with <strong>real capital</strong> directly on NSE/BSE via DhanHQ.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ fontSize: 15, color: '#16a34a' }} />
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600 }}>
                Dhan account verified and authorized
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon sx={{ fontSize: 15, color: '#2563eb' }} />
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600 }}>
                Kill-switch and risk guardrails remain active
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: '#64748b',
              borderColor: '#cbd5e1'
            }}
          >
            Stay in Paper Mode
          </Button>
          <Button
            onClick={handleConfirmLive}
            variant="contained"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#dc2626',
              color: '#ffffff',
              '&:hover': { bgcolor: '#b91c1c' }
            }}
          >
            Activate Real Money
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connect Broker Prompt */}
      <Dialog
        open={connectPromptOpen}
        onClose={() => setConnectPromptOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5, p: 0, border: '1px solid #e2e8f0', overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pt: 2, pb: 1, px: 2.5 }}>
          <Box
            sx={{
              p: 0.8,
              borderRadius: 1.5,
              bgcolor: '#f1f5f9',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <LinkIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Connect Dhan Broker First
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Real Money Trading requires an active Dhan account
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ py: 1.5, px: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Connect your DhanHQ account with your Client ID and Access Token to enable real-money execution.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setConnectPromptOpen(false)}
            variant="text"
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setConnectPromptOpen(false);
              navigate('/brokers');
            }}
            variant="contained"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: '#0f172a',
              color: '#ffffff',
              '&:hover': { bgcolor: '#1e293b' }
            }}
          >
            Connect Dhan Broker
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
