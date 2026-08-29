import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  IconButton,
  Divider,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Refresh,
  DeleteOutline,
  AccountBalanceWallet,
  TrendingUp,
  ReceiptLong,
  Speed
} from '@mui/icons-material';
import { BrokerSummary, BrokerFunds, brokerApi } from '../../services/brokerApi';
import { StatusBadge } from '../ui';

interface DhanConnectionCardProps {
  broker: BrokerSummary;
  onRefresh: () => void;
  onDisconnect: (id: string) => void;
}

export const DhanConnectionCard: React.FC<DhanConnectionCardProps> = ({ broker, onRefresh, onDisconnect }) => {
  const [funds, setFunds] = useState<BrokerFunds | null>(null);
  const [positionsCount, setPositionsCount] = useState<number>(0);
  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [disconnectModal, setDisconnectModal] = useState(false);

  const fetchBrokerDetails = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const [fundsData, posData, ordData] = await Promise.all([
        brokerApi.getFunds(broker.id),
        brokerApi.getPositions(broker.id),
        brokerApi.getOrders(broker.id)
      ]);
      setFunds(fundsData);
      setPositionsCount(posData.length);
      setOrdersCount(ordData.length);
    } catch (e: any) {
      console.error('Failed to fetch broker details', e);
      if (e.response?.status === 401 || e.message?.includes('401') || e.message?.includes('expired') || e.message?.includes('invalid')) {
        setAuthError('Token expired or invalid');
      } else {
        setAuthError('Unable to connect to Dhan');
      }
    } finally {
      setLoading(false);
    }
  }, [broker.id]);

  useEffect(() => {
    fetchBrokerDetails();
  }, [fetchBrokerDetails]);

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await brokerApi.disconnectBroker(broker.id);
      onDisconnect(broker.id);
      setDisconnectModal(false);
    } catch (err) {
      console.error('Failed to disconnect broker', err);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = broker.status === 'Connected';

  return (
    <>
      <Card
        sx={{
          borderRadius: 2.5,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          bgcolor: '#ffffff',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem'
                }}
              >
                DH
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.98rem', lineHeight: 1.2 }}>
                  DhanHQ v2
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>
                  Client ID: {broker.maskedClientId || broker.clientId}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StatusBadge
                status={isConnected && !authError ? 'live' : 'halted'}
                label={authError ? 'TOKEN EXPIRED' : broker.status}
              />
              <Tooltip title="Disconnect Broker">
                <IconButton size="small" sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626' } }} onClick={() => setDisconnectModal(true)}>
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Token Expired Alert Banner */}
          {authError && (
            <Box sx={{ p: 1.5, mb: 1.5, bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 2 }}>
              <Typography sx={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.8rem' }}>
                ⚠️ Dhan Access Token Expired or Invalid
              </Typography>
              <Typography sx={{ color: '#7f1d1d', fontSize: '0.75rem', mt: 0.25 }}>
                Dhan access tokens expire periodically. Please click <strong>Connect Dhan</strong> above to generate and enter a fresh token.
              </Typography>
            </Box>
          )}

          {/* Funds & Metrics Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, my: 2 }}>
            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #f1f5f9' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color: '#64748b' }}>
                <AccountBalanceWallet sx={{ fontSize: 13 }} />
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Margin</Typography>
              </Box>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                ₹{(funds?.availableMargin ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Typography>
            </Box>

            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #f1f5f9' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color: '#64748b' }}>
                <TrendingUp sx={{ fontSize: 13 }} />
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Positions</Typography>
              </Box>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                {positionsCount} Active
              </Typography>
            </Box>

            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #f1f5f9' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color: '#64748b' }}>
                <ReceiptLong sx={{ fontSize: 13 }} />
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Orders</Typography>
              </Box>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                {ordersCount} Placed
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1.5, borderColor: '#f1f5f9' }} />

          {/* Status info & Action bar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Speed sx={{ fontSize: 15, color: isConnected && !authError ? '#16a34a' : '#dc2626' }} />
              <Typography sx={{ color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>
                Status:{' '}
                {isConnected && !authError ? (
                  <strong style={{ color: '#16a34a' }}>Live & Ready</strong>
                ) : (
                  <strong style={{ color: '#dc2626' }}>Disconnected / Expired</strong>
                )}
              </Typography>
            </Box>

            <Button
              size="small"
              variant="outlined"
              startIcon={loading ? <CircularProgress size={12} /> : <Refresh sx={{ fontSize: 14 }} />}
              onClick={() => {
                fetchBrokerDetails();
                onRefresh();
              }}
              disabled={loading}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.3, px: 1.5, borderRadius: 1.5, borderColor: '#e2e8f0', color: '#475569' }}
            >
              Sync
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation */}
      <Dialog open={disconnectModal} onClose={() => setDisconnectModal(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 0, overflow: 'hidden' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem', borderBottom: '1px solid #f1f5f9', p: 2 }}>
          Disconnect Dhan Account?
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
            Are you sure you want to disconnect your Dhan account (<strong>{broker.maskedClientId}</strong>)?
            Active automated strategies will switch to paper mode.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #f1f5f9' }}>
          <Button onClick={() => setDisconnectModal(false)} sx={{ textTransform: 'none', color: '#64748b' }}>
            Cancel
          </Button>
          <Button onClick={handleDisconnect} variant="contained" color="error" disabled={loading} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            Disconnect
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
