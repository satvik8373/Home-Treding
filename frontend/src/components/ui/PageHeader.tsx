import React from 'react';
import { Box, Typography } from '@mui/material';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, badge, action }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 1.5,
        mb: 3
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.25rem', md: '1.45rem' }
            }}
          >
            {title}
          </Typography>
          {badge}
        </Box>
        {subtitle && (
          <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.82rem', mt: 0.2 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>{action}</Box>}
    </Box>
  );
};
