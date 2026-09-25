import React, { useState, useEffect, useRef } from 'react';
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
  GridViewOutlined as DashboardIcon,
  ShowChartOutlined,
  TimelineOutlined,
  LayersOutlined,
  FactCheckOutlined,
  DescriptionOutlined,
  LocalOfferOutlined,
  ChevronLeft,
  ChevronRight,
  AccountBalanceWalletOutlined,
  DarkModeOutlined,
  NotificationsNoneOutlined,
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  ArrowDropUp,
  ArrowDropDown,
  Link as LinkIcon,
  Assessment,
  PieChartOutlined,
  TrendingUp
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../config/firebase';
import authService from '../services/authService';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

// ─── Live Indices Sidebar (WebSocket primary, REST poll fallback) ────────────

const defaultIndices = [
  { symbol: 'NIFTY 50', ltp: 24535.80, change: 76.50, changePercent: 0.32 },
  { symbol: 'BANKNIFTY', ltp: 52140.25, change: 254.20, changePercent: 0.45 },
  { symbol: 'FINNIFTY', ltp: 23410.60, change: 72.80, changePercent: 0.28 },
  { symbol: 'RELIANCE', ltp: 2985.50, change: 16.90, changePercent: 0.54 },
  { symbol: 'TCS', ltp: 4120.00, change: -14.30, changePercent: -0.18 }
];

