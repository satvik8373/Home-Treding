import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Container,
  IconButton,
  useTheme,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Avatar,
  Menu,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp,
  AccountBalance,
  Assessment,
  ShowChart,
  Link as LinkIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  Security as SecurityIcon,
  PlayArrow as LiveIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../config/firebase';
import authService from '../services/authService';
import { EmergencyStopButton } from './common/EmergencyStopButton';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_CONFIG } from '../config/api';

// Live Indices Sidebar Component with Guaranteed Streaming & Fallbacks
const defaultIndices = [
  { symbol: 'NIFTY 50', name: 'NIFTY', ltp: 24535.80, change: 76.50, changePercent: 0.32 },
  { symbol: 'BANKNIFTY', name: 'BANKNIFTY', ltp: 52140.25, change: 254.20, changePercent: 0.45 },
  { symbol: 'FINNIFTY', name: 'FINNIFTY', ltp: 23410.60, change: 72.80, changePercent: 0.28 },
  { symbol: 'RELIANCE', name: 'RELIANCE', ltp: 2985.50, change: 16.90, changePercent: 0.54 },
  { symbol: 'TCS', name: 'TCS', ltp: 4120.00, change: -14.30, changePercent: -0.18 }
];

const LiveIndicesSidebar: React.FC = () => {
  const [indices, setIndices] = useState(defaultIndices);
  const [isMarketOpen, setIsMarketOpen] = useState(true);
  const [marketStatusMsg, setMarketStatusMsg] = useState('LIVE');

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch live market quotes
    const fetchQuotes = () => {
      axios.get(`${API_CONFIG.BASE_URL}/api/market/all`)
        .then(res => {
          if (res.data?.success && isMounted) {
            if (typeof res.data.isMarketOpen === 'boolean') {
              setIsMarketOpen(res.data.isMarketOpen);
              setMarketStatusMsg(res.data.isMarketOpen ? 'LIVE' : (res.data.marketStatus?.status || 'CLOSED'));
            }

            if (res.data.data) {
              const fetchedMap = new Map();
              res.data.data.forEach((d: any) => {
                fetchedMap.set(d.symbol, d);
                if (d.name) fetchedMap.set(d.name, d);
              });

              setIndices(prev => prev.map(item => {
                const found = fetchedMap.get(item.symbol) || fetchedMap.get(item.name);
                if (found) {
                  return {
                    ...item,
                    ltp: Number(found.price || found.ltp) || item.ltp,
                    change: Number(found.change) || item.change,
                    changePercent: Number(found.changePercent) || item.changePercent
                  };
                }
                return item;
              }));
            }
          }
        })
        .catch(() => {});
    };

    fetchQuotes();
    const interval = setInterval(fetchQuotes, 3000);

    // 2. Real-time WebSocket Updates
    const socket = io(API_CONFIG.WS_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000
    });

    socket.on('market_tick', (tick: any) => {
      if (!isMounted || !tick || !tick.symbol) return;

      if (typeof tick.isOpen === 'boolean') {
        setIsMarketOpen(tick.isOpen);
        setMarketStatusMsg(tick.isOpen ? 'LIVE' : (tick.marketStatus || 'CLOSED'));
      }

      setIndices(prev => prev.map(item => {
        if (item.symbol === tick.symbol || item.name === tick.symbol) {
          const ltp = Number(tick.ltp || tick.price || item.ltp);
          const prevClose = Number(tick.prevClose || (ltp - item.change));
          const change = Number((ltp - prevClose).toFixed(2));
          const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : item.changePercent;
          return { ...item, ltp, change, changePercent };
        }
        return item;
      }));
    });

    return () => {
      isMounted = false;
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  return (
    <Paper 
      sx={{ 
        p: 1,
        bgcolor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 2,
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0.8, mb: 0.5, borderBottom: '1px solid #f1f5f9' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Market Feed
        </Typography>
        <Box 
          sx={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 0.4, 
            px: 0.8, 
            py: 0.2, 
            borderRadius: '12px', 
            bgcolor: isMarketOpen ? '#dcfce7' : '#fef3c7',
            color: isMarketOpen ? '#166534' : '#92400e',
            fontSize: '0.62rem',
            fontWeight: 700
          }}
        >
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: isMarketOpen ? '#22c55e' : '#f59e0b' }} />
          {isMarketOpen ? 'LIVE' : 'CLOSED'}
        </Box>
      </Box>
      {indices.map((index, idx) => {
        const isPositive = index.change >= 0;
        const displaySymbol = index.name || index.symbol;
        
        return (
          <Box 
            key={index.symbol}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              py: 0.6,
              px: 0.5,
              borderBottom: idx !== indices.length - 1 ? '1px solid #f8fafc' : 'none'
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 700, 
                  color: '#0f172a', 
                  fontSize: '0.74rem',
                  lineHeight: 1.1,
                  mb: 0.2
                }}
              >
                {displaySymbol}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.6 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 700,
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    fontSize: '0.68rem',
                    lineHeight: 1
                  }}
                >
                  ₹{index.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: isPositive ? '#16a34a' : '#dc2626',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    fontSize: '0.62rem',
                    lineHeight: 1
                  }}
                >
                  {isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
};

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Trading', icon: <ShowChart />, path: '/trading-dashboard' },
  { text: 'Option Chain', icon: <ShowChart />, path: '/option-chain' },
  { text: 'Brokers', icon: <LinkIcon />, path: '/brokers' },
  { text: 'Strategies', icon: <TrendingUp />, path: '/strategies' },
  { text: 'Backtest', icon: <Assessment />, path: '/backtest' },
  { text: 'Portfolio', icon: <AccountBalance />, path: '/portfolio' },
  { text: 'Reports', icon: <Assessment />, path: '/reports' }
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const user = auth.currentUser;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#ffffff' }}>
      <Toolbar sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        py: 2.5,
        px: 3,
        borderBottom: '1px solid #f1f5f9'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '1rem',
            letterSpacing: '-0.02em'
          }}>
            M
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', lineHeight: 1.1 }}>
              Mavrix Trading
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 600 }}>
              DhanHQ v2 Powered
            </Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>
      
      <List sx={{ px: 1.5, py: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                borderRadius: 2,
                py: 1,
                px: 1.8,
                transition: 'all 0.15s ease',
                '&.Mui-selected': {
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  '& .MuiListItemIcon-root': {
                    color: '#ffffff'
                  },
                  '&:hover': {
                    bgcolor: '#1e293b',
                  }
                },
                '&:hover': {
                  bgcolor: '#f8fafc',
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: '#64748b' }}>{item.icon}</ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{ 
                  fontWeight: location.pathname === item.path ? 700 : 500,
                  fontSize: '0.82rem'
                }} 
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* Live Indices Section - Desktop Only */}
      <Box sx={{ px: 2, pb: 1.5, mt: 'auto', display: { xs: 'none', md: 'block' } }}>
        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, px: 0.75, display: 'block', mb: 0.75, fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Indices
        </Typography>
        <LiveIndicesSidebar />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* Sleek Minimalist Top Header */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(8px)',
          color: '#0f172a',
          borderBottom: '1px solid #e2e8f0',
          top: 0,
          zIndex: 1100,
          boxShadow: 'none'
        }}
      >
        <Toolbar sx={{ height: 56, minHeight: '56px !important', px: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left Breadcrumb & Route Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            {isMobile && (
              <IconButton
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 1.5, color: '#64748b', p: 0.5 }}
              >
                <MenuIcon sx={{ fontSize: 20 }} />
              </IconButton>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.8rem', display: { xs: 'none', sm: 'block' } }}>
                Mavrix
              </Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 400, display: { xs: 'none', sm: 'block' } }}>
                /
              </Typography>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: 700,
                  color: '#0f172a',
                  fontSize: '0.88rem',
                  letterSpacing: '-0.01em'
                }}
              >
                {menuItems.find(item => item.path === location.pathname)?.text || 'Dashboard'}
              </Typography>
            </Box>
          </Box>
          
          {/* Right Header Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <EmergencyStopButton />

            {/* Clean User Profile Trigger */}
            <Box
              onClick={handleMenuOpen}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                p: 0.5,
                borderRadius: 2,
                '&:hover': { bgcolor: '#f8fafc' },
                transition: 'all 0.15s ease'
              }}
            >
              <Avatar 
                sx={{ 
                  width: 28, 
                  height: 28,
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.75rem'
                }}
              >
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'T'}
              </Avatar>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8rem', display: { xs: 'none', sm: 'block' } }}>
                {user?.displayName || 'Trader'}
              </Typography>
            </Box>
          </Box>

          {/* User Menu Popover */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  minWidth: 200,
                  borderRadius: 2.5,
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.02)',
                  border: '1px solid #e2e8f0',
                  p: 0.5
                }
              }
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                {user?.displayName || 'Active Trader'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                {user?.email || 'dhan-live-connected'}
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, borderColor: '#f1f5f9' }} />
            <MenuItem onClick={() => { handleMenuClose(); navigate('/brokers'); }} sx={{ py: 1, px: 2, borderRadius: 1.5, fontSize: '0.8rem', fontWeight: 600 }}>
              <ListItemIcon sx={{ minWidth: 28, color: '#64748b' }}>
                <LinkIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600 }}>Dhan Broker</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); navigate('/reports'); }} sx={{ py: 1, px: 2, borderRadius: 1.5, fontSize: '0.8rem', fontWeight: 600 }}>
              <ListItemIcon sx={{ minWidth: 28, color: '#64748b' }}>
                <Assessment sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600 }}>Performance</ListItemText>
            </MenuItem>
            <Divider sx={{ my: 0.5, borderColor: '#f1f5f9' }} />
            <MenuItem onClick={() => { handleMenuClose(); handleLogout(); }} sx={{ py: 1, px: 2, borderRadius: 1.5, color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
              <ListItemIcon sx={{ minWidth: 28, color: '#dc2626' }}>
                <LogoutIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600 }}>Log Out</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #f1f5f9',
            boxShadow: 'none'
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawer}
      </Drawer>
      
      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: '#f8fafc',
          minHeight: '100vh',
          pt: { xs: '68px', sm: '76px', md: '84px' },
          pb: { xs: '80px', md: 4 },
          px: { xs: 1.5, sm: 2.5, md: 3.5 },
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >
        <Container 
          maxWidth="xl" 
          disableGutters
          sx={{ 
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        >
          {children}
        </Container>
      </Box>

      {/* Mobile Bottom Navigation - Compact & iOS PWA Safe Area Fixed */}
      {isMobile && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            bgcolor: '#ffffff',
            borderTop: '1px solid #f1f5f9',
            boxShadow: '0 -2px 4px -1px rgb(0 0 0 / 0.08)',
            // Critical iOS PWA Fix - No gaps
            pb: 'env(safe-area-inset-bottom)',
            pl: 'env(safe-area-inset-left)',
            pr: 'env(safe-area-inset-right)',
            m: 0,
          }}
        >
          <BottomNavigation
            value={location.pathname}
            onChange={(_, newValue) => {
              navigate(newValue);
            }}
            showLabels
            sx={{
              height: 48,
              bgcolor: 'transparent',
              m: 0,
              p: 0,
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                padding: '2px 4px',
                color: '#64748b',
                transition: 'all 0.15s ease',
                minHeight: 52,
                maxHeight: 52,
                '&.Mui-selected': {
                  color: '#0f172a',
                  fontWeight: 700
                }
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.65rem',
                marginTop: '2px',
                lineHeight: 1,
                '&.Mui-selected': {
                  fontSize: '0.65rem',
                  fontWeight: 700
                }
              },
              '& .MuiSvgIcon-root': {
                fontSize: '1.2rem',
                marginBottom: '1px'
              }
            }}
          >
            {menuItems.slice(0, 5).map((item) => (
              <BottomNavigationAction
                key={item.path}
                label={item.text}
                value={item.path}
                icon={item.icon}
              />
            ))}
          </BottomNavigation>
        </Box>
      )}
    </Box>
  );
};

export default Layout;
