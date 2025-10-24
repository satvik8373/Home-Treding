import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MarketDataPage from './pages/MarketDataPage';
import BrokerageLink from './pages/BrokerageLink';
import OAuthCallback from './pages/OAuthCallback';
import DhanConnect from './pages/DhanConnect';
import Strategies from './pages/Strategies';
import StrategyTest from './pages/StrategyTest';
import Portfolio from './pages/Portfolio';
import Backtest from './pages/Backtest';
import Reports from './pages/Reports';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/market-data" element={<MarketDataPage />} />
          <Route path="/brokerage" element={<BrokerageLink />} />
          <Route path="/dhan-connect" element={<DhanConnect />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/strategies" element={<Strategies />} />
          <Route path="/strategy-test" element={<StrategyTest />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/backtest" element={<Backtest />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
