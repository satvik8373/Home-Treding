import { createTheme } from '@mui/material/styles';

/**
 * Mavrix Trading — Institutional Dark-Sidebar Theme
 * Identity: Deep navy sidebar (#0f172a) · Slate canvas (#f0f4f8) · White cards
 * Accent: Indigo-blue (#2563eb) · Profit: #16a34a · Loss: #dc2626
 * Rules: No gradients · No neon · No glassmorphism · No blinking
 */

// ── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  // Surfaces
  bgPage:        '#dde3ec',   // distinct blue-grey canvas — strong contrast so white cards are clearly visible
  bgCard:        '#ffffff',   // pure white elevated containers
  bgSidebar:     '#ffffff',   // clean white sidebar
  bgAppBar:      '#ffffff',   // clean white header bar

  // Primary accent — Institutional Indigo-Blue
  primary:       '#2563eb',   // blue-600
  primaryDark:   '#1d4ed8',   // blue-700
  primaryLight:  '#3b82f6',   // blue-500
  primaryBg:     '#eff6ff',   // blue-50 subtle tint

  // Semantic financial
  profit:        '#16a34a',   // green-700
  loss:          '#dc2626',   // red-600
  profitBg:      '#f0fdf4',   // green-50
  lossBg:        '#fef2f2',   // red-50

  // Text
  textPrimary:   '#0f172a',   // slate-900
  textSecondary: '#475569',   // slate-600
  textMuted:     '#64748b',   // slate-500
  textOnSidebar: '#64748b',   // secondary nav text on white sidebar

  // Borders
  border:        '#e2e8f0',   // slate-200 hairline
  borderLight:   '#f1f5f9',   // slate-100 divider

  // Sidebar nav states
  sidebarActiveText: '#ffffff',
  sidebarActiveBg:   '#2563eb',

  // Status
  info:    '#2563eb',
  warning: '#d97706',
  neutral: '#64748b',
};

