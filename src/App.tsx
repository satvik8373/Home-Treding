import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from './theme';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Brokers from './pages/Brokers';
import DhanCallback from './pages/DhanCallback';
import Strategies from './pages/Strategies';
import CreateStrategy from './pages/CreateStrategy';
import StrategyTemplate from './pages/StrategyTemplate';
import Portfolio from './pages/Portfolio';
import Reports from './pages/Reports';
import TradingDashboard from './pages/TradingDashboard';
import TestLiveTrading from './pages/TestLiveTrading';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        position: 'relative'
      }}>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/trading-dashboard" element={<TradingDashboard />} />
            <Route path="/brokers" element={<Brokers />} />
            <Route path="/strategies" element={<Strategies />} />
            <Route path="/strategies/create" element={<CreateStrategy />} />
            <Route path="/strategies/edit/:id" element={<CreateStrategy />} />
            <Route path="/strategies/templates" element={<StrategyTemplate />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/dhan-callback" element={<DhanCallback />} />
            <Route path="/test-live-trading" element={<TestLiveTrading />} />
          </Routes>
        </Router>
      </Box>
    </ThemeProvider>
  );
}

export default App;
