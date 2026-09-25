import React from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  ArrowForward,
  TrendingUp,
  TrendingDown,
  AccessTime,
  Layers,
  AccountBalanceWallet
} from '@mui/icons-material';
import { StatusBadge, SectionCard, EmptyState } from './ui';

export interface Nifty009Status {
  isRunning: boolean;
  isPaused: boolean;
  isHalted: boolean;
  mode: 'paper' | 'live';
  status?: string;
  strategyName?: string;
  tradingWindow?: string;
  sessionDate: string;
  state: string;
  niftyLtp: number;
  ceLtp?: number;
  peLtp?: number;
  firstCandleClose: number | null;
  upperLevel: number | null;
  lowerLevel: number | null;
  lockedAtm: {
    atmStrike: number;
    expiry: string;
    ceSymbol: string;
    ceSecurityId?: string;
    ceLtp: number;
    peSymbol: string;
    peSecurityId?: string;
    peLtp: number;
    spotPriceAtResolution?: number;
  } | null;
  ce?: {
    securityId?: string;
    symbol: string;
    strike?: string;
    referenceClose: number | null;
    upperLevel: number | null;
    lowerLevel: number | null;
    currentLtp: number;
    state: 'FLAT' | 'LONG';
    position: {
      symbol: string;
      securityId: string;
      strike: number;
      entryPrice: number;
      quantity: number;
      entryTime: string;
      currentLtp: number;
      unrealizedPnl: number;
      realizedPnl: number;
    } | null;
    entryCount: number;
    exitCount: number;
  };
  pe?: {
    securityId?: string;
    symbol: string;
    strike?: string;
    referenceClose: number | null;
    upperLevel: number | null;
    lowerLevel: number | null;
    currentLtp: number;
    state: 'FLAT' | 'LONG';
    position: {
      symbol: string;
      securityId: string;
      strike: number;
      entryPrice: number;
      quantity: number;
      entryTime: string;
      currentLtp: number;
      unrealizedPnl: number;
      realizedPnl: number;
    } | null;
    entryCount: number;
    exitCount: number;
  };
  combined?: {
    activePositionsCount?: number;
    totalPositions?: number;
    totalTrades: number;
    ceTrades: number;
    peTrades: number;
    totalPnl: number;
    lastSignal?: any;
    lastExecutionTime?: string;
    timeRemaining?: string;
  };
  activePosition: any | null;
  sessionPnl: number;
  events?: Array<{ timestamp?: string; time?: string; type?: string; event?: string; data?: any; detail?: any }>;
}

interface Props {
  status: Nifty009Status | null;
  liveCeLtp?: number | null;
  livePeLtp?: number | null;
  liveNiftyLtp?: number | null;
  onPauseResume?: () => void;
  onSquareOff?: () => void;
  onDeploy?: () => void;
}

