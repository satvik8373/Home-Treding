import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { InboxOutlined } from '@mui/icons-material';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  compact = false
}) => {
  const resolvedAction = action ?? (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: compact ? 4 : 7,
        px: 3,
        textAlign: 'center',
        gap: 1
      }}
    >
      <Box
        sx={{
          width: compact ? 40 : 52,
          height: compact ? 40 : 52,
          borderRadius: 2,
          bgcolor: '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 0.5,
          color: '#94a3b8'
        }}
      >
        {icon ?? <InboxOutlined sx={{ fontSize: compact ? 22 : 28 }} />}
      </Box>

      <Typography
        sx={{
          fontWeight: 700,
          color: '#475569',
          fontSize: compact ? '0.84rem' : '0.92rem',
          lineHeight: 1.3
        }}
      >
        {title}
      </Typography>

      {description && (
        <Typography
          sx={{
            color: '#94a3b8',
            fontSize: compact ? '0.75rem' : '0.8rem',
            maxWidth: 320,
            lineHeight: 1.5
          }}
        >
          {description}
        </Typography>
      )}

      {resolvedAction && (
        <Button
          variant="outlined"
          size="small"
          onClick={resolvedAction.onClick}
          sx={{
            mt: 1,
            textTransform: 'none',
            borderRadius: 2,
            fontWeight: 600,
            fontSize: '0.78rem',
            borderColor: '#e2e8f0',
            color: '#475569',
            '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' }
          }}
        >
          {resolvedAction.label}
        </Button>
      )}
    </Box>
  );
};
