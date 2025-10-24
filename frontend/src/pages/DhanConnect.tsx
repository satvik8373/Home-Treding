import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const DhanConnect: React.FC = () => {
  const [brokerId, setBrokerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleConnect = async () => {
    if (!brokerId.trim()) {
      setError('Please enter your Broker ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/broker/connect', {
        brokerId: brokerId.trim()
      });

      if (response.data.success) {
        setConnected(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error: any) {
      setError('Connection failed. Please check your Broker ID.');
    } finally {
      setLoading(false);
    }
  };

  if (connected) {
    return (
      <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8, p: 3 }}>
        <Card sx={{ textAlign: 'center', p: 3 }}>
          <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom color="success.main">
            ✅ Connected Successfully!
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Redirecting to dashboard...
          </Typography>
          <CircularProgress size={24} color="success" />
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8, p: 3 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 1 }}>
            Connect Broker
          </Typography>

          <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', mb: 4 }}>
            Enter your Broker ID to connect
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Broker ID"
            placeholder="Enter your Broker ID"
            value={brokerId}
            onChange={(e) => setBrokerId(e.target.value)}
            variant="outlined"
            sx={{ mb: 3 }}
            onKeyPress={(e) => e.key === 'Enter' && handleConnect()}
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleConnect}
            disabled={loading || !brokerId.trim()}
            sx={{ mb: 2, py: 1.5 }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </Button>

          <Button
            fullWidth
            variant="text"
            onClick={() => navigate('/dashboard')}
            sx={{ color: 'text.secondary' }}
          >
            Skip (Demo Mode)
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DhanConnect;