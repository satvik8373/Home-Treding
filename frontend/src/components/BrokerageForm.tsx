import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import { Security, TrendingUp } from '@mui/icons-material';
import axios from 'axios';

interface BrokerageFormProps {
  onBrokerAdded: (broker: any) => void;
  onCancel: () => void;
}

const BrokerageForm: React.FC<BrokerageFormProps> = ({ onBrokerAdded, onCancel }) => {
  const [formData, setFormData] = useState({
    broker: 'DHAN',
    clientId: '',
    accessToken: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientId.trim() || !formData.accessToken.trim()) {
      setError('Please enter both Client ID and Access Token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/connect`, {
        broker: formData.broker,
        clientId: formData.clientId.trim(),
        accessToken: formData.accessToken.trim()
      });

      if (response.data.success) {
        const newBroker = response.data.broker;
        
        // Just connect broker - no auto-activation (like AlgoRooms)
        setSuccess('✅ Broker connected successfully! Use Terminal toggle to activate trading.');
        
        onBrokerAdded(newBroker);
        
        // Reset form
        setFormData({
          broker: 'DHAN',
          clientId: '',
          accessToken: ''
        });
      } else {
        setError(response.data.message || 'Failed to connect broker');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Connection failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security color="primary" />
          Connect New Broker
        </Typography>
        
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Add your broker credentials to enable live trading and market data
        </Typography>

        <Divider sx={{ mb: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Broker</InputLabel>
            <Select
              value={formData.broker}
              label="Select Broker"
              onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
            >
              <MenuItem value="DHAN">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUp />
                  DHAN
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>⚠️ Real Dhan Account Required:</strong>
            </Typography>
            <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
              <li><strong>Login to your real Dhan account</strong> at dhan.co</li>
              <li>Go to <strong>Profile → DhanHQ Trading APIs</strong></li>
              <li>Create <strong>real API Key and Access Token</strong></li>
              <li>Ensure <strong>trading permissions are enabled</strong></li>
              <li>Enter <strong>real credentials below</strong> (no demo mode)</li>
            </ol>
            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'error.main' }}>
              🚨 Only real Dhan accounts with valid trading permissions will work
            </Typography>
          </Alert>

          <TextField
            fullWidth
            label="DHAN Client ID"
            name="clientId"
            value={formData.clientId}
            onChange={handleChange}
            placeholder="Enter your DHAN Client ID (e.g., 1108893841)"
            sx={{ mb: 2 }}
            helperText="Your unique DHAN client identifier"
          />

          <TextField
            fullWidth
            label="Access Token"
            name="accessToken"
            type="password"
            value={formData.accessToken}
            onChange={handleChange}
            placeholder="Enter your DHAN Access Token"
            sx={{ mb: 3 }}
            helperText="Generated from DHAN Trading APIs section"
          />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !formData.clientId.trim() || !formData.accessToken.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <Security />}
              sx={{ minWidth: 140 }}
            >
              {loading ? 'Connecting...' : 'Connect to DHAN'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BrokerageForm;