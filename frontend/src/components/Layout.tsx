import React, { useState } from 'react';
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
  Divider,
  Badge,
  Tooltip
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
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../config/firebase';
import authService from '../services/authService';

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Trading', icon: <ShowChart />, path: '/trading-dashboard' },
  { text: 'Brokers', icon: <LinkIcon />, path: '/brokers' },
  { text: 'Strategies', icon: <TrendingUp />, path: '/strategies' },
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
            width: 40,
            height: 40,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '1.25rem'
          }}>
            A
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.25rem' }}>
            AlgoRooms
          </Typography>
        </Box>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>
      
      <List sx={{ px: 2, py: 3, flex: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                borderRadius: 2.5,
                py: 1.5,
                px: 2,
                transition: 'all 0.2s',
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  '& .MuiListItemIcon-root': {
                    color: 'white'
                  },
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  }
                },
                '&:hover': {
                  bgcolor: '#f8fafc',
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: '#64748b' }}>{item.icon}</ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{ 
                  fontWeight: location.pathname === item.path ? 600 : 500,
                  fontSize: '0.9375rem'
                }} 
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ p: 2, borderTop: '1px solid #f1f5f9' }}>
        <Paper 
          sx={{ 
            p: 2, 
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: 2
          }}
        >
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>
            Need Help?
          </Typography>
          <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.8125rem' }}>
            Check our documentation
          </Typography>
        </Paper>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: '#ffffff',
          color: '#0f172a',
          borderBottom: '1px solid #f1f5f9',
          top: 0,
          pt: 'env(safe-area-inset-top)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1.5, sm: 3 } }}>
          {isMobile && (
            <IconButton
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1.5, color: '#64748b', p: 0.75 }}
            >
              <MenuIcon sx={{ fontSize: 22 }} />
            </IconButton>
          )}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600, color: '#0f172a', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'AlgoRooms'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
            <Tooltip title="Notifications">
              <IconButton size="small" sx={{ color: '#64748b', p: { xs: 0.5, sm: 1 } }}>
                <Badge badgeContent={3} color="error">
                  <NotificationsIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Settings">
              <IconButton size="small" sx={{ color: '#64748b', display: { xs: 'none', sm: 'inline-flex' }, p: 1 }}>
                <SettingsIcon sx={{ fontSize: 24 }} />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1, display: { xs: 'none', sm: 'block' } }} />

            <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', alignItems: 'flex-end', mr: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', lineHeight: 1.2, fontSize: '0.875rem' }}>
                {user?.displayName || 'User'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                {user?.email}
              </Typography>
            </Box>

            <IconButton onClick={handleMenuOpen} sx={{ p: { xs: 0.25, sm: 0.5 } }}>
              <Avatar 
                sx={{ 
                  width: { xs: 32, sm: 36 }, 
                  height: { xs: 32, sm: 36 },
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }}
              >
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </Avatar>
            </IconButton>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1.5,
                  minWidth: 220,
                  borderRadius: 2.5,
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                  border: '1px solid #f1f5f9'
                }
              }
            }}
          >
            <Box sx={{ px: 2.5, py: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                {user?.displayName || 'User'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }} sx={{ py: 1.5, px: 2.5 }}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Profile</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); }} sx={{ py: 1.5, px: 2.5 }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Settings</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { handleMenuClose(); handleLogout(); }} sx={{ py: 1.5, px: 2.5, color: '#ef4444' }}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" sx={{ color: '#ef4444' }} />
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
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
          bgcolor: '#f8fafc',
          minHeight: '100vh',
          pb: { 
            xs: 'calc(48px + env(safe-area-inset-bottom))', 
            md: 3 
          },
          pt: { xs: 'calc(56px + env(safe-area-inset-top))', sm: 'calc(64px + env(safe-area-inset-top))', md: 3 },
          px: { xs: 0, sm: 2, md: 3 },
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden',
        }}
      >
        <Box sx={{ height: { xs: 2, sm: 2.5, md: 3 }, width: '100%' }} />
        <Container 
          maxWidth="xl" 
          sx={{ 
            px: { xs: 2, sm: 3 },
            width: '100%',
            maxWidth: '100%',
            overflowX: 'hidden'
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
                transition: 'all 0.2s',
                minHeight: 48,
                maxHeight: 48,
                '&.Mui-selected': {
                  color: '#6366f1',
                  fontWeight: 600
                }
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.625rem',
                marginTop: '1px',
                lineHeight: 1,
                '&.Mui-selected': {
                  fontSize: '0.625rem'
                }
              },
              '& .MuiSvgIcon-root': {
                fontSize: '1.125rem',
                marginBottom: '1px'
              }
            }}
          >
            {menuItems.slice(0, 4).map((item) => (
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