const LiveIndicesSidebar: React.FC = () => {
  const [indices, setIndices] = useState(defaultIndices);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const applyFeed = (rawList: any[]) => {
      if (!isMounted || !rawList?.length) return;
      const map = new Map<string, any>();
      rawList.forEach((d: any) => {
        [d.symbol, d.name].filter(Boolean).forEach((k: string) => map.set(k, d));
        if (d.symbol === 'NIFTY') map.set('NIFTY 50', d);
        if (d.symbol === 'NIFTY 50') map.set('NIFTY', d);
      });
      setIndices(prev => prev.map(item => {
        const found = map.get(item.symbol);
        if (!found) return item;
        return {
          ...item,
          ltp: Number(found.price || found.ltp) || item.ltp,
          change: Number(found.change) || item.change,
          changePercent: Number(found.changePercent) || item.changePercent
        };
      }));
    };

    const fetchRest = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      axios.get(`${API_CONFIG.BASE_URL}/api/market/all`)
        .then(res => { if (res.data?.success) applyFeed(res.data.data || []); })
        .catch(() => {});
    };

    fetchRest();
    pollInterval = setInterval(fetchRest, 10000);

    // WebSocket real-time updates
    if (API_CONFIG.ENABLE_WEBSOCKETS) {
      try {
        const sock = io(API_CONFIG.WS_URL, { transports: ['websocket'], timeout: 5000, reconnectionAttempts: 3 });
        socketRef.current = sock;
        sock.on('connect', () => sock.emit('subscribe_market_data', defaultIndices.map(i => i.symbol)));
        sock.on('market_data', (data: any) => {
          if (data && Array.isArray(data)) applyFeed(data);
          else if (data && data.symbol) applyFeed([data]);
        });
      } catch { /* graceful fallback */ }
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, []);

  return (
    <Box sx={{ borderTop: '1px solid #e2e8f0', pt: 1.5 }}>
      <Typography sx={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', mb: 1, px: 0.5 }}>
        Market Indices
      </Typography>
      {indices.map((item) => {
        const isPos = item.change >= 0;
        return (
          <Box
            key={item.symbol}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 0.55,
              px: 0.5,
              borderRadius: 1,
              '&:hover': { bgcolor: '#f8fafc' }
            }}
          >
            <Typography sx={{ fontWeight: 600, color: '#475569', fontSize: '0.71rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.symbol}
            </Typography>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography sx={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.69rem', lineHeight: 1.1 }}>
                {item.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {isPos
                  ? <ArrowDropUp sx={{ fontSize: 12, color: '#16a34a', mr: -0.3 }} />
                  : <ArrowDropDown sx={{ fontSize: 12, color: '#dc2626', mr: -0.3 }} />
                }
                <Typography sx={{ fontSize: '0.61rem', color: isPos ? '#16a34a' : '#dc2626', fontFamily: 'monospace', fontWeight: 600 }}>
                  {isPos ? '+' : ''}{item.changePercent.toFixed(2)}%
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// ─── Layout ──────────────────────────────────────────────────────────────────

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 240;

// Sidebar navigation options matching user requirements
const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Broker', icon: <ShowChartOutlined />, path: '/brokers' },
  { text: 'Live Chart', icon: <TimelineOutlined />, path: '/chart' },
  { text: 'Live Market Data', icon: <TrendingUp />, path: '/trading-dashboard' },
  { text: 'Strategies', icon: <LayersOutlined />, path: '/strategies' },
  { text: 'Portfolio', icon: <PieChartOutlined />, path: '/portfolio' },
  { text: 'Backtesting', icon: <FactCheckOutlined />, path: '/backtest', hasChevron: true },
  { text: 'Reports', icon: <DescriptionOutlined />, path: '/reports' }
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const user = auth.currentUser;

  const handleDrawerToggle = () => setMobileOpen(prev => !prev);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch { /* handled */ }
  };

  const drawer = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      overflowX: 'hidden',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      '&::-webkit-scrollbar': { display: 'none' }
    }}>
      {/* Mavrix Branding Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, px: 2, borderBottom: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            component="img"
            src="/mavrix-icon.jpg"
            alt="Mavrix Trading"
            sx={{ width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, objectFit: 'cover' }}
          />
          <Box>
            <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem', lineHeight: 1.1 }}>
              Mavrix
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Trading Platform
            </Typography>
          </Box>
        </Box>
        {isMobile && (
          <Box
            onClick={handleDrawerToggle}
            sx={{
              width: 26, height: 26, borderRadius: '50%',
              border: '1px solid #e2e8f0', bgcolor: '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b', cursor: 'pointer',
              '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' }
            }}
          >
            <CloseIcon sx={{ fontSize: 13 }} />
          </Box>
        )}
      </Box>

      {/* Nav Links */}
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isActive}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: '9px',
                  py: 0.9,
                  px: 1.5,
                  bgcolor: isActive ? '#2563eb !important' : 'transparent',
                  '&:hover': {
                    bgcolor: isActive ? '#1d4ed8 !important' : '#1e293b'
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 32,
                    '& svg': { fontSize: 18, color: isActive ? '#ffffff' : '#64748b' }
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    sx: {
                      fontSize: '0.84rem',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#ffffff' : '#334155',
                      whiteSpace: 'nowrap'
                    }
                  }}
                />
                {item.hasChevron && (
                  <ChevronRight sx={{ fontSize: 15, color: isActive ? '#ffffff' : '#475569' }} />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Dark Market Indices at Bottom */}
      <Box sx={{ px: 1.5, pb: 2, display: { xs: 'none', md: 'block' } }}>
        <LiveIndicesSidebar />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#eef2f7' }}>
      {/* Top AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: '#ffffff',
          color: '#0f172a',
          borderBottom: '1px solid #e2e8f0',
          zIndex: 1100,
          boxShadow: 'none'
        }}
      >
        <Toolbar sx={{ height: 60, minHeight: '60px !important', px: { xs: 1.5, sm: 3 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left: hamburger + Page Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {isMobile && (
              <IconButton
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ color: '#64748b', p: 0.5, mr: 0.5 }}
              >
                <MenuIcon sx={{ fontSize: 20 }} />
              </IconButton>
            )}
            <Typography
              noWrap
              sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', letterSpacing: '-0.01em' }}
            >
              {menuItems.find(i => i.path === location.pathname)?.text || 'Dashboard'}
            </Typography>
          </Box>

          {/* Right: Wallet, Dark Mode, Notifications, User Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.8, sm: 1.5 }, flexShrink: 0 }}>
            <IconButton size="small" sx={{ color: '#64748b', '&:hover': { bgcolor: '#f8fafc' } }}>
              <AccountBalanceWalletOutlined sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton size="small" sx={{ color: '#64748b', '&:hover': { bgcolor: '#f8fafc' } }}>
              <DarkModeOutlined sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton size="small" sx={{ color: '#64748b', '&:hover': { bgcolor: '#f8fafc' } }}>
              <NotificationsNoneOutlined sx={{ fontSize: 20 }} />
            </IconButton>

            {/* User avatar */}
            <Box
              onClick={handleMenuOpen}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
                p: 0.5, borderRadius: 1.5, '&:hover': { bgcolor: '#f8fafc' }
              }}
            >
              <Avatar sx={{ width: 30, height: 30, bgcolor: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '0.78rem' }}>
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'S'}
              </Avatar>
            </Box>
          </Box>

          {/* User Menu */}
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
                  minWidth: 190,
                  borderRadius: 2.5,
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.06)',
                  border: '1px solid #e2e8f0',
                  p: 0.5
                }
              }
            }}
          >
            <Box sx={{ px: 2, py: 1.2 }}>
              <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                {user?.displayName || 'Active Trader'}
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                {user?.email || 'dhan.trader@mavrix.com'}
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, borderColor: '#f1f5f9' }} />
            <MenuItem onClick={() => { handleMenuClose(); navigate('/brokers'); }} sx={{ py: 0.9, px: 2, borderRadius: 1.5, fontSize: '0.8rem', fontWeight: 600, gap: 1 }}>
              <LinkIcon sx={{ fontSize: 16, color: '#64748b' }} />
              Dhan Broker
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); navigate('/reports'); }} sx={{ py: 0.9, px: 2, borderRadius: 1.5, fontSize: '0.8rem', fontWeight: 600, gap: 1 }}>
              <Assessment sx={{ fontSize: 16, color: '#64748b' }} />
              Reports
            </MenuItem>
            <Divider sx={{ my: 0.5, borderColor: '#f1f5f9' }} />
            <MenuItem onClick={() => { handleMenuClose(); handleLogout(); }} sx={{ py: 0.9, px: 2, borderRadius: 1.5, color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, gap: 1 }}>
              <LogoutIcon sx={{ fontSize: 16, color: '#dc2626' }} />
              Log Out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Desktop Persistent Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #e2e8f0',
            boxShadow: 'none',
            bgcolor: '#ffffff',
            overflowX: 'hidden',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' }
          }
        }}
      >
        {drawer}
      </Drawer>

      {/* Mobile Temporary Drawer */}
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
            bgcolor: '#ffffff',
            borderRight: '1px solid #e2e8f0',
            overflowX: 'hidden',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' }
          }
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
          bgcolor: '#dde3ec',
          minHeight: '100vh',
          pt: { xs: '72px', md: '76px' },
          pb: { xs: '72px', md: 4 },
          px: { xs: 1.5, sm: 2.5, md: 3 },
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >

        <Container maxWidth="xl" disableGutters sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {children}
        </Container>
      </Box>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Box
          sx={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            zIndex: 1200, bgcolor: '#ffffff',
            borderTop: '1px solid #f1f5f9',
            boxShadow: '0 -1px 4px rgba(0,0,0,0.06)',
            pb: 'env(safe-area-inset-bottom)'
          }}
        >
          <BottomNavigation
            value={location.pathname}
            onChange={(_, newValue) => navigate(newValue)}
            showLabels
            sx={{
              height: 52,
              bgcolor: 'transparent',
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                padding: '2px 4px',
                color: '#64748b',
                '&.Mui-selected': { color: '#2563eb', fontWeight: 700 }
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.62rem',
                fontWeight: 600
              }
            }}
          >
            {menuItems.slice(0, 5).map(item => (
              <BottomNavigationAction
                key={item.text}
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
