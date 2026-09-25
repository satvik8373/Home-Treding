import React from 'react';
import { Box, Typography } from '@mui/material';

interface StatusBadgeProps {
  status: 'active' | 'live' | 'connected' | 'paper' | 'halted' | 'stopped' | 'pending' | 'filled' | 'rejected' | string;
  dot?: boolean;
  label?: string;
  size?: 'small' | 'medium';
}

// Semantic color map — no neon, no bright borders
const statusMap: Record<string, { bg: string; color: string; dot: string }> = {
  // Active / positive
  active:    { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a' },
  live:      { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a' },
  connected: { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a' },
  filled:    { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a' },
  success:   { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a' },
  running:   { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a' },

  // Error / halt
  halted:    { bg: '#fef2f2', color: '#b91c1c', dot: '#dc2626' },
  stopped:   { bg: '#fef2f2', color: '#b91c1c', dot: '#dc2626' },
  rejected:  { bg: '#fef2f2', color: '#b91c1c', dot: '#dc2626' },
  error:     { bg: '#fef2f2', color: '#b91c1c', dot: '#dc2626' },
  failed:    { bg: '#fef2f2', color: '#b91c1c', dot: '#dc2626' },
  cancelled: { bg: '#fef2f2', color: '#b91c1c', dot: '#dc2626' },

  // Warning / paper / pending
  paper:    { bg: '#fffbeb', color: '#92400e', dot: '#d97706' },
  pending:  { bg: '#fffbeb', color: '#92400e', dot: '#d97706' },
  syncing:  { bg: '#fffbeb', color: '#92400e', dot: '#d97706' },
  paused:   { bg: '#fffbeb', color: '#92400e', dot: '#d97706' },

  // Info / primary
  blue:     { bg: '#eff6ff', color: '#1d4ed8', dot: '#2563eb' },
  info:     { bg: '#eff6ff', color: '#1d4ed8', dot: '#2563eb' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  dot = false,
  label,
  size = 'small'
}) => {
  const norm = status.toLowerCase();
  const colors = statusMap[norm] ?? { bg: '#f8fafc', color: '#475569', dot: '#94a3b8' };

  const isSmall = size === 'small';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: colors.bg,
        color: colors.color,
        border: '1px solid rgba(15, 23, 42, 0.08)',
        px: isSmall ? 0.9 : 1.2,
        py: isSmall ? 0.2 : 0.4,
        borderRadius: 1,
        fontSize: isSmall ? '0.68rem' : '0.74rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        lineHeight: 1.4,
        whiteSpace: 'nowrap'
      }}
    >
      {dot && (
        <Box
          component="span"
          sx={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            bgcolor: colors.dot,
            flexShrink: 0,
            display: 'inline-block'
          }}
        />
      )}
      <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', lineHeight: 'inherit' }}>
        {label || status}
      </Typography>
    </Box>
  );
};
