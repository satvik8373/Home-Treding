import React from 'react';
import { Paper, Box, Typography } from '@mui/material';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
  sx?: any;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  badge,
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
        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.06)',
        bgcolor: '#ffffff',
        overflow: 'hidden',
        mb: 3,
        ...sx
      }}
    >
      {(title || action) && (
        <Box
          sx={{
            px: { xs: 1.5, sm: 2.5 },
            py: 1.25,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.2,
            borderBottom: '1px solid #cbd5e1',
            bgcolor: '#f8fafc'
          }}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {title && (
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 800,
                    color: '#0f172a',
                    fontSize: { xs: '0.85rem', sm: '0.92rem' },
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3
                  }}
                >
                  {title}
                </Typography>
              )}
              {badge}
            </Box>
            {subtitle && (
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', display: 'block', mt: 0.3 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{action}</Box>}
        </Box>
      )}
      <Box sx={{ p: noPadding ? 0 : 2.5 }}>{children}</Box>
    </Paper>
  );
};
