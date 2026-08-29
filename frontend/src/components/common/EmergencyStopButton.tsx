import React, { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';
import { WarningAmber, CheckCircleOutline, Shield } from '@mui/icons-material';
import { brokerApi, KillSwitchStatus } from '../../services/brokerApi';

export const EmergencyStopButton: React.FC = () => {
  const [status, setStatus] = useState<KillSwitchStatus>({ isHalted: false });
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await brokerApi.getRiskStatus();
      if (res && res.killSwitch) {
        setStatus(res.killSwitch);
      }
    } catch {
      // ignore
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (status.isHalted) {
        const res = await brokerApi.resetEmergencyStop();
        setStatus(res);
      } else {
        const res = await brokerApi.triggerEmergencyStop('Manual Emergency Stop triggered from Navbar');
        setStatus(res);
      }
      setOpenModal(false);
    } catch (e) {
      console.error('Failed to toggle kill switch', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={status.isHalted ? <WarningAmber sx={{ fontSize: 14 }} /> : <Shield sx={{ fontSize: 14 }} />}
        onClick={() => setOpenModal(true)}
        sx={{
          fontWeight: 700,
          fontSize: '0.72rem',
          py: 0.4,
          px: 1.2,
          borderRadius: 2,
          textTransform: 'none',
          bgcolor: status.isHalted ? '#fef2f2' : '#ffffff',
          color: status.isHalted ? '#dc2626' : '#64748b',
          borderColor: status.isHalted ? '#fee2e2' : '#e2e8f0',
          '&:hover': {
            bgcolor: status.isHalted ? '#fee2e2' : '#f8fafc',
            borderColor: status.isHalted ? '#fca5a5' : '#cbd5e1',
            color: status.isHalted ? '#b91c1c' : '#0f172a'
          }
        }}
      >
        {status.isHalted ? 'HALTED' : 'Kill Switch'}
      </Button>

      <Dialog open={openModal} onClose={() => !loading && setOpenModal(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 0, overflow: 'hidden' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem', p: 2.5, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1, color: status.isHalted ? '#16a34a' : '#dc2626' }}>
          {status.isHalted ? <CheckCircleOutline sx={{ fontSize: 20 }} /> : <WarningAmber sx={{ fontSize: 20 }} />}
          {status.isHalted ? 'Resume Trading Automation?' : 'Trigger Emergency Stop?'}
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          <Typography variant="body2" sx={{ mb: 2, color: '#475569', fontSize: '0.85rem' }}>
            {status.isHalted
              ? 'This will clear the halt condition and allow active automated strategies to place virtual/live orders again.'
              : 'This will immediately HALT all active strategy signals, block any new incoming orders, and protect your capital from market turbulence.'}
          </Typography>
          {status.isHalted && status.haltReason && (
            <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fee2e2' }}>
              <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 600 }}>
                Halt Reason: {status.haltReason}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #f1f5f9' }}>
          <Button onClick={() => setOpenModal(false)} disabled={loading} sx={{ textTransform: 'none', color: '#64748b' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={status.isHalted ? 'success' : 'error'}
            onClick={handleToggle}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            {status.isHalted ? 'Resume Automation' : 'Confirm Halt'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
