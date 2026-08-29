import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  useMediaQuery,
  useTheme,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  TrendingUp,
  ContentCopy,
  Add,
  LayersClear
} from '@mui/icons-material';
import Layout from '../components/Layout';
import axios from 'axios';

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  timeframe: string;
  symbols?: string[];
  margin?: string;
  maxDrawdown?: string;
  winRate?: string;
  rules?: string[];
}

const StrategyTemplate: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/strategies/templates');
      if (res.data?.success && Array.isArray(res.data.templates)) {
        setTemplates(res.data.templates);
      } else {
        setTemplates([]);
      }
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (template: StrategyTemplate) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedTemplate(null);
  };

  const handleAddToMyStrategy = (template: StrategyTemplate) => {
    navigate('/strategies/create', {
      state: {
        fromTemplate: true,
        template: {
          name: `${template.name} (Custom)`,
          description: template.description,
          symbol: template.symbols?.[0] || 'NIFTY 50'
        }
      }
    });
  };

  return (
    <Layout>
      <Container
        maxWidth="xl"
        sx={{
          mt: { xs: 2, sm: 3, md: 4 },
          mb: { xs: 10, sm: 4 },
          px: { xs: 1, sm: 2, md: 3 }
        }}
      >
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={{ xs: 2, sm: 3, md: 4 }} flexWrap="wrap" gap={2}>
          <Box>
            <Typography
              variant="h4"
              component="h1"
              fontWeight="bold"
              gutterBottom
              sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
            >
              Strategy Templates
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
            >
              Explore and customize algorithmic trading strategy templates
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/strategies/create')}
            sx={{ fontWeight: 700 }}
          >
            Create Strategy
          </Button>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={8}>
            <CircularProgress />
          </Box>
        ) : templates.length === 0 ? (
          <Card
            sx={{
              p: 6,
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: 2
            }}
          >
            <LayersClear sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              No Strategy Templates Available
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
              All pre-configured strategy templates have been removed. Build and backtest your own custom algorithmic trading strategies using the Strategy Builder.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/strategies/create')}
              sx={{ fontWeight: 700 }}
            >
              Build Custom Strategy
            </Button>
          </Card>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: 3
            }}
          >
            {templates.map((tpl) => (
              <Card
                key={tpl.id}
                elevation={2}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)'
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                    <TrendingUp color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                      {tpl.name}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} mb={2}>
                    <Chip label={tpl.category} size="small" color="primary" variant="outlined" />
                    <Chip label={tpl.timeframe} size="small" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {tpl.description}
                  </Typography>
                  {tpl.rules && tpl.rules.length > 0 && (
                    <Box mt={2}>
                      <Typography variant="caption" fontWeight="bold" color="text.secondary">
                        Rules:
                      </Typography>
                      <Stack spacing={0.5} mt={0.5}>
                        {tpl.rules.slice(0, 3).map((r, i) => (
                          <Typography key={i} variant="caption" color="text.secondary">
                            • {r}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </CardContent>
                <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ flex: 1, textTransform: 'none', fontWeight: 600 }}
                    onClick={() => navigate(`/strategies/edit/${tpl.id}`)}
                  >
                    Edit / Customize
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ flex: 1, textTransform: 'none', fontWeight: 600 }}
                    onClick={() => navigate(`/backtest?strategyId=${tpl.id}`)}
                  >
                    Backtest
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ flex: 1, bgcolor: '#2563eb', fontWeight: 700, textTransform: 'none' }}
                    onClick={() => navigate('/strategies', { state: { deployTemplate: tpl.id } })}
                  >
                    Deploy
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}

        {/* Details Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          {selectedTemplate && (
            <>
              <DialogTitle sx={{ fontWeight: 'bold' }}>{selectedTemplate.name}</DialogTitle>
              <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {selectedTemplate.description}
                </Typography>
                {selectedTemplate.rules && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Rules & Logic
                    </Typography>
                    <Stack spacing={1}>
                      {selectedTemplate.rules.map((rule, idx) => (
                        <Typography key={idx} variant="body2">
                          {idx + 1}. {rule}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
              </DialogContent>
              <DialogActions sx={{ p: 2 }}>
                <Button onClick={handleCloseDialog}>Close</Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    handleAddToMyStrategy(selectedTemplate);
                    handleCloseDialog();
                  }}
                  startIcon={<ContentCopy />}
                >
                  Use Strategy
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Container>
    </Layout>
  );
};

export default StrategyTemplate;