export const NiftyIndependentBreakoutMonitor: React.FC<Props> = ({
  status,
  liveCeLtp,
  livePeLtp,
  liveNiftyLtp,
  onPauseResume,
  onSquareOff,
  onDeploy
}) => {
  const formatPrice = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '—';
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (!status || !status.isRunning) {
    return (
      <SectionCard
        title="NIFTY ATM CE/PE Independent Breakout"
        badge={<StatusBadge status="offline" label="OFFLINE" />}
        action={
          <Button
            size="small"
            variant="contained"
            onClick={onDeploy}
            endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
            sx={{
              bgcolor: '#4f46e5',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 1.5,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#4338ca', boxShadow: 'none' }
            }}
          >
            Start Strategy
          </Button>
        }
      >
        <EmptyState
          title="Breakout Strategy Inactive"
          description="Monitors independent 09:15–09:20 5-minute candle closes for ATM CE and PE (+0.09% breakout) with automated execution and 15:10 force square-off."
          actionLabel="Deploy Strategy"
          onAction={onDeploy}
          compact
        />
      </SectionCard>
    );
  }

  // Real-time CE values
  const ceData = status.ce;
  const ceLtp = liveCeLtp || ceData?.currentLtp || status.lockedAtm?.ceLtp || 0;
  const ceRef = ceData?.referenceClose;
  const ceUpper = ceData?.upperLevel;
  const ceLower = ceData?.lowerLevel;
  const isCeLong = ceData?.state === 'LONG';
  const cePos = ceData?.position;
  const cePnl = cePos ? ((ceLtp - cePos.entryPrice) * cePos.quantity) : 0;

  // Real-time PE values
  const peData = status.pe;
  const peLtp = livePeLtp || peData?.currentLtp || status.lockedAtm?.peLtp || 0;
  const peRef = peData?.referenceClose;
  const peUpper = peData?.upperLevel;
  const peLower = peData?.lowerLevel;
  const isPeLong = peData?.state === 'LONG';
  const pePos = peData?.position;
  const pePnl = pePos ? ((peLtp - pePos.entryPrice) * pePos.quantity) : 0;

  // Combined metrics
  const combined = status.combined;
  const activeCount = (isCeLong ? 1 : 0) + (isPeLong ? 1 : 0);
  const totalCombinedPnl = (status.sessionPnl || 0) + (isCeLong ? cePnl : 0) + (isPeLong ? pePnl : 0);
  const totalTrades = combined?.totalTrades ?? ((ceData?.entryCount || 0) + (peData?.entryCount || 0));
  const ceTrades = combined?.ceTrades ?? (ceData?.entryCount || 0);
  const peTrades = combined?.peTrades ?? (peData?.entryCount || 0);

  const statusLabel = status.isPaused
    ? 'PAUSED'
    : status.isHalted
    ? 'HALTED'
    : status.status === 'DAY_COMPLETED'
    ? 'COMPLETED'
    : 'RUNNING';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* 1. Strategy Status Bar - Clean Institutional Header */}
      <SectionCard
        title="NIFTY ATM CE/PE Independent Breakout"
        badge={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <StatusBadge
              status={status.mode === 'live' ? 'live' : 'paper'}
              label={status.mode === 'live' ? 'LIVE' : 'PAPER'}
             
            />
            <StatusBadge
              status={status.isPaused ? 'warning' : 'success'}
              label={statusLabel}
             
            />
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={onPauseResume}
              startIcon={status.isPaused ? <PlayArrow sx={{ fontSize: 13 }} /> : <Pause sx={{ fontSize: 13 }} />}
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                py: 0.5,
                px: 1.2,
                borderRadius: 1.5,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                borderColor: '#cbd5e1',
                color: '#334155',
                bgcolor: '#ffffff',
                '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' }
              }}
            >
              {status.isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onSquareOff}
              startIcon={<Stop sx={{ fontSize: 13 }} />}
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                py: 0.5,
                px: 1.2,
                borderRadius: 1.5,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                borderColor: '#fca5a5',
                color: '#dc2626',
                bgcolor: '#fef2f2',
                '&:hover': { bgcolor: '#fee2e2', borderColor: '#ef4444' }
              }}
            >
              Force Square-Off
            </Button>
          </Box>
        }
        noPadding
      >
        {/* Trading Session Metadata Strip */}
        <Box sx={{ px: 2.5, py: 1.2, bgcolor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTime sx={{ fontSize: 14, color: '#64748b' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
              Trading Window: <strong style={{ color: '#0f172a' }}>09:20–15:10 IST</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>
              Spot Base: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>₹{formatPrice(liveNiftyLtp || status.niftyLtp)}</strong>
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>
              ATM Strike: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{status.lockedAtm?.atmStrike || (liveNiftyLtp ? Math.round(liveNiftyLtp / 50) * 50 : '—')}</strong>
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>
              Lot Size: <strong style={{ color: '#0f172a' }}>65 (NSE)</strong>
            </Typography>
          </Box>
        </Box>

        {/* 2 & 3. Dual Independent CE and PE Cards Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, borderBottom: '1px solid #e2e8f0' }}>
          
          {/* CE CARD */}
          <Box sx={{ p: 2.5, borderRight: { md: '1px solid #e2e8f0' }, bgcolor: '#ffffff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                    ATM CE
                  </Typography>
                  <StatusBadge
                    status={isCeLong ? 'success' : 'neutral'}
                    label={isCeLong ? 'LONG' : 'FLAT'}
                  />
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, mt: 0.3, wordBreak: 'break-word' }}>
                  Strike: <strong style={{ color: '#0f172a' }}>{status.lockedAtm?.ceSymbol || (ceData?.strike ?? '—')}</strong>
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                <Typography sx={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Current LTP
                </Typography>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace' }}>
                  ₹{formatPrice(ceLtp)}
                </Typography>
              </Box>
            </Box>

            {/* 4 Fixed Levels Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, mb: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  09:20 Ref Base
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', mt: 0.3 }}>
                  ₹{formatPrice(ceRef)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>
                  Buy Breakout (+0.09%)
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace', mt: 0.3 }}>
                  ₹{formatPrice(ceUpper)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>
                  Stop-Loss Guard
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626', fontFamily: 'monospace', mt: 0.3 }}>
                  ₹{formatPrice(ceLower)}
                </Typography>
              </Box>
            </Box>

            {/* CE Position Details */}
            {isCeLong && cePos ? (
              <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 1.5 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, textAlign: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Quantity</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{cePos.quantity} (2 Lots)</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Entry Price</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>₹{formatPrice(cePos.entryPrice)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>P&L</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, fontFamily: 'monospace', color: cePnl >= 0 ? '#16a34a' : '#dc2626' }}>
                      {cePnl >= 0 ? '+' : ''}₹{formatPrice(cePnl)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box sx={{ p: 1.2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                  State: <strong style={{ color: '#0f172a' }}>FLAT</strong> •{' '}
                  {ceUpper && ceLtp ? (
                    ceLtp < ceUpper ? (
                      <span>₹{(ceUpper - ceLtp).toFixed(2)} to Buy Trigger (₹{formatPrice(ceUpper)})</span>
                    ) : (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>Breakout active — confirming 5m close</span>
                    )
                  ) : (
                    <span>Awaiting 09:20 Reference Candle</span>
                  )}
                </Typography>
              </Box>
            )}
          </Box>

          {/* PE CARD */}
          <Box sx={{ p: 2.5, bgcolor: '#ffffff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                    ATM PE
                  </Typography>
                  <StatusBadge
                    status={isPeLong ? 'error' : 'neutral'}
                    label={isPeLong ? 'LONG' : 'FLAT'}
                  />
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, mt: 0.3, wordBreak: 'break-word' }}>
                  Strike: <strong style={{ color: '#0f172a' }}>{status.lockedAtm?.peSymbol || (peData?.strike ?? '—')}</strong>
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                <Typography sx={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Current LTP
                </Typography>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                  ₹{formatPrice(peLtp)}
                </Typography>
              </Box>
            </Box>

            {/* 4 Fixed Levels Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, mb: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  09:20 Ref Base
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', mt: 0.3 }}>
                  ₹{formatPrice(peRef)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>
                  Buy Breakout (+0.09%)
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace', mt: 0.3 }}>
                  ₹{formatPrice(peUpper)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>
                  Stop-Loss Guard
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626', fontFamily: 'monospace', mt: 0.3 }}>
                  ₹{formatPrice(peLower)}
                </Typography>
              </Box>
            </Box>

            {/* PE Position Details */}
            {isPeLong && pePos ? (
              <Box sx={{ p: 1.5, bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 1.5 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, textAlign: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Quantity</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{pePos.quantity} (2 Lots)</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Entry Price</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>₹{formatPrice(pePos.entryPrice)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>P&L</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, fontFamily: 'monospace', color: pePnl >= 0 ? '#16a34a' : '#dc2626' }}>
                      {pePnl >= 0 ? '+' : ''}₹{formatPrice(pePnl)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box sx={{ p: 1.2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                  State: <strong style={{ color: '#0f172a' }}>FLAT</strong> •{' '}
                  {peUpper && peLtp ? (
                    peLtp < peUpper ? (
                      <span>₹{(peUpper - peLtp).toFixed(2)} to Buy Trigger (₹{formatPrice(peUpper)})</span>
                    ) : (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>Breakout active — confirming 5m close</span>
                    )
                  ) : (
                    <span>Awaiting 09:20 Reference Candle</span>
                  )}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* 4. Combined Strategy Overview */}
        <Box sx={{ p: 2, bgcolor: '#f8fafc' }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 1.5 }}>
            Combined Overview
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            <Box sx={{ p: 1.2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Positions
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', mt: 0.3 }}>
                {activeCount === 0 ? '0 Active (FLAT)' : `${activeCount} Active (${isCeLong && isPeLong ? 'CE + PE' : isCeLong ? 'CE Only' : 'PE Only'})`}
              </Typography>
            </Box>

            <Box sx={{ p: 1.2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Strategy P&L
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: totalCombinedPnl >= 0 ? '#16a34a' : '#dc2626', fontFamily: 'monospace', mt: 0.3 }}>
                {totalCombinedPnl >= 0 ? '+' : ''}₹{formatPrice(totalCombinedPnl)}
              </Typography>
            </Box>

            <Box sx={{ p: 1.2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Today's Trades
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', mt: 0.3 }}>
                {totalTrades} <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>(CE: {ceTrades} | PE: {peTrades})</span>
              </Typography>
            </Box>

            <Box sx={{ p: 1.2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Time Remaining
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', mt: 0.3 }}>
                {combined?.timeRemaining || '15:10 IST Cutoff'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </SectionCard>
    </Box>
  );
};
