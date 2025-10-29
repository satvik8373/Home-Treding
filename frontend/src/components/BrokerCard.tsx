import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Switch,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  TrendingUp,
  Delete as DeleteIcon,
  Terminal,
  PlayArrow,
  Refresh
} from '@mui/icons-material';
import axios from 'axios';

interface Broker {
  id: string;
  broker: string;
  clientId: string;
  status: 'Connected' | 'Disconnected';
  accountName?: string;
  strategyPerformance?: string;
  terminalEnabled: boolean;
  tradingEngineEnabled: boolean;
  lastActivity?: string;
  totalOrders?: number;
  activePositions?: number;
  connectedAt?: string;
  lastValidated?: string;
}

interface BrokerCardProps {
  broker: Broker;
  onUpdate: (broker: Broker) => void;
  onDelete: (brokerId: string) => void;
}

const BrokerCard: React.FC<BrokerCardProps> = ({ broker, onUpdate, onDelete }) => {
  const [loading, setLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [error, setError] = useState('');

  const updateBrokerToggle = async (toggle: 'terminal' | 'tradingEngine', enabled: boolean) => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/${toggle}`, {
        brokerId: broker.id,
        enabled
      });

      if (response.data.success) {
        const updatedBroker = {
          ...broker,
          [toggle === 'terminal' ? 'terminalEnabled' : 'tradingEngineEnabled']: enabled
        };
        onUpdate(updatedBroker);
      } else {
        setError(response.data.message || 'Failed to update settings');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTerminal = async () => {
    if (!broker.terminalEnabled) {
      setLoading(true);
      setError('');

      // Show OAuth confirmation
      const confirmRedirect = window.confirm(
        `🔐 Dhan Terminal Activation (OAuth)\n\n` +
        `To activate terminal, you need to authorize via Dhan OAuth.\n` +
        `This will open Dhan Partner login in a new window.\n\n` +
        `Click OK to proceed with OAuth authorization.`
      );

      if (confirmRedirect) {
        try {
          // Get Dhan OAuth login URL from backend
          const loginUrlResponse = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/dhan-login-url`, {
            brokerId: broker.id
          });

          if (loginUrlResponse.data.success) {
            // Check if terminal was directly activated (AlgoRooms style with real API)
            if (loginUrlResponse.data.directActivation && loginUrlResponse.data.algoRoomsStyle) {
              console.log('✅ Dhan terminal activated (AlgoRooms style) using real API');
              
              // Update with the complete broker data from API
              const updatedBroker = {
                ...broker,
                ...loginUrlResponse.data.broker,
                terminalEnabled: true,
                terminalActivated: true,
                status: 'Connected' as const
              };
              onUpdate(updatedBroker);
              setError('');
              setLoading(false);
              
              alert(`✅ Dhan Terminal Activated! (AlgoRooms Style)\n\n` +
                    `Broker: Dhan (${loginUrlResponse.data.broker.clientId})\n` +
                    `Status: Connected\n` +
                    `Orders: ${loginUrlResponse.data.broker.totalOrders}\n` +
                    `Positions: ${loginUrlResponse.data.broker.activePositions}\n\n` +
                    `Ready for live trading!`);
              return;
            }
            
            // Check if it's development mode
            if (loginUrlResponse.data.isDevelopment) {
              console.log('🧪 Development mode: Simulating OAuth flow');
              
              // Show development mode message
              alert('🧪 Development Mode\n\nSimulating Dhan OAuth flow...\nThis will auto-complete in 3 seconds.');
              
              // Simulate OAuth success after 3 seconds
              setTimeout(() => {
                const updatedBroker = {
                  ...broker,
                  terminalEnabled: true,
                  terminalActivated: true,
                  status: 'Connected' as const
                };
                onUpdate(updatedBroker);
                setError('');
                setLoading(false);
                
                alert('✅ Development OAuth completed! Terminal activated successfully.');
              }, 3000);
              
              return;
            }
            
            const loginWindow = window.open(
              loginUrlResponse.data.loginUrl,
              'dhan-oauth-login',
              'width=600,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no'
            );

            console.log('🔗 Opening Dhan OAuth login:', loginUrlResponse.data.loginUrl);

            // Listen for OAuth success message from popup
            const handleMessage = (event: MessageEvent) => {
              if (event.data.type === 'DHAN_OAUTH_SUCCESS') {
                console.log('✅ OAuth success received:', event.data.data);
                
                // Update broker state with OAuth success
                const updatedBroker = {
                  ...broker,
                  terminalEnabled: true,
                  terminalActivated: true,
                  status: 'Connected' as const
                };
                onUpdate(updatedBroker);
                setError('');
                setLoading(false);
                
                alert('✅ Terminal activated successfully via OAuth! You can now place orders.');
                
                // Remove event listener
                window.removeEventListener('message', handleMessage);
              }
            };

            // Add message listener
            window.addEventListener('message', handleMessage);

            // Monitor the popup window for manual close
            const checkClosed = setInterval(() => {
              if (loginWindow?.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', handleMessage);
                
                // If window closed without success message, check status
                setTimeout(async () => {
                  try {
                    const recheckResponse = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/terminal-status`, {
                      brokerId: broker.id
                    });
                    
                    if (recheckResponse.data.success && recheckResponse.data.accountInfo?.terminalActivated) {
                      const updatedBroker = {
                        ...broker,
                        terminalEnabled: true,
                        terminalActivated: true,
                        status: 'Connected' as const
                      };
                      onUpdate(updatedBroker);
                      setError('');
                      alert('✅ Terminal activated successfully! You can now place orders.');
                    } else {
                      setError('OAuth authorization incomplete. Please try again.');
                    }
                  } catch (error) {
                    setError('Please check terminal status and try again.');
                  }
                  setLoading(false);
                }, 2000);
              }
            }, 1000);

            // Auto-close check after 10 minutes
            setTimeout(() => {
              if (!loginWindow?.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', handleMessage);
                setLoading(false);
              }
            }, 600000);
          } else {
            setError('Failed to generate Dhan OAuth login URL');
            setLoading(false);
          }
        } catch (error: any) {
          setError('Unable to open Dhan OAuth login. Please try again.');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } else {
      // Disable terminal
      updateBrokerToggle('terminal', false);
    }
  };

  const handleToggleTradingEngine = async () => {
    updateBrokerToggle('tradingEngine', !broker.tradingEngineEnabled);
  };

  const handleReconnect = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/reconnect`, {
        brokerId: broker.id
      });

      if (response.data.success) {
        onUpdate({ ...broker, status: 'Connected' });
      } else {
        setError('Reconnection failed');
      }
    } catch (error: any) {
      setError('Reconnection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/${broker.id}`);
      onDelete(broker.id);
      setDeleteDialog(false);
    } catch (error) {
      setError('Failed to delete broker');
    }
  };

  return (
    <>
      <Card sx={{ height: '100%', position: 'relative' }}>
        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp color="primary" />
              <Typography variant="h6">{broker.broker}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={broker.status}
                color={broker.status === 'Connected' ? 'success' : 'error'}
                size="small"
              />
              <IconButton
                size="small"
                onClick={() => setDeleteDialog(true)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Account Info (AlgoRooms Style) */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="textSecondary">
              Broker Account: <strong>{broker.clientId}</strong>
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Strategy Performance: <strong>{broker.strategyPerformance || '0.00%'}</strong>
            </Typography>
            <Typography variant="body2" color={broker.terminalEnabled ? 'success.main' : 'error.main'}>
              Terminal Status: <strong>{broker.terminalEnabled ? 'Active' : 'Not Active'}</strong>
            </Typography>
            {!broker.terminalEnabled && (
              <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.5 }}>
                Please activate terminal in Dhan app to enable trading
              </Typography>
            )}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>
              {error}
            </Alert>
          )}

          {/* Controls */}
          <Box sx={{ space: 2 }}>
            {/* Terminal Toggle (AlgoRooms Style) */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Terminal fontSize="small" color={broker.terminalEnabled ? 'success' : 'error'} />
                <Typography variant="body2">
                  Terminal: {broker.terminalEnabled ? 'Active' : 'Not Active'}
                </Typography>
                {broker.terminalEnabled && (
                  <Chip label="ON" color="success" size="small" />
                )}
                {!broker.terminalEnabled && (
                  <Chip label="OFF" color="error" size="small" />
                )}
              </Box>
              <Switch
                checked={broker.terminalEnabled}
                onChange={handleToggleTerminal}
                disabled={loading || broker.status === 'Disconnected'}
                size="small"
              />
            </Box>

            {/* Trading Engine Toggle */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PlayArrow fontSize="small" />
                <Typography variant="body2">Trading Engine</Typography>
              </Box>
              <Switch
                checked={broker.tradingEngineEnabled}
                onChange={handleToggleTradingEngine}
                disabled={loading || broker.status === 'Disconnected'}
                size="small"
              />
            </Box>
          </Box>

          {/* Actions */}
          {broker.status === 'Disconnected' && (
            <Button
              fullWidth
              variant="outlined"
              startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
              onClick={handleReconnect}
              disabled={loading}
              size="small"
            >
              {loading ? 'Reconnecting...' : 'Reconnect'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Broker Connection</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the connection to {broker.broker} ({broker.clientId})?
            This will stop all trading activities for this broker.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BrokerCard;