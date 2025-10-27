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
  Stop,
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

  const handleToggleTerminal = async () => {
    if (!broker.terminalEnabled) {
      setLoading(true);
      setError('');

      try {
        // Check terminal status like AlgoRooms
        const statusResponse = await axios.post('http://localhost:5000/api/broker/terminal-status', {
          brokerId: broker.id
        });

        if (statusResponse.data.success) {
          // Just enable the toggle - no popup, no terminal board
          updateBrokerToggle('terminal', true);
          
          // Show simple success message like AlgoRooms
          setError(''); // Clear any previous errors
        } else {
          setError('Terminal not active. Please activate terminal in Dhan app first.');
        }
      } catch (error: any) {
        // Show terminal not active status like AlgoRooms
        setError('Terminal not active. Please activate terminal in Dhan app.');
      } finally {
        setLoading(false);
      }
    } else {
      // Just disable the toggle
      updateBrokerToggle('terminal', false);
    }
  };

  const handleToggleTradingEngine = async () => {
    updateBrokerToggle('tradingEngine', !broker.tradingEngineEnabled);
  };

  const updateBrokerToggle = async (toggle: 'terminal' | 'tradingEngine', enabled: boolean) => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`http://localhost:5000/api/broker/${toggle}`, {
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

  const handleReconnect = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`http://localhost:5000/api/broker/reconnect`, {
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
      await axios.delete(`http://localhost:5000/api/broker/${broker.id}`);
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
            {/* Terminal Status (AlgoRooms Style) */}
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