import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Typography
} from '@mui/material';
import { Refresh, ReceiptLong, History, AccountBalanceWallet, Download } from '@mui/icons-material';
import Layout from '../components/Layout';
import { PageHeader, StatCard, StatusBadge } from '../components/ui';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { useTradingMode } from '../context/TradingModeContext';
import { BrokerFunds } from '../services/brokerApi';

interface PaperDailyReport {
  date: string;
  initialVirtualCapital: number;
  finalVirtualCapital: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  grossPnl: number;
  totalBrokerage: number;
  totalSlippageCost: number;
  netPnl: number;
  maxDrawdown: number;
  trades: any[];
  openPositions: any[];
}

interface AuditLog {
  id: string;
  timestamp: string;
  eventType: string;
  symbol: string;
  details: any;
}

interface LiveDhanTrade {
  dhanClientId?: string;
  orderId?: string;
  exchangeOrderId?: string;
  exchangeTradeId?: string;
  transactionType?: 'BUY' | 'SELL';
  exchangeSegment?: string;
  productType?: string;
  orderType?: string;
  tradingSymbol?: string;
  securityId?: string;
  tradedQuantity?: number;
  tradedPrice?: number;
  createTime?: string;
  exchangeTime?: string;
}

const Reports: React.FC = () => {
  const { isLive } = useTradingMode();
  const [tabValue, setTabValue] = useState(0);

  // Paper states
  const [paperReport, setPaperReport] = useState<PaperDailyReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [paperPositions, setPaperPositions] = useState<any[]>([]);

  // Live Dhan states
  const [liveTrades, setLiveTrades] = useState<LiveDhanTrade[]>([]);
  const [livePositions, setLivePositions] = useState<any[]>([]);
  const [liveFunds, setLiveFunds] = useState<BrokerFunds | null>(null);

  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (isLive) {
        const [tradesRes, posRes, fundsRes] = await Promise.all([
          axios.get(`${API_CONFIG.BASE_URL}/api/brokers/trades`).catch(() => ({ data: { success: false, trades: [] } })),
          axios.get(`${API_CONFIG.BASE_URL}/api/brokers/positions`).catch(() => ({ data: { success: false, positions: [] } })),
          axios.get(`${API_CONFIG.BASE_URL}/api/brokers/funds`).catch(() => ({ data: { success: false, funds: null } }))
        ]);

        if (tradesRes.data?.success && Array.isArray(tradesRes.data.trades)) {
          setLiveTrades(tradesRes.data.trades);
        }
        if (posRes.data?.success && Array.isArray(posRes.data.positions)) {
          setLivePositions(posRes.data.positions);
        }
        if (fundsRes.data?.success && fundsRes.data?.funds) {
          setLiveFunds(fundsRes.data.funds);
        }
      } else {
        const [reportRes, logsRes, posRes] = await Promise.all([
          axios.get(`${API_CONFIG.BASE_URL}/api/paper/report`).catch(() => ({ data: { success: false } })),
          axios.get(`${API_CONFIG.BASE_URL}/api/paper/audit-logs`).catch(() => ({ data: { success: false } })),
          axios.get(`${API_CONFIG.BASE_URL}/api/paper/positions`).catch(() => ({ data: { success: false } }))
        ]);

        if (reportRes.data?.success && reportRes.data?.report) {
          setPaperReport(reportRes.data.report);
        }
        if (logsRes.data?.success && logsRes.data?.logs) {
          setAuditLogs(logsRes.data.logs);
        }
        if (posRes.data?.success && posRes.data?.positions) {
          setPaperPositions(posRes.data.positions);
        }
      }
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  }, [isLive]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatPrice = (val: number = 0) => {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Export current table view as CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (isLive) {
      csvContent += 'Trade ID,Order ID,Symbol,Exchange,Side,Quantity,Price,Turnover,Timestamp\n';
      liveTrades.forEach((t) => {
        const turnover = (t.tradedPrice || 0) * (t.tradedQuantity || 0);
        csvContent += `"${t.exchangeTradeId || ''}","${t.orderId || ''}","${t.tradingSymbol || t.securityId || ''}","${t.exchangeSegment || 'NSE'}","${t.transactionType || ''}",${t.tradedQuantity || 0},${t.tradedPrice || 0},${turnover},"${t.exchangeTime || t.createTime || ''}"\n`;
      });
    } else {
      csvContent += 'Trade ID,Order ID,Symbol,Side,Quantity,Price,Turnover,Timestamp\n';
      (paperReport?.trades || []).forEach((t) => {
        const turnover = (t.price || 0) * (t.quantity || 0);
        csvContent += `"${t.tradeId || ''}","${t.orderId || ''}","${t.symbol || ''}","${t.side || ''}",${t.quantity || 0},${t.price || 0},${turnover},"${t.timestamp || ''}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${isLive ? 'live_dhan' : 'paper'}_trades_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Live Dhan calculations
  const liveRealizedPnl = livePositions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);
  const liveUnrealizedPnl = livePositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
  const liveTotalTurnover = liveTrades.reduce((sum, t) => sum + ((t.tradedPrice || 0) * (t.tradedQuantity || 0)), 0);
  const isLivePnlPos = liveRealizedPnl >= 0;

  // Paper calculations
  const isPaperPnlPos = (paperReport?.netPnl || 0) >= 0;

  return (
    <Layout>
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        {/* Header directly reflecting global header toggle */}
        <PageHeader
          title="Trade History & Performance Reports"
          subtitle={
            isLive
              ? 'Official DhanHQ v2 real executed tradebook, positions, and live fund utilization'
              : 'Virtual paper trading execution records, fee breakdown (₹20 + 0.0125%), and slippage metrics'
          }
          badge={
            <StatusBadge
              status={isLive ? 'live' : 'paper'}
              dot
              label={isLive ? 'DHAN REAL LEDGER' : 'PAPER TRADING'}
            />
          }
          action={
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download sx={{ fontSize: 16 }} />}
                onClick={handleExportCSV}
                sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, fontSize: '0.8rem', borderColor: '#e2e8f0', color: '#475569' }}
              >
                Export CSV
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh sx={{ fontSize: 16 }} />}
                onClick={loadData}
                disabled={loading}
                sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, fontSize: '0.8rem', borderColor: '#e2e8f0', color: '#475569' }}
              >
                Refresh
              </Button>
            </Box>
          }
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} sx={{ color: '#0f172a' }} />
          </Box>
        ) : (
          <>
            {/* KPI Metric Cards */}
            {isLive ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
                <StatCard
                  label="Available Dhan Balance"
                  value={`₹${formatPrice(liveFunds?.availableMargin || 0)}`}
                  subtext={`Total: ₹${formatPrice(liveFunds?.totalAccountBalance || 0)}`}
                  icon={<AccountBalanceWallet sx={{ fontSize: 18 }} />}
                />

                <StatCard
                  label="Live Realized P&L"
                  value={`${isLivePnlPos ? '+' : ''}₹${formatPrice(liveRealizedPnl)}`}
                  subtext={`MTM Unrealized: ₹${formatPrice(liveUnrealizedPnl)}`}
                  trend={isLivePnlPos ? 'up' : 'down'}
                />

                <StatCard
                  label="Executed Turnover"
                  value={`₹${formatPrice(liveTotalTurnover)}`}
                  subtext={`${liveTrades.length} Dhan exchange fills`}
                  color="#2563eb"
                />

                <StatCard
                  label="Open Positions"
                  value={`${livePositions.filter(p => p.quantity !== 0).length} Open`}
                  subtext={`Margin Used: ₹${formatPrice(liveFunds?.usedMargin || 0)}`}
                />
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
                <StatCard
                  label="Virtual Capital"
                  value={`₹${formatPrice(paperReport?.initialVirtualCapital || 100000)}`}
                  subtext="Virtual Simulation Margin"
                />

                <StatCard
                  label="Net Realized P&L"
                  value={`${isPaperPnlPos ? '+' : ''}₹${formatPrice(paperReport?.netPnl || 0)}`}
                  subtext={`Gross: ₹${formatPrice(paperReport?.grossPnl || 0)}`}
                  trend={isPaperPnlPos ? 'up' : 'down'}
                />

                <StatCard
                  label="Brokerage & Slippage"
                  value={`₹${formatPrice((paperReport?.totalBrokerage || 0) + (paperReport?.totalSlippageCost || 0))}`}
                  subtext={`Brokerage: ₹${formatPrice(paperReport?.totalBrokerage || 0)} | Slip: ₹${formatPrice(paperReport?.totalSlippageCost || 0)}`}
                  color="#b45309"
                />

                <StatCard
                  label="Win Rate"
                  value={`${paperReport?.winRate ? paperReport.winRate.toFixed(1) : 0}%`}
                  subtext={`Total: ${paperReport?.totalTrades || 0} (W: ${paperReport?.winningTrades || 0} | L: ${paperReport?.losingTrades || 0})`}
                />
              </Box>
            )}

            {/* Tabbed Report Table */}
            <Paper sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              <Tabs
                value={tabValue}
                onChange={(_, v) => setTabValue(v)}
                sx={{
                  borderBottom: '1px solid #f1f5f9',
                  bgcolor: '#f8fafc',
                  px: 2,
                  '& .MuiTab-root': {
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    textTransform: 'none',
                    minHeight: 48,
                    color: '#64748b',
                    '&.Mui-selected': { color: '#0f172a' }
                  }
                }}
              >
                <Tab icon={<ReceiptLong sx={{ fontSize: 16 }} />} iconPosition="start" label={isLive ? "Live Dhan Tradebook" : "Paper Trade History"} />
                <Tab icon={<AccountBalanceWallet sx={{ fontSize: 16 }} />} iconPosition="start" label="Positions Ledger" />
                {!isLive && <Tab icon={<History sx={{ fontSize: 16 }} />} iconPosition="start" label="Event Audit Log" />}
              </Tabs>

              {/* Tab 0: Executed Trades */}
              {tabValue === 0 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', py: 1.2, borderBottom: '1px solid #e2e8f0' } }}>
                        <TableCell sx={{ pl: 2.5 }}>Trade ID</TableCell>
                        <TableCell>Order ID</TableCell>
                        <TableCell>Symbol</TableCell>
                        <TableCell>Side</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Fill Price (₹)</TableCell>
                        <TableCell align="right">Turnover (₹)</TableCell>
                        <TableCell align="right" sx={{ pr: 2.5 }}>Timestamp</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {isLive ? (
                        liveTrades.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                              <Typography variant="body2" sx={{ color: '#64748b', mb: 1, fontWeight: 600 }}>
                                No live exchange trades executed via DhanHQ today.
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                Real orders placed from the Trade Terminal will appear here once filled on NSE/BSE.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          liveTrades.map((t, idx) => {
                            const turnover = (t.tradedPrice || 0) * (t.tradedQuantity || 0);
                            const tradeKey = t.exchangeTradeId || t.orderId || `live_${idx}`;
                            return (
                              <TableRow key={tradeKey} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
                                <TableCell sx={{ pl: 2.5, fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                                  {t.exchangeTradeId || 'Dhan Trade'}
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                                  {t.orderId}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                                  {t.tradingSymbol || t.securityId}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={t.transactionType === 'BUY' ? 'live' : 'halted'} label={t.transactionType || 'BUY'} />
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                  {t.tradedQuantity}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                  ₹{formatPrice(t.tradedPrice)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#475569' }}>
                                  ₹{formatPrice(turnover)}
                                </TableCell>
                                <TableCell align="right" sx={{ pr: 2.5, color: '#64748b', fontSize: '0.75rem' }}>
                                  {t.exchangeTime ? new Date(t.exchangeTime).toLocaleTimeString() : (t.createTime ? new Date(t.createTime).toLocaleTimeString() : '-')}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )
                      ) : (
                        (!paperReport?.trades || paperReport.trades.length === 0) ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                              <Typography variant="body2" sx={{ color: '#64748b', mb: 1, fontWeight: 500 }}>
                                No paper trading execution records found for the current session.
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                Place simulated orders in the Trade Terminal to view fills.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          paperReport.trades.map((t, idx) => {
                            const turnover = (t.price || 0) * (t.quantity || 0);
                            const tradeKey = t.tradeId || t.orderId || `${t.symbol}_${t.timestamp}_${idx}`;
                            return (
                              <TableRow key={tradeKey} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
                                <TableCell sx={{ pl: 2.5, fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                                  {t.tradeId || t.orderId}
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                                  {t.orderId}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{t.symbol}</TableCell>
                                <TableCell>
                                  <StatusBadge status={t.side === 'BUY' ? 'live' : 'halted'} label={t.side} />
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>{t.quantity}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem' }}>₹{formatPrice(t.price)}</TableCell>
                                <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#475569' }}>₹{formatPrice(turnover)}</TableCell>
                                <TableCell align="right" sx={{ pr: 2.5, color: '#64748b', fontSize: '0.75rem' }}>
                                  {new Date(t.timestamp).toLocaleTimeString()}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 1: Positions Ledger */}
              {tabValue === 1 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', py: 1.2, borderBottom: '1px solid #e2e8f0' } }}>
                        <TableCell sx={{ pl: 2.5 }}>Symbol</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Avg Price (₹)</TableCell>
                        <TableCell align="right">LTP (₹)</TableCell>
                        <TableCell align="right" sx={{ pr: 2.5 }}>Realized / Total P&L</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {isLive ? (
                        livePositions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#94a3b8', fontSize: '0.85rem' }}>
                              No live Dhan positions for this trading session.
                            </TableCell>
                          </TableRow>
                        ) : (
                          livePositions.map((pos, idx) => {
                            const pnl = pos.totalPnl ?? ((pos.realizedPnl || 0) + (pos.unrealizedPnl || 0));
                            const isPos = pnl >= 0;
                            const isClosed = pos.quantity === 0;

                            return (
                              <TableRow key={pos.positionId || pos.symbol || idx} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
                                <TableCell sx={{ pl: 2.5, fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{pos.symbol}</TableCell>
                                <TableCell>
                                  <StatusBadge status={isClosed ? 'paper' : 'live'} label={isClosed ? 'CLOSED' : (pos.productType || 'INTRADAY')} />
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>{pos.quantity}</TableCell>
                                <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#475569' }}>₹{formatPrice(pos.netAvgPrice || pos.buyAvgPrice)}</TableCell>
                                <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700 }}>₹{formatPrice(pos.ltp)}</TableCell>
                                <TableCell align="right" sx={{ pr: 2.5, color: isPos ? '#16a34a' : '#dc2626', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.88rem' }}>
                                  {isPos ? '+' : ''}₹{formatPrice(pnl)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )
                      ) : (
                        paperPositions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#94a3b8', fontSize: '0.85rem' }}>
                              No paper position history found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paperPositions.map((pos, idx) => {
                            const pnl = pos.totalPnl ?? (pos.quantity * (pos.ltp - pos.netAvgPrice));
                            const isPos = pnl >= 0;
                            const isClosed = pos.quantity === 0;

                            return (
                              <TableRow key={pos.symbol || idx} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
                                <TableCell sx={{ pl: 2.5, fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{pos.symbol}</TableCell>
                                <TableCell>
                                  <StatusBadge status={isClosed ? 'paper' : 'live'} label={isClosed ? 'CLOSED' : 'OPEN'} />
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>{pos.quantity}</TableCell>
                                <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#475569' }}>₹{formatPrice(pos.netAvgPrice)}</TableCell>
                                <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700 }}>₹{formatPrice(pos.ltp)}</TableCell>
                                <TableCell align="right" sx={{ pr: 2.5, color: isPos ? '#16a34a' : '#dc2626', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.88rem' }}>
                                  {isPos ? '+' : ''}₹{formatPrice(pnl)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 2: Event Audit Logs (Paper Only) */}
              {tabValue === 2 && !isLive && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', py: 1.2, borderBottom: '1px solid #e2e8f0' } }}>
                        <TableCell sx={{ pl: 2.5 }}>Time</TableCell>
                        <TableCell>Event</TableCell>
                        <TableCell>Symbol</TableCell>
                        <TableCell sx={{ pr: 2.5 }}>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 6, color: '#94a3b8', fontSize: '0.85rem' }}>
                            No audit logs for this session.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log, idx) => {
                          const logKey = log.id || `${log.timestamp}_${log.eventType}_${idx}`;
                          return (
                            <TableRow key={logKey} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
                              <TableCell sx={{ pl: 2.5, color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={log.eventType.includes('FILLED') ? 'live' : log.eventType.includes('REJECTED') ? 'halted' : 'blue'} label={log.eventType} />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{log.symbol}</TableCell>
                              <TableCell sx={{ pr: 2.5, fontSize: '0.78rem', color: '#475569', fontFamily: 'monospace' }}>
                                {JSON.stringify(log.details)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </>
        )}
      </Box>
    </Layout>
  );
};

export default Reports;