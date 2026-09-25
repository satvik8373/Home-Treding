import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  trend,
  color,
  onClick
}) => {
  const trendColor = color
    ? color
    : trend === 'up'
    ? '#16a34a'
    : trend === 'down'
    ? '#dc2626'
    : '#0f172a';

  const trendBg = trend === 'up'
    ? '#f0fdf4'
    : trend === 'down'
    ? '#fef2f2'
    : null;

  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2.5,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.06)',
        bgcolor: '#ffffff',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
        '&:hover': onClick
          ? {
              boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.12)',
              borderColor: '#94a3b8',
              transform: 'translateY(-1px)'
            }
          : {},
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      {/* Label row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.2 }}>
        <Typography
          sx={{
            fontWeight: 700,
            color: '#475569',
            fontSize: '0.72rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            lineHeight: 1.3
          }}
        >
          {label}
        </Typography>
        {icon && (
          <Box
            sx={{
              color: '#475569',
              bgcolor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: 1.5,
              p: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {icon}
          </Box>
        )}
      </Box>

      {/* Value */}
      <Typography
        sx={{
          fontWeight: 800,
          color: trendColor,
          fontFamily: '"Inter", monospace',
          fontSize: { xs: '1.1rem', md: '1.3rem' },
          letterSpacing: '-0.025em',
          lineHeight: 1.15
        }}
      >
        {value}
      </Typography>

      {/* Subtext row */}
      {(subtext || trend) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.8 }}>
          {subtext && (
            <Typography
              sx={{
                color: '#94a3b8',
                fontSize: '0.7rem',
                fontWeight: 500,
                lineHeight: 1.3,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {subtext}
            </Typography>
          )}
          {trend && trend !== 'neutral' && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.3,
                px: 0.7,
                py: 0.2,
                borderRadius: 1,
                bgcolor: trendBg || 'transparent',
                flexShrink: 0,
                ml: 0.5
              }}
            >
              {trend === 'up'
                ? <TrendingUp sx={{ fontSize: 12, color: '#16a34a' }} />
                : <TrendingDown sx={{ fontSize: 12, color: '#dc2626' }} />
              }
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};
