import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Divider,
  Grid
} from '@mui/material';
import {
  CheckCircle,
  Speed,
  Security,
  CloudDone,
  Bolt,
  AccountBalance
} from '@mui/icons-material';
import Layout from '../components/Layout';

const Subscription: React.FC = () => {
  return (
    <Layout>
      <Box
        sx={{
          maxWidth: 1040,
          mx: 'auto',
          p: { xs: 2, sm: 3.5 },
          bgcolor: '#ffffff',
          borderRadius: 4,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Subscription & License
            </Typography>
            <Chip
              label="ACTIVE & UNLIMITED"
              size="small"
              sx={{
                bgcolor: '#f0fdf4',
                color: '#16a34a',
                fontWeight: 700,
                fontSize: '0.72rem',
                border: '1px solid #bbf7d0'
              }}
            />
          </Box>
          <Typography sx={{ fontSize: '0.85rem', color: '#64748b' }}>
            Manage platform subscription tier, DhanHQ v2 broker license, and execution limits
          </Typography>
        </Box>

        <Divider sx={{ borderColor: '#f1f5f9', mb: 3 }} />

        {/* Current Plan Card */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#f8fafc',
            mb: 3
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  Institutional Developer Tier
                </Typography>
                <Chip
                  label="DhanHQ v2 Authorized"
                  size="small"
                  sx={{ bgcolor: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: '0.7rem' }}
                />
              </Box>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b', maxWidth: 600 }}>
                Includes unlimited automated order routing, zero broker API markup, high-frequency tick processing, and paper forward testing.
              </Typography>
            </Box>

            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                ₹0 <Typography component="span" sx={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>/ perpetual</Typography>
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                Free Developer Access
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Features Grid */}
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', mb: 2 }}>
          Included Platform Capabilities
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          {[
            {
              title: 'Direct DhanHQ Routing',
              desc: 'Execute directly against DhanHQ v2 REST & WebSocket endpoints with low latency.',
              icon: <AccountBalance sx={{ fontSize: 20, color: '#2563eb' }} />
            },
            {
              title: 'Unlimited Deployments',
              desc: 'Deploy multiple algorithmic strategies across NIFTY, BANKNIFTY, and equity simultaneously.',
              icon: <Speed sx={{ fontSize: 20, color: '#16a34a' }} />
            },
            {
              title: 'Live Option Chain',
              desc: 'Real-time Greeks, Open Interest analysis, and multi-strike implied volatility streaming.',
              icon: <Bolt sx={{ fontSize: 20, color: '#f59e0b' }} />
            },
            {
              title: 'Risk Guard & Auto Square-off',
              desc: 'Enforces hard loss limits, trailing stop losses, and market-close squaring off.',
              icon: <Security sx={{ fontSize: 20, color: '#dc2626' }} />
            },
            {
              title: 'Paper Forward Testing',
              desc: 'Simulate live market orders in simulated memory with zero capital exposure.',
              icon: <CloudDone sx={{ fontSize: 20, color: '#0284c7' }} />
            },
            {
              title: 'Institutional Grade P&L',
              desc: 'Real-time Mark-to-Market calculation, tradebook sync, and daily turnover reports.',
              icon: <CheckCircle sx={{ fontSize: 20, color: '#16a34a' }} />
            }
          ].map((feat, i) => (
            <Paper
              key={i}
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: 2.5,
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                '&:hover': { borderColor: '#cbd5e1' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
                {feat.icon}
                <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
                  {feat.title}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.45 }}>
                {feat.desc}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Box>
    </Layout>
  );
};

export default Subscription;
