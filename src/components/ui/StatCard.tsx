import React from 'react';
import { Paper, Box, Typography } from '@mui/material';

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
  const getTrendColor = () => {
    if (color) return color;
    if (trend === 'up') return '#16a34a';
    if (trend === 'down') return '#dc2626';
    return '#0f172a';
  };

  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2.2,
        borderRadius: 2.5,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        bgcolor: '#ffffff',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': onClick ? { borderColor: '#cbd5e1', transform: 'translateY(-1px)' } : {},
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: '#64748b',
            fontSize: '0.72rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}
        >
          {label}
        </Typography>
        {icon && (
          <Box sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            {icon}
          </Box>
        )}
      </Box>

      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          color: getTrendColor(),
          fontFamily: 'monospace',
          fontSize: { xs: '1.15rem', md: '1.35rem' },
          letterSpacing: '-0.02em',
          lineHeight: 1.2
        }}
      >
        {value}
      </Typography>

      {subtext && (
        <Typography
          variant="caption"
          sx={{
            color: '#94a3b8',
            fontSize: '0.72rem',
            mt: 0.5,
            fontWeight: 500,
            display: 'block'
          }}
        >
          {subtext}
        </Typography>
      )}
    </Paper>
  );
};
