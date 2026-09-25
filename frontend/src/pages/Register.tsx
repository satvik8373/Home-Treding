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
  PersonOutline,
  EmailOutlined,
  PhoneOutlined,
  LockOutlined,
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

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await authService.register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      });

      setSuccess('Account created successfully. Redirecting to dashboard...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
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
      setError(err.message || 'Google Sign-In failed.');
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
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
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
          Create your account to execute live algorithms, manage multi-broker portfolios, and view real-time market data with sub-millisecond precision.
        </Typography>

        {/* Feature list */}
        {[
          { title: 'DhanHQ Direct Connect', desc: 'Execute orders directly via official Dhan v2 REST & WebSocket feeds' },
          { title: 'Isolated Paper Engine', desc: 'Safely test and benchmark strategies with realistic slippage modeling' },
          { title: 'Sub-Millisecond Engine', desc: 'Real-time order routing, position tracking, and risk controls' }
        ].map((f, i) => (
          <Box key={i} sx={{ mt: 3.5 }}>
            <Typography sx={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.9rem', mb: 0.3 }}>
              {f.title}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
              {f.desc}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Right Register Panel */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 3 },
          py: { xs: 4, sm: 6 }
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 440 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center', gap: 1.2, mb: 3 }}>
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
              Create an account
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.875rem', mb: 2.5 }}>
              Start your automated trading journey
            </Typography>

            {error && (
              <Alert
                severity="error"
                onClose={() => setError('')}
                sx={{ mb: 2, borderRadius: 1.5, fontSize: '0.82rem' }}
              >
                {error}
              </Alert>
            )}

            {success && (
              <Alert
                severity="success"
                sx={{ mb: 2, borderRadius: 1.5, fontSize: '0.82rem' }}
              >
                {success}
              </Alert>
            )}

            {/* Google sign-up */}
            <Button
              fullWidth
              variant="outlined"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              startIcon={googleLoading ? <CircularProgress size={16} /> : <GoogleIcon />}
              sx={{
                py: 1.1,
                mb: 2,
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'none',
                borderColor: '#e2e8f0',
                color: '#1e293b',
                bgcolor: '#ffffff',
                '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' }
              }}
            >
              {googleLoading ? 'Connecting...' : 'Sign up with Google'}
            </Button>

            <Divider sx={{ mb: 2 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', px: 1 }}>
                or with email
              </Typography>
            </Divider>

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
              <TextField
                required
                fullWidth
                id="name"
                label="Full Name"
                name="name"
                autoComplete="name"
                autoFocus
                size="small"
                value={formData.name}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutline sx={{ color: '#94a3b8', fontSize: 18 }} />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                type="email"
                autoComplete="email"
                size="small"
                value={formData.email}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined sx={{ color: '#94a3b8', fontSize: 18 }} />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                fullWidth
                id="phone"
                label="Phone Number"
                name="phone"
                type="tel"
                autoComplete="tel"
                size="small"
                value={formData.phone}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneOutlined sx={{ color: '#94a3b8', fontSize: 18 }} />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                required
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="new-password"
                size="small"
                value={formData.password}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: '#94a3b8', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        aria-label="toggle password visibility"
                      >
                        {showPassword ? <VisibilityOff sx={{ fontSize: 18, color: '#94a3b8' }} /> : <Visibility sx={{ fontSize: 18, color: '#94a3b8' }} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                required
                fullWidth
                name="confirmPassword"
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                size="small"
                value={formData.confirmPassword}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: '#94a3b8', fontSize: 18 }} />
                    </InputAdornment>
                  )
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading || googleLoading}
                sx={{
                  mt: 0.5,
                  py: 1.2,
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  borderRadius: 1.5,
                  bgcolor: '#4f46e5',
                  boxShadow: 'none',
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#4338ca', boxShadow: 'none' }
                }}
              >
                {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Create Account'}
              </Button>
            </Box>

            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
              <Typography sx={{ color: '#64748b', fontSize: '0.82rem' }}>
                Already have an account?{' '}
                <Box
                  component={Link}
                  to="/login"
                  sx={{
                    color: '#4f46e5',
                    fontWeight: 700,
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  Sign in
                </Box>
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default Register;
