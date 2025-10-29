import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
      light: '#8b9cf6',
      dark: '#4c63d2',
    },
    secondary: {
      main: '#764ba2',
      light: '#9b6ec9',
      dark: '#5a3a7d',
    },
    error: {
      main: '#f56565',
    },
    warning: {
      main: '#ed8936',
    },
    info: {
      main: '#4299e1',
    },
    success: {
      main: '#48bb78',
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff',
    },
    text: {
      primary: '#2d3748',
      secondary: '#718096',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '2rem',
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.5rem',
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.25rem',
      '@media (max-width:600px)': {
        fontSize: '1.1rem',
      },
    },
    body1: {
      fontSize: '1rem',
      '@media (max-width:600px)': {
        fontSize: '0.9rem',
      },
    },
    body2: {
      fontSize: '0.875rem',
      '@media (max-width:600px)': {
        fontSize: '0.8rem',
      },
    },
  },
  shape: {
    borderRadius: 12,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '10px 20px',
          boxShadow: 'none',
          '@media (max-width:600px)': {
            padding: '8px 16px',
            fontSize: '0.875rem',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #5568d3 0%, #63408a 100%)',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderRadius: 16,
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          },
          '@media (max-width:600px)': {
            borderRadius: 12,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            padding: '8px 4px',
            fontSize: '0.8rem',
          },
        },
      },
    },
  },
});