export { T as ThemeTokens };

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:         T.primary,
      light:        T.primaryLight,
      dark:         T.primaryDark,
      contrastText: '#ffffff',
    },
    secondary: {
      main:         '#1e293b',
      light:        '#334155',
      dark:         '#0f172a',
      contrastText: '#ffffff',
    },
    error: {
      main:  '#dc2626',
      light: '#ef4444',
      dark:  '#b91c1c',
    },
    warning: {
      main:  '#d97706',
      light: '#f59e0b',
      dark:  '#b45309',
    },
    info: {
      main:  '#2563eb',
      light: '#3b82f6',
      dark:  '#1d4ed8',
    },
    success: {
      main:  '#16a34a',
      light: '#22c55e',
      dark:  '#15803d',
    },
    background: {
      default: T.bgPage,
      paper:   T.bgCard,
    },
    text: {
      primary:   T.textPrimary,
      secondary: T.textSecondary,
      disabled:  T.textMuted,
    },
    divider: T.border,
  },

  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.25rem',  lineHeight: 1.2, letterSpacing: '-0.025em' },
    h2: { fontWeight: 700, fontSize: '1.875rem', lineHeight: 1.25, letterSpacing: '-0.02em' },
    h3: { fontWeight: 600, fontSize: '1.5rem',   lineHeight: 1.3,  letterSpacing: '-0.015em' },
    h4: { fontWeight: 600, fontSize: '1.25rem',  lineHeight: 1.4,  letterSpacing: '-0.01em' },
    h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4,  letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, fontSize: '1rem',     lineHeight: 1.5,  letterSpacing: '-0.005em' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem',  lineHeight: 1.55 },
    caption: { fontSize: '0.75rem', lineHeight: 1.5, color: T.textMuted },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
  },

  shape: { borderRadius: 10 },

  breakpoints: {
    values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 },
  },

  shadows: [
    'none',
    '0 1px 2px 0 rgb(0 0 0 / 0.04)',
    '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
    '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
    '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.05)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',
  ] as any,

  components: {
    // ── Scrollbars ──────────────────────────────────────────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: T.bgPage,
          scrollbarWidth: 'thin',
          scrollbarColor: `#cbd5e1 ${T.borderLight}`,
          '&::-webkit-scrollbar': { width: '5px', height: '5px' },
          '&::-webkit-scrollbar-track': { background: T.borderLight },
          '&::-webkit-scrollbar-thumb': {
            background: '#cbd5e1',
            borderRadius: '4px',
            '&:hover': { background: '#94a3b8' },
          },
        },
      },
    },

    // ── Paper / Cards ───────────────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: T.bgCard,
          border: `1px solid ${T.border}`,
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
          borderRadius: 12,
        },
        elevation0: { boxShadow: 'none' },
        elevation1: { boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.04)' },
        elevation2: { boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.05)' },
        elevation3: { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)' },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: T.bgCard,
          border: `1px solid ${T.border}`,
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
          borderRadius: 12,
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px -2px rgb(0 0 0 / 0.09)',
            borderColor: '#cbd5e1',
          },
        },
      },
    },

    // ── AppBar ──────────────────────────────────────────────────────────────
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: T.bgAppBar,
          color: T.textPrimary,
          boxShadow: 'none',
          borderBottom: `1px solid ${T.border}`,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          boxShadow: 'none',
          color: '#0f172a',
        },
      },
    },

    // ── Buttons ─────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '7px 16px',
          fontSize: '0.84rem',
          boxShadow: 'none',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          '&:active': { transform: 'scale(0.98)' },
        },
        sizeSmall: { padding: '4px 12px', fontSize: '0.78rem', borderRadius: 7 },
        contained: {
          backgroundColor: T.primary,
          color: '#ffffff',
          '&:hover': { backgroundColor: T.primaryDark, boxShadow: '0 2px 6px rgb(37 99 235 / 0.25)' },
        },
        outlined: {
          borderColor: T.border,
          color: T.textSecondary,
          borderWidth: '1px',
          '&:hover': { borderColor: '#94a3b8', backgroundColor: T.borderLight, color: T.textPrimary },
        },
        text: {
          color: T.textSecondary,
          '&:hover': { backgroundColor: T.borderLight, color: T.textPrimary },
        },
      },
    },

    // ── Icon Buttons ────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'background-color 0.15s ease',
          '&:hover': { backgroundColor: T.borderLight },
        },
      },
    },

    // ── Tabs ────────────────────────────────────────────────────────────────
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: {
          backgroundColor: T.primary,
          height: 2,
          borderRadius: 2,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.84rem',
          color: T.textMuted,
          minHeight: 44,
          padding: '8px 16px',
          '&.Mui-selected': { color: T.primary, fontWeight: 700 },
          '&:hover': { color: T.textPrimary },
        },
      },
    },

    // ── Table ───────────────────────────────────────────────────────────────
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: T.borderLight,
          fontSize: '0.84rem',
          padding: '10px 12px',
        },
        head: {
          fontWeight: 700,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          backgroundColor: '#f8fafc',
          color: '#334155',
          borderColor: T.border,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.1s ease',
          '&:hover': { backgroundColor: '#f8fafc' },
          '&.MuiTableRow-head': { '&:hover': { backgroundColor: 'transparent' } },
        },
      },
    },

    // ── Form Elements ───────────────────────────────────────────────────────
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: T.bgCard,
            fontSize: '0.875rem',
            '& fieldset': { borderColor: T.border },
            '&:hover fieldset': { borderColor: '#94a3b8' },
            '&.Mui-focused fieldset': { borderColor: T.primary, borderWidth: '1.5px' },
          },
          '& .MuiInputLabel-root': { fontSize: '0.875rem' },
          '& .MuiInputLabel-root.Mui-focused': { color: T.primary },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.primary },
        },
      },
    },

    // ── Menu / MenuItem ─────────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.12)',
          padding: '4px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          fontSize: '0.84rem',
          fontWeight: 500,
          margin: '1px 0',
          '&:hover': { backgroundColor: T.primaryBg, color: T.primary },
          '&.Mui-selected': { backgroundColor: T.primaryBg, color: T.primary, fontWeight: 600 },
        },
      },
    },

    // ── Dialog ──────────────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          border: `1px solid ${T.border}`,
          boxShadow: '0 20px 40px -8px rgb(0 0 0 / 0.15)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontWeight: 700, fontSize: '1rem', padding: '20px 24px 12px' },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '8px 24px 16px' },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '12px 24px 20px', gap: '8px' },
      },
    },

    // ── Chip ────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
          fontSize: '0.75rem',
          height: 24,
          border: '1px solid transparent',
        },
      },
    },

    // ── Sidebar List Items (light white sidebar) ──────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 12px',
          transition: 'background-color 0.15s ease',
          color: '#334155',
          '&:hover': {
            backgroundColor: '#f1f5f9',
            color: '#0f172a',
          },
          '&.Mui-selected': {
            backgroundColor: '#2563eb',
            color: '#ffffff',
            '& .MuiListItemIcon-root': { color: '#ffffff' },
            '& .MuiListItemText-primary': { fontWeight: 700, color: '#ffffff' },
            '&:hover': { backgroundColor: '#1d4ed8' },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 32,
          color: '#64748b',
          '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: '0.84rem',
          fontWeight: 500,
          color: '#334155',
        },
      },
    },

    // ── Circular Progress ───────────────────────────────────────────────────
    MuiCircularProgress: {
      styleOverrides: {
        root: { color: T.primary },
      },
    },

    // ── Linear Progress ─────────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, backgroundColor: T.borderLight },
        bar: { borderRadius: 4, backgroundColor: T.primary },
      },
    },

    // ── Tooltip ─────────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1e293b',
          color: '#e2e8f0',
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: 6,
          padding: '6px 10px',
        },
        arrow: { color: '#1e293b' },
      },
    },

    // ── Bottom Navigation ───────────────────────────────────────────────────
    MuiBottomNavigation: {
      styleOverrides: {
        root: { backgroundColor: '#ffffff', borderTop: `1px solid ${T.border}` },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: T.textMuted,
          minWidth: 'auto',
          '&.Mui-selected': { color: T.primary },
        },
        label: {
          fontSize: '0.65rem',
          '&.Mui-selected': { fontSize: '0.65rem', fontWeight: 700 },
        },
      },
    },

    // ── Alert ───────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontSize: '0.84rem',
          border: `1px solid ${T.border}`,
          fontWeight: 500,
        },
      },
    },
  },
});
