import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Refresh as RefreshIcon,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import TradingViewLiveChart, { StrategyLevels } from '../components/TradingViewLiveChart';
import { PageHeader, StatusBadge } from '../components/ui';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

const PRESET_SYMBOLS = [
  { label: 'NIFTY 50', symbol: 'NIFTY 50', tvSymbol: 'TVC:NIFTY' },
  { label: 'BANKNIFTY', symbol: 'BANKNIFTY', tvSymbol: 'NSE:BANKNIFTY' },
  { label: 'FINNIFTY', symbol: 'FINNIFTY', tvSymbol: 'NSE:FINNIFTY' },
  { label: 'SENSEX', symbol: 'SENSEX', tvSymbol: 'BSE:SENSEX' },
  { label: 'MIDCPNIFTY', symbol: 'MIDCPNIFTY', tvSymbol: 'NSE:MIDCPNIFTY' }
];

export const LiveChartPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [niftyStatus, setNiftyStatus] = useState<any>(null);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/strategies/nifty009/status`);
      if (res.data?.success) {
        setNiftyStatus(res.data);
      }
    } catch (e) {
      // Handled silently
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const spotBase = niftyStatus?.firstCandleClose || niftyStatus?.niftyLtp || 0;
  const strategyLevels: StrategyLevels = {
    spotBase: spotBase,
    upperLevel: niftyStatus?.spotUpperLevel || (spotBase > 0 ? Number((spotBase * 1.0009).toFixed(2)) : 0),
    lowerLevel: niftyStatus?.spotLowerLevel || (spotBase > 0 ? Number((spotBase * 0.9991).toFixed(2)) : 0),
    liveLtp: niftyStatus?.niftyLtp || spotBase
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: '100%', pb: 3 }}>
        {/* Page Top Header */}
        <PageHeader
          title="Live TradingView Terminal"
          subtitle="Real-time multi-asset institutional charting engine with independent 0.09% strategy trigger overlays"
          badge={
            <StatusBadge
              status={niftyStatus?.isRunning ? 'live' : 'paper'}
              label={niftyStatus?.isRunning ? 'STRATEGY RUNNING' : 'PAPER / STANDBY'}
            />
          }
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DashboardIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/dashboard')}
                sx={{
                  bgcolor: '#ffffff',
                  color: '#334155',
                  borderColor: '#cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: '#f1f5f9',
                    borderColor: '#94a3b8'
                  }
                }}
              >
                Dashboard
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={fetchStatus}
                sx={{
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: '#1e293b',
                    boxShadow: 'none'
                  }
                }}
              >
                Refresh Data
              </Button>
            </Box>
          }
        />

        {/* Quick Symbol Switcher Pill Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            overflowX: 'auto',
            py: 1,
            mb: 2,
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { height: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 2 }
          }}
        >
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', mr: 0.5 }}>
            INSTRUMENTS:
          </Typography>

          {PRESET_SYMBOLS.map((item) => {
            const isSelected = selectedSymbol === item.symbol;
            return (
              <Chip
                key={item.symbol}
                label={item.label}
                clickable
                onClick={() => setSelectedSymbol(item.symbol)}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: 1.5,
                  bgcolor: isSelected ? '#0f172a' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#334155',
                  border: isSelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                  '&:hover': {
                    bgcolor: isSelected ? '#1e293b' : '#f8fafc'
                  }
                }}
              />
            );
          })}

          {/* Option Contract Quick Picks if locked */}
          {niftyStatus?.lockedAtm?.ceSymbol && (
            <Chip
              label={`NIFTY CE (${niftyStatus.lockedAtm.atmStrike})`}
              clickable
              onClick={() => setSelectedSymbol(niftyStatus.lockedAtm.ceSymbol)}
              icon={<TrendingUp sx={{ fontSize: '14px !important', color: selectedSymbol === niftyStatus.lockedAtm.ceSymbol ? '#ffffff !important' : '#16a34a !important' }} />}
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                borderRadius: 1.5,
                bgcolor: selectedSymbol === niftyStatus.lockedAtm.ceSymbol ? '#16a34a' : '#ffffff',
                color: selectedSymbol === niftyStatus.lockedAtm.ceSymbol ? '#ffffff' : '#16a34a',
                border: '1px solid #cbd5e1',
                '&:hover': {
                  bgcolor: selectedSymbol === niftyStatus.lockedAtm.ceSymbol ? '#15803d' : '#f0fdf4'
                }
              }}
            />
          )}

          {niftyStatus?.lockedAtm?.peSymbol && (
            <Chip
              label={`NIFTY PE (${niftyStatus.lockedAtm.atmStrike})`}
              clickable
              onClick={() => setSelectedSymbol(niftyStatus.lockedAtm.peSymbol)}
              icon={<TrendingDown sx={{ fontSize: '14px !important', color: selectedSymbol === niftyStatus.lockedAtm.peSymbol ? '#ffffff !important' : '#dc2626 !important' }} />}
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                borderRadius: 1.5,
                bgcolor: selectedSymbol === niftyStatus.lockedAtm.peSymbol ? '#dc2626' : '#ffffff',
                color: selectedSymbol === niftyStatus.lockedAtm.peSymbol ? '#ffffff' : '#dc2626',
                border: '1px solid #cbd5e1',
                '&:hover': {
                  bgcolor: selectedSymbol === niftyStatus.lockedAtm.peSymbol ? '#b91c1c' : '#fef2f2'
                }
              }}
            />
          )}
        </Box>

        {/* Strategy Execution Ribbon */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gap: 1.5,
            mb: 2.5
          }}
        >
          {/* Metric 1: Spot Base */}
          <Box sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              SPOT BASE LEVEL
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
              {niftyStatus?.firstCandleClose ? `₹${niftyStatus.firstCandleClose.toFixed(2)}` : '₹26,180.00'}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
              09:15-09:20 5M Close
            </Typography>
          </Box>

          {/* Metric 2: Call Breakout Level */}
          <Box sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
              ATM CE TRIGGER (+0.09%)
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace' }}>
              {niftyStatus?.ce?.upperLevel ? `₹${niftyStatus.ce.upperLevel.toFixed(2)}` : niftyStatus?.upperLevel ? `₹${niftyStatus.upperLevel.toFixed(2)}` : '—'}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
              CE State: {niftyStatus?.ce?.state || 'FLAT'} • LTP: ₹{niftyStatus?.ceLtp !== undefined ? niftyStatus.ceLtp.toFixed(2) : '—'}
            </Typography>
          </Box>

          {/* Metric 3: Put Breakout Level */}
          <Box sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
              ATM PE TRIGGER (-0.09%)
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
              {niftyStatus?.pe?.lowerLevel ? `₹${niftyStatus.pe.lowerLevel.toFixed(2)}` : niftyStatus?.lowerLevel ? `₹${niftyStatus.lowerLevel.toFixed(2)}` : '—'}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
              PE State: {niftyStatus?.pe?.state || 'FLAT'} • LTP: ₹{niftyStatus?.peLtp !== undefined ? niftyStatus.peLtp.toFixed(2) : '—'}
            </Typography>
          </Box>

          {/* Metric 4: Locked Strike & Strategy Session */}
          <Box sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              LOCKED ATM STRIKE
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
              {niftyStatus?.lockedAtm?.atmStrike ? `${niftyStatus.lockedAtm.atmStrike} STRIKE` : 'Auto Resolving'}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
              Session: 09:20 - 15:10 IST
            </Typography>
          </Box>
        </Box>

        {/* Dedicated Live Chart Viewport - Responsive Height */}
        <Box sx={{ width: '100%' }}>
          <TradingViewLiveChart
            symbol={selectedSymbol}
            height="calc(100vh - 280px)"
            levels={strategyLevels}
            strategyName="NIFTY 0.09% Breakout"
            isSeparateScreen={true}
            onRefresh={fetchStatus}
          />
        </Box>
      </Box>
    </Layout>
  );
};

export default LiveChartPage;
