import React, { useEffect, useRef, memo } from 'react';
import { Box } from '@mui/material';

interface OriginalTradingViewWidgetProps {
  symbol?: string;
  height?: number | string;
  theme?: 'light' | 'dark';
  autosize?: boolean;
}

export const OriginalTradingViewWidget: React.FC<OriginalTradingViewWidgetProps> = memo(({
  symbol = 'NSE:NIFTY',
  height = 460,
  theme = 'light',
  autosize = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSymbolRef = useRef<string>('');
  const lastThemeRef = useRef<string>('');

  // Map symbols to TradingView valid symbols
  let tvSymbol = 'TVC:NIFTY';
  const cleanSymbol = symbol.trim().toUpperCase();
  if (symbol.includes(':')) {
    tvSymbol = symbol;
  } else if (cleanSymbol === 'NIFTY' || cleanSymbol === 'NIFTY 50' || cleanSymbol === 'NIFTY50') {
    tvSymbol = 'TVC:NIFTY';
  } else if (cleanSymbol.includes('BANK')) {
    tvSymbol = 'NSE:BANKNIFTY';
  } else if (cleanSymbol.includes('FINNIFTY')) {
    tvSymbol = 'NSE:FINNIFTY';
  } else if (cleanSymbol.includes('SENSEX')) {
    tvSymbol = 'BSE:SENSEX';
  } else if (cleanSymbol.includes('MIDCP')) {
    tvSymbol = 'NSE:MIDCPNIFTY';
  } else {
    tvSymbol = `NSE:${cleanSymbol.replace(/\s+/g, '')}`;
  }

  useEffect(() => {
    if (!containerRef.current) return;

    // Prevent re-injecting script if symbol and theme did not change (avoids flickering)
    if (lastSymbolRef.current === tvSymbol && lastThemeRef.current === theme && containerRef.current.children.length > 0) {
      return;
    }

    lastSymbolRef.current = tvSymbol;
    lastThemeRef.current = theme;

    // Clear existing container cleanly
    containerRef.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = autosize ? '100%' : (typeof height === 'number' ? `${height}px` : height);
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;

    script.innerHTML = JSON.stringify({
      autosize: autosize,
      width: '100%',
      height: autosize ? '100%' : height,
      symbol: tvSymbol,
      interval: '1',
      timezone: 'Asia/Kolkata',
      theme: theme,
      style: '1',
      locale: 'in',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      studies: [
        'STD;Supertrend',
        'STD;VWAP'
      ],
      show_popup_button: false,
      popup_width: '1000',
      popup_height: '650'
    });

    containerRef.current.appendChild(script);

    return () => {
      // Don't wipe out immediately on fast prop changes unless unmounting
    };
  }, [tvSymbol, theme, autosize, height]);

  return (
    <Box
      sx={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        bgcolor: '#ffffff',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <div
        className="tradingview-widget-container"
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </Box>
  );
});

export default OriginalTradingViewWidget;
