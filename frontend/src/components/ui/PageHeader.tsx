import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, badge, action }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 1.5,
        mb: 2.5,
        px: { xs: 2, sm: 2.5 },
        py: { xs: 1.5, sm: 2 },
        bgcolor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 2.5,
        boxShadow: '0 1px 3px 0 rgba(15,23,42,0.04)'
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
              fontSize: { xs: '1.1rem', md: '1.3rem' }
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
    </Paper>
  );
};
