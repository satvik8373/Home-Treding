import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  TrendingUp,
  Close as CloseIcon
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
}

interface AddBrokerFormProps {
  open: boolean;
  onClose: () => void;
  onBrokerAdded: (broker: Broker) => void;
}

const AddBrokerForm: React.FC<AddBrokerFormProps> = ({ open, onClose, onBrokerAdded }) => {
  const [formData, setFormData] = useState({
    clientId: '',
    accessToken: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [field]: event.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!formData.clientId || !formData.accessToken) {
      setError('Please enter both Client ID and Access Token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔗 Connecting Dhan broker with user credentials');

      // Get current user ID
      const { auth } = await import('../config/firebase');
      const userId = auth.currentUser?.uid;

      // Call backend to connect broker with user-provided credentials
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/connect-manual`, {
        broker: 'Dhan',
        clientId: formData.clientId,
        accessToken: formData.accessToken,
        userId: userId // Add user ID
      });

      if (response.data.success) {
        console.log('✅ Dhan broker connected successfully');
        
        // Create broker object for the parent component
        const newBroker: Broker = {
          id: response.data.broker.id,
          broker: 'Dhan',
          clientId: response.data.broker.clientId,
          status: 'Connected',
          accountName: response.data.broker.accountName,
          strategyPerformance: '0.00%',
          terminalEnabled: response.data.broker.terminalActivated || false,
          tradingEngineEnabled: response.data.broker.tradingEngineEnabled || false
        };

        onBrokerAdded(newBroker);
        
        // Reset form and close
        setFormData({ clientId: '', accessToken: '' });
        onClose();
        
        alert(`✅ Dhan Broker Connected Successfully!\n\n` +
              `Broker: Dhan (${response.data.broker.clientId})\n` +
              `Status: Connected\n` +
              `Terminal: ${response.data.broker.terminalActivated ? 'Active' : 'Inactive'}\n\n` +
              `Ready for trading!`);

      } else {
        setError(response.data.message || 'Failed to connect broker');
      }

    } catch (error: any) {
      console.error('Failed to connect Dhan broker:', error);
      
      if (error.response?.status === 401) {
        setError('Invalid Access Token. Please check your credentials and try again.');
      } else if (error.response?.status === 400) {
        setError(error.response.data.message || 'Invalid credentials provided.');
      } else {
        setError('Failed to connect broker. Please check your internet connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ clientId: '', accessToken: '' });
      setError('');
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" />
            <Typography variant="h6">Connect Dhan Broker</Typography>
          </Box>
          <IconButton onClick={handleClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Enter your Dhan API credentials to connect your broker account for live trading.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ space: 3 }}>
            {/* Client ID Field */}
            <TextField
              fullWidth
              label="Dhan Client ID"
              placeholder="e.g., 1108893841"
              value={formData.clientId}
              onChange={handleInputChange('clientId')}
              disabled={loading}
              sx={{ mb: 3 }}
              helperText="Your 10-digit Dhan Client ID from the Developer Portal"
            />

            {/* Access Token Field */}
            <TextField
              fullWidth
              label="Access Token"
              placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9..."
              type={showToken ? 'text' : 'password'}
              value={formData.accessToken}
              onChange={handleInputChange('accessToken')}
              disabled={loading}
              multiline={showToken}
              rows={showToken ? 3 : 1}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowToken(!showToken)}
                      disabled={loading}
                      edge="end"
                    >
                      {showToken ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              helperText="Your access token from Dhan Developer Portal (expires in 24 hours)"
            />
          </Box>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="textSecondary">
              <strong>How to get credentials:</strong><br />
              1. Go to Dhan Developer Portal<br />
              2. Login and find your "trading automation" app<br />
              3. Copy Client ID and generate new Access Token<br />
              4. Paste both values above
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={handleClose} 
            disabled={loading}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !formData.clientId || !formData.accessToken}
            startIcon={loading ? <CircularProgress size={16} /> : <TrendingUp />}
            sx={{ minWidth: 140 }}
          >
            {loading ? 'Connecting...' : 'Connect Broker'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddBrokerForm;