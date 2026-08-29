import React from 'react';
import { Box, Typography } from '@mui/material';
import { FiberManualRecord } from '@mui/icons-material';

interface StatusBadgeProps {
  status: 'active' | 'live' | 'connected' | 'paper' | 'halted' | 'stopped' | 'pending' | 'filled' | 'rejected' | string;
  dot?: boolean;
  pulse?: boolean;
  label?: string;
  size?: 'small' | 'medium';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  dot = false,
  pulse = false,
  label,
  size = 'small'
}) => {
  const norm = status.toLowerCase();

  let bg = '#f1f5f9';
  let color = '#475569';
  let border = '#e2e8f0';
  let dotColor = '#64748b';

  if (['active', 'live', 'connected', 'filled', 'success'].includes(norm)) {
    bg = '#f0fdf4';
    color = '#15803d';
    border = '#dcfce7';
    dotColor = '#16a34a';
  } else if (['halted', 'stopped', 'rejected', 'error', 'failed'].includes(norm)) {
    bg = '#fef2f2';
    color = '#b91c1c';
    border = '#fee2e2';
    dotColor = '#dc2626';
  } else if (['paper', 'pending', 'syncing', 'warning'].includes(norm)) {
    bg = '#fffbeb';
    color = '#b45309';
    border = '#fef3c7';
    dotColor = '#f59e0b';
  } else if (['blue', 'info'].includes(norm)) {
    bg = '#eff6ff';
    color = '#1d4ed8';
    border = '#dbeafe';
    dotColor = '#3b82f6';
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        bgcolor: bg,
        color,
        border: `1px solid ${border}`,
        px: size === 'small' ? 0.9 : 1.2,
        py: size === 'small' ? 0.2 : 0.4,
        borderRadius: 4,
        fontSize: size === 'small' ? '0.7rem' : '0.78rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        lineHeight: 1
      }}
    >
      {dot && (
        <FiberManualRecord
          sx={{
            fontSize: 7,
            color: dotColor,
            animation: pulse ? 'pulseBadge 1.5s infinite' : 'none',
            '@keyframes pulseBadge': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.3 },
              '100%': { opacity: 1 }
            }
          }}
        />
      )}
      <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
        {label || status}
      </Typography>
    </Box>
  );
};
