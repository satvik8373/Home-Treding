import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MarketDataPage from './pages/MarketDataPage';
import Brokers from './pages/Brokers';
import TestPage from './pages/TestPage';
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
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/market-data" element={<MarketDataPage />} />
          <Route path="/brokers" element={<Brokers />} />
          <Route path="/brokerage" element={<Brokers />} />
          <Route path="/test" element={<TestPage />} />
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
