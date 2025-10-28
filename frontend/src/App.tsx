import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Brokers from './pages/Brokers';
import DhanCallback from './pages/DhanCallback';
import Strategies from './pages/Strategies';
import Portfolio from './pages/Portfolio';
import Reports from './pages/Reports';
import TradingDashboard from './pages/TradingDashboard';

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
          <Route path="/trading-dashboard" element={<TradingDashboard />} />
          <Route path="/brokers" element={<Brokers />} />
          <Route path="/strategies" element={<Strategies />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/dhan-callback" element={<DhanCallback />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
