import React from 'react';
import { Paper, Box, Typography } from '@mui/material';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
  sx?: any;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  action,
  children,
  noPadding = false,
  sx
}) => {
  return (
    <Paper
      sx={{
        borderRadius: 2.5,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        bgcolor: '#ffffff',
        overflow: 'hidden',
        mb: 3,
        ...sx
      }}
    >
      {(title || action) && (
        <Box
          sx={{
            px: 2.5,
            py: 1.8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <Box>
            {title && (
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  color: '#0f172a',
                  fontSize: '0.92rem',
                  letterSpacing: '-0.01em'
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box>{action}</Box>}
        </Box>
      )}
      <Box sx={{ p: noPadding ? 0 : 2.5 }}>{children}</Box>
    </Paper>
  );
};
