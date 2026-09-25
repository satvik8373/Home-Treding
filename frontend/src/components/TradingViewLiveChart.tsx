import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Button, ButtonGroup, Tooltip, IconButton } from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { createChart, CandlestickSeries, LineStyle, IChartApi, ISeriesApi, IPriceLine, UTCTimestamp } from 'lightweight-charts';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { io, Socket } from 'socket.io-client';
import { StatusBadge } from './ui/StatusBadge';
import OriginalTradingViewWidget from './OriginalTradingViewWidget';

export interface StrategyLevels {
  spotBase?: number | null;
  upperLevel?: number | null;
  lowerLevel?: number | null;
  liveLtp?: number | null;
}

export interface TradingViewLiveChartProps {
  symbol?: string;
  height?: number | string;
  levels?: StrategyLevels;
  strategyName?: string;
  isSeparateScreen?: boolean;
  onRefresh?: () => void;
}

export const TradingViewLiveChart: React.FC<TradingViewLiveChartProps> = ({
  symbol = 'NIFTY 50',
  height = 460,
  levels: propLevels,
  strategyName = 'NIFTY 0.09% Breakout',
  isSeparateScreen = false,
  onRefresh
}) => {
  const navigate = useNavigate();
  const [chartMode, setChartMode] = useState<'strategy' | 'original'>('strategy');
  const [liveTime, setLiveTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Lightweight chart refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Price lines references
  const upperLineRef = useRef<IPriceLine | null>(null);
  const lowerLineRef = useRef<IPriceLine | null>(null);
  const baseLineRef = useRef<IPriceLine | null>(null);
  const prevLevelsRef = useRef<{ spotBase?: number; upperLevel?: number; lowerLevel?: number }>({});

  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m'>('1m');
  const timeframeRef = useRef<'1m' | '5m' | '15m'>('1m');
  timeframeRef.current = timeframe;

  const [currentLtp, setCurrentLtp] = useState<number>(0);
  const [dayChange, setDayChange] = useState<number>(0);
  const [dayChangePct, setDayChangePct] = useState<number>(0);
  const [activeLevels, setActiveLevels] = useState<StrategyLevels>(propLevels || {});
  const activeLevelsRef = useRef<StrategyLevels>(propLevels || {});
  activeLevelsRef.current = activeLevels;

  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // Current building candle state for live streaming
  const currentCandleRef = useRef<{
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);

  // Live ticking IST clock (1-second update)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) + ' IST');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update strategy price lines on chart smoothly without tearing down canvas
  const applyPriceLines = useCallback((levels: StrategyLevels) => {
    const series = candleSeriesRef.current;
    if (!series) return;

    const prev = prevLevelsRef.current;
    const newUpper = levels.upperLevel && levels.upperLevel > 0 ? Number(levels.upperLevel.toFixed(2)) : undefined;
    const newLower = levels.lowerLevel && levels.lowerLevel > 0 ? Number(levels.lowerLevel.toFixed(2)) : undefined;
    const newBase = levels.spotBase && levels.spotBase > 0 ? Number(levels.spotBase.toFixed(2)) : undefined;

    // Check if levels actually changed
    const upperChanged = newUpper !== prev.upperLevel;
    const lowerChanged = newLower !== prev.lowerLevel;
    const baseChanged = newBase !== prev.spotBase;

    if (!upperChanged && !lowerChanged && !baseChanged) {
      return; // Zero changes -> do NOT touch price lines to avoid canvas flicker
    }

    prevLevelsRef.current = { upperLevel: newUpper, lowerLevel: newLower, spotBase: newBase };

    // Upper Line (+0.09% Buy Call)
    if (newUpper) {
      if (upperLineRef.current) {
        upperLineRef.current.applyOptions({
          price: newUpper,
          title: `BUY CALL (+0.09%): ₹${newUpper.toFixed(2)}`
        });
      } else {
        upperLineRef.current = series.createPriceLine({
          price: newUpper,
          color: '#16a34a',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `BUY CALL (+0.09%): ₹${newUpper.toFixed(2)}`
        });
      }
    } else if (upperLineRef.current) {
      try { series.removePriceLine(upperLineRef.current); } catch {}
      upperLineRef.current = null;
    }

    // Lower Line (-0.09% Buy Put)
    if (newLower) {
      if (lowerLineRef.current) {
        lowerLineRef.current.applyOptions({
          price: newLower,
          title: `BUY PUT (-0.09%): ₹${newLower.toFixed(2)}`
        });
      } else {
        lowerLineRef.current = series.createPriceLine({
          price: newLower,
          color: '#dc2626',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `BUY PUT (-0.09%): ₹${newLower.toFixed(2)}`
        });
      }
    } else if (lowerLineRef.current) {
      try { series.removePriceLine(lowerLineRef.current); } catch {}
      lowerLineRef.current = null;
    }

    // Base Line (Spot base price)
    if (newBase) {
      if (baseLineRef.current) {
        baseLineRef.current.applyOptions({
          price: newBase,
          title: `SPOT BASE: ₹${newBase.toFixed(2)}`
        });
      } else {
        baseLineRef.current = series.createPriceLine({
          price: newBase,
          color: '#4f46e5',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `SPOT BASE: ₹${newBase.toFixed(2)}`
        });
      }
    } else if (baseLineRef.current) {
      try { series.removePriceLine(baseLineRef.current); } catch {}
      baseLineRef.current = null;
    }
  }, []);

  // Update levels if external props change
  useEffect(() => {
    if (propLevels && (propLevels.spotBase || propLevels.upperLevel || propLevels.lowerLevel)) {
      setActiveLevels(prev => ({ ...prev, ...propLevels }));
      applyPriceLines(propLevels);
    }
  }, [propLevels, applyPriceLines]);

  // Load historical candles
  const loadCandles = useCallback(() => {
    axios.get(`${API_CONFIG.BASE_URL}/api/strategies/nifty009/candles`)
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.candles) && res.data.candles.length > 0) {
          const rawCandles = res.data.candles;
          const formatted = rawCandles.map((c: any) => ({
            time: Number(c.time) as UTCTimestamp,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close)
          })).sort((a: any, b: any) => a.time - b.time);

          if (candleSeriesRef.current) {
            candleSeriesRef.current.setData(formatted);
          }
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }

          const lastCandle = formatted[formatted.length - 1];
          if (lastCandle) {
            currentCandleRef.current = { ...lastCandle };
            setCurrentLtp(lastCandle.close);

            const firstCandle = formatted[0];
            const chg = lastCandle.close - firstCandle.open;
            setDayChange(chg);
            setDayChangePct((chg / firstCandle.open) * 100);
          }

          if (res.data.levels) {
            setActiveLevels(res.data.levels);
            applyPriceLines(res.data.levels);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load initial candles:', err);
      });
  }, [applyPriceLines]);

  // Initialize Lightweight Chart ONCE
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const chartHeight = typeof height === 'number' ? height : container.clientHeight || 460;

    const chart = createChart(container, {
      width,
      height: chartHeight,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#334155',
        fontSize: 11,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' }
      },
      crosshair: {
        vertLine: {
          color: '#94a3b8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b'
        },
        horzLine: {
          color: '#94a3b8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b'
        }
      },
      timeScale: {
        borderColor: '#cbd5e1',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 3,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
        }
      },
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        }
      },
      rightPriceScale: {
        borderColor: '#cbd5e1',
        scaleMargins: {
          top: 0.12,
          bottom: 0.12
        },
        autoScale: true
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
      }
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderVisible: true,
      borderUpColor: '#16a34a',
      borderDownColor: '#dc2626',
      wickVisible: true,
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626'
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    loadCandles();

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: newWidth, height: newHeight } = entries[0].contentRect;
      if (newWidth > 0 && chartRef.current) {
        chartRef.current.applyOptions({
          width: newWidth,
          ...(newHeight > 100 ? { height: newHeight } : {})
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [loadCandles, height]);

  // When switching modes or toggling fullscreen, adjust chart width
  useEffect(() => {
    if (chartMode === 'strategy' && chartRef.current && chartContainerRef.current) {
      setTimeout(() => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth
          });
          chartRef.current.timeScale().fitContent();
        }
      }, 50);
    }
  }, [chartMode, isFullscreen]);

  // Connect to Socket.IO for real-time sub-second ticks - NEVER reconnect on level updates
  useEffect(() => {
    const socket: Socket = io(API_CONFIG.BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    const handleTick = (tickData: any) => {
      const ltp = tickData.niftyLtp || tickData.ltp || tickData.price;
      if (!ltp || typeof ltp !== 'number') return;

      // Spike filter: ignore sudden massive tick spikes (>300 pts) from foreign instruments
      if (currentCandleRef.current && Math.abs(ltp - currentCandleRef.current.close) > 300) {
        return;
      }

      setCurrentLtp(ltp);

      const series = candleSeriesRef.current;
      if (series) {
        const nowSec = Math.floor(Date.now() / 1000);
        const tf = timeframeRef.current;
        const candleIntervalSec = tf === '1m' ? 60 : tf === '5m' ? 300 : 900;
        const currentCandleTime = (Math.floor(nowSec / candleIntervalSec) * candleIntervalSec) as UTCTimestamp;

        let candle = currentCandleRef.current;

        if (!candle || candle.time !== currentCandleTime) {
          const prevClose = candle ? candle.close : ltp;
          candle = {
            time: currentCandleTime,
            open: prevClose,
            high: Math.max(prevClose, ltp),
            low: Math.min(prevClose, ltp),
            close: ltp
          };
        } else {
          candle = {
            time: candle.time,
            open: candle.open,
            high: Math.max(candle.high, ltp),
            low: Math.min(candle.low, ltp),
            close: ltp
          };
        }

        currentCandleRef.current = candle;
        try {
          series.update(candle);
        } catch (e) {}
      }

      // Check if breakout levels have actually changed
      const current = activeLevelsRef.current;
      const newSpotBase = tickData.firstCandleClose || current.spotBase;
      const newUpper = tickData.upperLevel || current.upperLevel;
      const newLower = tickData.lowerLevel || current.lowerLevel;

      if (
        (newUpper && newUpper !== current.upperLevel) ||
        (newLower && newLower !== current.lowerLevel) ||
        (newSpotBase && newSpotBase !== current.spotBase)
      ) {
        const updatedLevels: StrategyLevels = {
          spotBase: newSpotBase,
          upperLevel: newUpper,
          lowerLevel: newLower,
          liveLtp: ltp
        };
        setActiveLevels(updatedLevels);
        applyPriceLines(updatedLevels);
      }
    };

    socket.on('strategy_tick', handleTick);
    socket.on('market_tick', (tick: any) => {
      if (tick.symbol === 'NIFTY' || tick.symbol === 'NIFTY 50' || !tick.symbol) {
        handleTick(tick);
      }
    });

    return () => {
      socket.off('strategy_tick', handleTick);
      socket.off('market_tick');
      socket.disconnect();
    };
  }, [applyPriceLines]); // Notice: NO dynamic state in dependencies! Connection is stable and never disconnects on ticks!

  const chartHeightPx = isFullscreen ? 'calc(100vh - 120px)' : (typeof height === 'number' ? `${height}px` : height);

  return (
    <Box
      sx={{
        bgcolor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: isFullscreen ? 0 : 2,
        overflow: 'hidden',
        boxShadow: 'none',
        ...(isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              height: '100vh',
              width: '100vw'
            }
          : { width: '100%' })
      }}
    >
      {/* Chart Top Header & Mode Switcher */}
      <Box
        sx={{
          px: { xs: 1.5, sm: 2.5 },
          py: 1.2,
          bgcolor: '#ffffff',
          borderBottom: '1px solid #cbd5e1',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5
        }}
      >
        {/* Left: Symbol & Live IST Clock */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, flexWrap: 'wrap' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.9rem', sm: '1rem' }, color: '#0f172a' }}>
                {symbol}
              </Typography>
              <StatusBadge
                status={socketConnected ? 'live' : 'paper'}
                label={socketConnected ? 'LIVE FEED' : 'CONNECTING'}
              />
            </Box>
            <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
              NSE • India • 250ms Real-Time Stream
            </Typography>
          </Box>

          {/* Live Price Display */}
          {currentLtp > 0 && (
            <Box sx={{ borderLeft: '1px solid #e2e8f0', pl: { xs: 1, sm: 2 } }}>
              <Typography sx={{ fontSize: { xs: '0.95rem', sm: '1.05rem' }, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                ₹{currentLtp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              {dayChange !== 0 && (
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: dayChange >= 0 ? '#16a34a' : '#dc2626'
                  }}
                >
                  {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)} ({dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%)
                </Typography>
              )}
            </Box>
          )}

          {/* Live IST Real Time Clock */}
          <Box sx={{ borderLeft: '1px solid #e2e8f0', pl: { xs: 1, sm: 2 }, display: { xs: 'none', md: 'block' } }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              MARKET TIME (LIVE)
            </Typography>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>
              {liveTime || '12:00:00 PM IST'}
            </Typography>
          </Box>
        </Box>

        {/* Center / Right: View Toggle, Timeframes & Screen Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Mode Switcher */}
          <ButtonGroup size="small" sx={{ boxShadow: 'none' }}>
            <Button
              onClick={() => setChartMode('strategy')}
              variant={chartMode === 'strategy' ? 'contained' : 'outlined'}
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                py: 0.4,
                px: { xs: 1, sm: 1.4 },
                boxShadow: 'none',
                bgcolor: chartMode === 'strategy' ? '#1e293b' : '#ffffff',
                color: chartMode === 'strategy' ? '#ffffff' : '#334155',
                borderColor: '#cbd5e1',
                textTransform: 'none',
                '&:hover': {
                  bgcolor: chartMode === 'strategy' ? '#0f172a' : '#f1f5f9',
                  borderColor: '#94a3b8',
                  boxShadow: 'none'
                }
              }}
            >
              Strategy Trigger View
            </Button>
            <Button
              onClick={() => setChartMode('original')}
              variant={chartMode === 'original' ? 'contained' : 'outlined'}
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                py: 0.4,
                px: { xs: 1, sm: 1.4 },
                boxShadow: 'none',
                bgcolor: chartMode === 'original' ? '#1e293b' : '#ffffff',
                color: chartMode === 'original' ? '#ffffff' : '#334155',
                borderColor: '#cbd5e1',
                textTransform: 'none',
                '&:hover': {
                  bgcolor: chartMode === 'original' ? '#0f172a' : '#f1f5f9',
                  borderColor: '#94a3b8',
                  boxShadow: 'none'
                }
              }}
            >
              TradingView Advanced
            </Button>
          </ButtonGroup>

          {/* Timeframe pill selector for strategy mode */}
          {chartMode === 'strategy' && (
            <ButtonGroup size="small" sx={{ boxShadow: 'none' }}>
              {(['1m', '5m', '15m'] as const).map((tf) => (
                <Button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  variant={timeframe === tf ? 'contained' : 'outlined'}
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    py: 0.4,
                    px: 0.9,
                    boxShadow: 'none',
                    bgcolor: timeframe === tf ? '#2563eb' : 'transparent',
                    color: timeframe === tf ? '#ffffff' : '#475569',
                    borderColor: '#cbd5e1',
                    minWidth: 36,
                    '&:hover': {
                      bgcolor: timeframe === tf ? '#1d4ed8' : '#f1f5f9',
                      borderColor: '#94a3b8',
                      boxShadow: 'none'
                    }
                  }}
                >
                  {tf.toUpperCase()}
                </Button>
              ))}
            </ButtonGroup>
          )}

          {/* Refresh action */}
          <Tooltip title="Refresh Chart Candles">
            <IconButton
              size="small"
              onClick={() => {
                loadCandles();
                if (onRefresh) onRefresh();
              }}
              sx={{ color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 1.5, p: 0.6 }}
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          {/* Open in Separate Screen button (if not already on the separate screen) */}
          {!isSeparateScreen && (
            <Tooltip title="Open in Dedicated Full Chart Screen">
              <Button
                variant="outlined"
                size="small"
                startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                onClick={() => navigate('/chart')}
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  py: 0.4,
                  px: 1.2,
                  color: '#2563eb',
                  borderColor: '#93c5fd',
                  bgcolor: '#eff6ff',
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: '#dbeafe',
                    borderColor: '#60a5fa'
                  }
                }}
              >
                Separate Screen
              </Button>
            </Tooltip>
          )}

          {/* Fullscreen Toggle */}
          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <IconButton
              size="small"
              onClick={() => setIsFullscreen(prev => !prev)}
              sx={{ color: '#475569', border: '1px solid #cbd5e1', borderRadius: 1.5, p: 0.6 }}
            >
              {isFullscreen ? <FullscreenExitIcon sx={{ fontSize: 18 }} /> : <FullscreenIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Chart Viewport Containers - BOTH kept in DOM to prevent tearing down or reloading */}
      <Box sx={{ width: '100%', height: chartHeightPx, position: 'relative' }}>
        {/* Original TradingView Advanced Chart */}
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: chartMode === 'original' ? 'block' : 'none'
          }}
        >
          <OriginalTradingViewWidget
            symbol={symbol}
            height="100%"
            theme="light"
            autosize
          />
        </Box>

        {/* Lightweight Charts Strategy Canvas */}
        <Box
          ref={chartContainerRef}
          sx={{
            width: '100%',
            height: '100%',
            display: chartMode === 'strategy' ? 'block' : 'none'
          }}
        />
      </Box>

      {/* Chart Footer Info Bar */}
      <Box
        sx={{
          px: { xs: 1.5, sm: 2.5 },
          py: 0.8,
          bgcolor: '#f8fafc',
          borderTop: '1px solid #cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1
        }}
      >
        <Typography sx={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
          {chartMode === 'original'
            ? 'Official TradingView Advanced Charting Engine • Real-Time NSE Market Feed • Technical Indicators Active'
            : `Strategy Execution Overlay • 250ms Live Feed • Strategy: ${strategyName}`}
        </Typography>

        {chartMode === 'strategy' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
            {activeLevels.upperLevel ? (
              <Typography sx={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 700 }}>
                SPOT BUY CALL (+0.09%): ₹{activeLevels.upperLevel.toFixed(2)}
              </Typography>
            ) : null}
            {activeLevels.spotBase ? (
              <Typography sx={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 700 }}>
                SPOT BASE: ₹{activeLevels.spotBase.toFixed(2)}
              </Typography>
            ) : null}
            {activeLevels.lowerLevel ? (
              <Typography sx={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 700 }}>
                SPOT BUY PUT (-0.09%): ₹{activeLevels.lowerLevel.toFixed(2)}
              </Typography>
            ) : null}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default TradingViewLiveChart;
