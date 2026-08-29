import React from 'react';
import { Chip, Box, Typography, Tooltip } from '@mui/material';
import { Science, Lock } from '@mui/icons-material';

interface ModeBadgeProps {
  mode?: 'paper' | 'live';
}

export const ModeBadge: React.FC<ModeBadgeProps> = ({ mode = 'paper' }) => {
  const isPaper = mode === 'paper';

  return (
    <Tooltip title={isPaper ? "Paper Mode: Real market feeds connected, Zero real-money risk" : "Live Mode: Real broker orders"}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <Chip
          icon={isPaper ? <Science sx={{ fontSize: 16, color: '#3b82f6 !important' }} /> : <Lock sx={{ fontSize: 16, color: '#ef4444 !important' }} />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                {isPaper ? 'PAPER TRADING' : 'LIVE TRADING'}
              </Typography>
            </Box>
          }
          size="small"
          sx={{
            height: 24,
            bgcolor: isPaper ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: isPaper ? '#2563eb' : '#dc2626',
            border: '1px solid',
            borderColor: isPaper ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            borderRadius: 1.5,
            px: 0.5
          }}
        />
      </Box>
    </Tooltip>
  );
};
