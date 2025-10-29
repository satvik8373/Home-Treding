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
  Paper
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp,
  AccountBalance,
  Assessment,
  ShowChart,
  Link as LinkIcon,
  Menu as MenuIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 240;

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

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box>
      <Toolbar sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
          AlgoRooms
        </Typography>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>
      
      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  '& .MuiListItemIcon-root': {
                    color: 'white'
                  },
                  '&:hover': {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'AlgoRooms'}
          </Typography>
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
            borderRight: '1px solid rgba(0,0,0,0.08)'
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
          bgcolor: '#f5f7fa',
          minHeight: '100vh',
          pb: { xs: 8, md: 3 },
          pt: 3,
          px: { xs: 2, sm: 3 }
        }}
      >
        <Toolbar />
        <Container maxWidth="xl" sx={{ px: { xs: 0, sm: 2 } }}>
          {children}
        </Container>
      </Box>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
          }}
          elevation={3}
        >
          <BottomNavigation
            value={location.pathname}
            onChange={(event, newValue) => {
              navigate(newValue);
            }}
            showLabels
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
        </Paper>
      )}
    </Box>
  );
};

export default Layout;
