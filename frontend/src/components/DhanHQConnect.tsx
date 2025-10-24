import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Divider
} from '@mui/material';
import { CheckCircle, Security, TrendingUp, AccountBalance } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface DhanProfile {
  clientId: string;
  clientName: string;
  accountType: string;
  status: string;
}

const DhanHQConnect: React.FC = () => {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<DhanProfile | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Enter Credentials', 'Verify with DhanHQ', 'Connected'];

  const handleConnect = async () => {
    if (!clientId.trim() || !accessToken.trim()) {
      setError('Please enter both Client ID and Access Token');
      return;
    }

    setLoading(true);
    setError('');
    setActiveStep(1);

    try {
      const response = await axios.post('http://localhost:5000/api/dhan/auth/login', {
        clientId: clientId.trim(),
        accessToken: accessToken.trim()
      });

      if (response.data.success) {
        setProfile(response.data.profile);
        setConnected(true);
        setActiveStep(2);
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'DhanHQ connection failed');
      setActiveStep(0);
    } finally {
      setLoading(false);
    }
  };

  if (connected && profile) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: 3 }}>
        <Card sx={{ textAlign: 'center', p: 4 }}>
          <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom color="success.main">
            🎉 DhanHQ Connected!
          </Typography>
          
          <Stepper activeStep={2} sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ mt: 3, mb: 3, p: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom color="primary.main">
              ✅ Account Verified
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {profile.clientName}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Client ID: {profile.clientId}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Account Type: {profile.accountType}
            </Typography>
            <Typography variant="body2" color="success.main">
              Status: {profile.status}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Chip icon={<TrendingUp />} label="Live Market Data" color="success" />
            <Chip icon={<AccountBalance />} label="Order Placement" color="success" />
            <Chip icon={<Security />} label="Portfolio Access" color="success" />
          </Box>
          
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Redirecting to trading dashboard...
          </Typography>
          <CircularProgress size={24} color="success" />
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: 3 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ textAlign: 'center', mb: 2 }}>
            Connect to DhanHQ
          </Typography>
          
          <Typography variant="body1" color="textSecondary" sx={{ textAlign: 'center', mb: 4 }}>
            Professional trading platform integration
          </Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>How to get DhanHQ credentials:</strong>
            </Typography>
            <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
              <li>Login to your Dhan account</li>
              <li>Go to Profile → DhanHQ Trading APIs</li>
              <li>Generate Access Token</li>
              <li>Copy Client ID and Access Token</li>
            </ol>
          </Alert>

          <TextField
            fullWidth
            label="Dhan Client ID"
            placeholder="Enter your Dhan Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            variant="outlined"
            sx={{ mb: 2 }}
            helperText="Your unique Dhan client identifier"
          />
          
          <TextField
            fullWidth
            label="DhanHQ Access Token"
            placeholder="Enter your DhanHQ Access Token"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            variant="outlined"
            sx={{ mb: 3 }}
            helperText="Generated from DhanHQ Trading APIs section"
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleConnect}
            disabled={loading || !clientId.trim() || !accessToken.trim()}
            sx={{ mb: 2, py: 1.5 }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Connecting to DhanHQ...
              </>
            ) : (
              '🚀 Connect to DhanHQ'
            )}
          </Button>

          <Divider sx={{ my: 2 }}>
            <Chip label="OR" size="small" />
          </Divider>

          <Button
            fullWidth
            variant="outlined"
            onClick={() => navigate('/dashboard')}
            sx={{ mb: 2 }}
          >
            Continue with Demo Mode
          </Button>

          <Typography variant="caption" color="textSecondary" sx={{ textAlign: 'center', display: 'block' }}>
            Your credentials are secure and only used for DhanHQ API authentication
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DhanHQConnect;