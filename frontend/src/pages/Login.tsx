import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  ShowChart
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';

// Official Google SVG — no emojis
const GoogleIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login(formData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await authService.loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: '#f0f4f8'
      }}
    >
      {/* Left Brand Panel — desktop only */}
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          width: 420,
          flexShrink: 0,
          bgcolor: '#0f172a',
          px: 6,
          py: 8
        }}
      >
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 6 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: '#4f46e5',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <ShowChart sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontWeight: 800, color: '#f1f5f9', fontSize: '1.15rem' }}>
            Mavrix Trading
          </Typography>
        </Box>

        <Typography sx={{ fontWeight: 800, color: '#f1f5f9', fontSize: '1.75rem', lineHeight: 1.25, mb: 2 }}>
          Institutional-grade trading automation
        </Typography>
        <Typography sx={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.7 }}>
          Powered by DhanHQ v2 API. Execute live orders, run automated strategies, and monitor real-time P&amp;L — all in one platform.
        </Typography>

        {/* Feature list */}
        {[
          'Real-money & Paper trading modes',
          'WebSocket live market feed',
          'Strategy engine with backtesting',
          'NSE/BSE order routing via Dhan'
        ].map((feat) => (
          <Box key={feat} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: 2 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#4f46e5', flexShrink: 0 }} />
            <Typography sx={{ color: '#cbd5e1', fontSize: '0.84rem' }}>{feat}</Typography>
          </Box>
        ))}
      </Box>

      {/* Right Login Panel */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 3 },
          py: 4
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center', gap: 1.2, mb: 4 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShowChart sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
              Mavrix Trading
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: 2.5,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              boxShadow: '0 4px 16px -4px rgb(0 0 0 / 0.08)'
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              Sign in
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.875rem', mb: 3 }}>
              Access your Mavrix Trading account
            </Typography>

            {error && (
              <Alert
                severity="error"
                onClose={() => setError('')}
                sx={{ mb: 2.5, borderRadius: 1.5, fontSize: '0.82rem' }}
              >
                {error}
              </Alert>
            )}

            {/* Google sign-in */}
            <Button
              fullWidth
              variant="outlined"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              startIcon={googleLoading ? <CircularProgress size={16} /> : <GoogleIcon />}
              sx={{
                py: 1.1,
                mb: 2.5,
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'none',
                borderColor: '#e2e8f0',
                color: '#1e293b',
                bgcolor: '#ffffff',
                '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' }
              }}
            >
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </Button>

            <Divider sx={{ mb: 2.5 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', px: 1 }}>
                or email
              </Typography>
            </Divider>

            {/* Email / password form */}
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                required
                fullWidth
                id="email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={formData.email}
                onChange={handleChange}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ fontSize: 16, color: '#94a3b8' }} />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                required
                fullWidth
                id="password"
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ fontSize: 16, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword
                          ? <VisibilityOff sx={{ fontSize: 16, color: '#94a3b8' }} />
                          : <Visibility sx={{ fontSize: 16, color: '#94a3b8' }} />
                        }
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -0.5 }}>
                <Typography
                  component={Link}
                  to="/forgot-password"
                  sx={{ color: '#4f46e5', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  Forgot password?
                </Typography>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading || googleLoading}
                sx={{
                  py: 1.1,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  mt: 0.5
                }}
              >
                {loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Sign In'}
              </Button>
            </Box>

            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
              <Typography sx={{ fontSize: '0.84rem', color: '#64748b' }}>
                No account?{' '}
                <Typography
                  component={Link}
                  to="/register"
                  sx={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  Create one
                </Typography>
              </Typography>
            </Box>
          </Paper>

          <Typography sx={{ textAlign: 'center', mt: 3, color: '#94a3b8', fontSize: '0.75rem' }}>
            © 2026 Mavrix Trading. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
