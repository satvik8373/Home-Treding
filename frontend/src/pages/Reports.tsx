import React, { useState, useEffect } from 'react';
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
import { Refresh, ReceiptLong, History, AccountBalanceWallet } from '@mui/icons-material';
import Layout from '../components/Layout';
import { PageHeader, StatCard, StatusBadge } from '../components/ui';
import axios from 'axios';

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

const Reports: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [report, setReport] = useState<PaperDailyReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    try {
      setLoading(true);
      const [reportRes, logsRes, posRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/paper/report`).catch(() => ({ data: { success: false } })),
        axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/paper/audit-logs`).catch(() => ({ data: { success: false } })),
        axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/paper/positions`).catch(() => ({ data: { success: false } }))
      ]);

      if (reportRes.data?.success && reportRes.data?.report) {
        setReport(reportRes.data.report);
      }
      if (logsRes.data?.success && logsRes.data?.logs) {
        setAuditLogs(logsRes.data.logs);
      }
      if (posRes.data?.success && posRes.data?.positions) {
        setPositions(posRes.data.positions);
      }
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (val: number = 0) => {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const isPnlPositive = (report?.netPnl || 0) >= 0;

  return (
    <Layout>
      <Box sx={{ maxWidth: '100%' }}>
        {/* Unified Page Header */}
        <PageHeader
          title="Trade History & Performance Reports"
          subtitle="Persistent trade ledger, brokerage breakdown, slippage metrics, and audit history"
          action={
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh sx={{ fontSize: 16 }} />}
              onClick={loadReportsData}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, fontSize: '0.8rem', borderColor: '#e2e8f0', color: '#475569' }}
            >
              Refresh Report
            </Button>
          }
        />

        {loading && !report ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} sx={{ color: '#0f172a' }} />
          </Box>
        ) : (
          <>
            {/* Unified KPI Metrics Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
              <StatCard
                label="Virtual Capital"
                value={`₹${formatPrice(report?.initialVirtualCapital || 100000)}`}
                subtext="Margin Ledger"
              />

              <StatCard
                label="Net Realized P&L"
                value={`${isPnlPositive ? '+' : ''}₹${formatPrice(report?.netPnl || 0)}`}
                subtext={`Gross: ₹${formatPrice(report?.grossPnl || 0)}`}
                trend={isPnlPositive ? 'up' : 'down'}
              />

              <StatCard
                label="Brokerage & Slippage"
                value={`₹${formatPrice((report?.totalBrokerage || 0) + (report?.totalSlippageCost || 0))}`}
                subtext={`Brokerage: ₹${formatPrice(report?.totalBrokerage || 0)} | Slip: ₹${formatPrice(report?.totalSlippageCost || 0)}`}
                color="#b45309"
              />

              <StatCard
                label="Win Rate"
                value={`${report?.winRate ? report.winRate.toFixed(1) : 0}%`}
                subtext={`Total: ${report?.totalTrades || 0} (W: ${report?.winningTrades || 0} | L: ${report?.losingTrades || 0})`}
              />
            </Box>

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
                <Tab icon={<ReceiptLong sx={{ fontSize: 16 }} />} iconPosition="start" label="Trade History" />
                <Tab icon={<AccountBalanceWallet sx={{ fontSize: 16 }} />} iconPosition="start" label="Positions Ledger" />
                <Tab icon={<History sx={{ fontSize: 16 }} />} iconPosition="start" label="Event Audit Log" />
              </Tabs>

              {/* Tab 0: Executed Trades History */}
              {tabValue === 0 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', py: 1.2, borderBottom: '1px solid #e2e8f0' } }}>
                        <TableCell sx={{ pl: 2.5 }}>Trade ID</TableCell>
                        <TableCell>Symbol</TableCell>
                        <TableCell>Side</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Fill Price (₹)</TableCell>
                        <TableCell align="right">Turnover (₹)</TableCell>
                        <TableCell align="right" sx={{ pr: 2.5 }}>Timestamp</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!report?.trades || report.trades.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                            <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5, fontWeight: 500 }}>
                              No live paper trading execution records found for the current session.
                            </Typography>
                            <Button
                              variant="contained"
                              size="small"
                              href="/backtest"
                              sx={{
                                bgcolor: '#2563eb',
                                color: '#ffffff',
                                textTransform: 'none',
                                fontWeight: 700,
                                borderRadius: 2,
                                px: 2.5,
                                py: 0.8
                              }}
                            >
                              Open Backtest Analytics
                            </Button>
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.trades.map((t, idx) => {
                          const turnover = (t.price || 0) * (t.quantity || 0);
                          const tradeKey = t.tradeId || t.orderId || `${t.symbol}_${t.timestamp}_${idx}`;
                          return (
                            <TableRow key={tradeKey} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
                              <TableCell sx={{ pl: 2.5, fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                                {t.tradeId || t.orderId}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{t.symbol}</TableCell>
                              <TableCell>
                                <StatusBadge status={t.side === 'BUY' ? 'live' : 'halted'} label={t.side} />
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>{t.quantity}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem' }}>₹{formatPrice(t.price)}</TableCell>
                              <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#475569' }}>₹{formatPrice(turnover)}</TableCell>
                              <TableCell align="right" sx={{ pr: 2.5, color: '#64748b', fontSize: '0.75rem' }}>
                                {new Date(t.timestamp).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })
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
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Avg Price (₹)</TableCell>
                        <TableCell align="right">LTP (₹)</TableCell>
                        <TableCell align="right" sx={{ pr: 2.5 }}>Realized / Total P&L</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {positions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#94a3b8', fontSize: '0.85rem' }}>
                            No position history found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        positions.map((pos, idx) => {
                          const pnl = pos.totalPnl ?? (pos.quantity * (pos.ltp - pos.netAvgPrice));
                          const isPos = pnl >= 0;
                          const isClosed = pos.quantity === 0;
                          const posKey = pos.symbol || `pos_${idx}`;

                          return (
                            <TableRow key={posKey} hover sx={{ '& td': { py: 1.2, borderBottom: '1px solid #f8fafc' } }}>
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
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 2: Event Audit Logs */}
              {tabValue === 2 && (
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