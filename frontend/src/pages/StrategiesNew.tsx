import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import Layout from '../components/Layout';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const StrategiesNew: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const strategies = [
    {
      id: 1,
      name: 'Advanced Delta Neutral',
      author: 'ARK28221',
      startTime: '09:22',
      endTime: '16:11',
      segmentType: 'OPTION',
      strategyType: 'Time Based',
      instruments: ['SITI_NIFTY_BANK_ANALYST', 'SITI_NIFTY_BANK_ANALYST+'],
      status: 'active'
    }
  ];

  const templates = [
    {
      id: 1,
      name: 'Advanced Delta Neutral',
      maxDD: '0.00',
      margin: '60.00',
      chart: '/chart1.png'
    },
    {
      id: 2,
      name: '1 % SL strangle BNF',
      maxDD: '0.00',
      margin: '60.00',
      chart: '/chart2.png'
    },
    {
      id: 3,
      name: '1.5 % SL Strangle BN...',
      maxDD: '0.00',
      margin: '60.00',
      chart: '/chart3.png'
    }
  ];

  return (
    <Layout>
      <Box sx={{ bgcolor: 'white', minHeight: '100vh', p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
            Strategies
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{
                bgcolor: '#4c6ef5',
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
                '&:hover': { bgcolor: '#3b5bdb' }
              }}
            >
              GO GO
            </Button>
            <IconButton sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
              <FilterIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 500,
                color: '#666',
                minHeight: 48,
                '&.Mui-selected': {
                  color: '#4c6ef5',
                  fontWeight: 600
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#4c6ef5',
                height: 3,
                borderRadius: '3px 3px 0 0'
              }
            }}
          >
            <Tab label="Create Strategy" />
            <Tab label="My Strategies" />
            <Tab label="Deployed Strategies" />
            <Tab label="Strategy Template" />
            <Tab label="My Portfolio" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ maxWidth: 800 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Strategy Type
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
              <Chip
                label="Time Based"
                sx={{
                  bgcolor: '#e7f5ff',
                  color: '#1971c2',
                  fontWeight: 500,
                  px: 2,
                  py: 2.5,
                  fontSize: '0.9rem',
                  '&:hover': { bgcolor: '#d0ebff' }
                }}
              />
              <Chip
                label="Indicator Based"
                variant="outlined"
                sx={{
                  borderColor: '#dee2e6',
                  color: '#666',
                  fontWeight: 500,
                  px: 2,
                  py: 2.5,
                  fontSize: '0.9rem'
                }}
              />
            </Box>

            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Select Instruments
            </Typography>
            <Card
              sx={{
                border: '2px dashed #dee2e6',
                bgcolor: '#f8f9fa',
                boxShadow: 'none',
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { borderColor: '#4c6ef5', bgcolor: '#f1f3f5' }
              }}
            >
              <AddIcon sx={{ fontSize: 40, color: '#adb5bd', mb: 1 }} />
              <Typography sx={{ color: '#495057', fontWeight: 500 }}>
                Add Instruments
              </Typography>
            </Card>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {strategies.length > 0 ? (
            <Box>
              <TextField
                placeholder="Search Strategies"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ mb: 3, maxWidth: 400 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#adb5bd' }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2, bgcolor: '#f8f9fa' }
                }}
              />
              {strategies.map((strategy) => (
                <Card
                  key={strategy.id}
                  sx={{
                    mb: 2,
                    p: 3,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    border: '1px solid #f1f3f5'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {strategy.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#868e96', mb: 2 }}>
                        By {strategy.author}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                            Start Time
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {strategy.startTime}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                            End Time
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {strategy.endTime}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                            Segment Type
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {strategy.segmentType}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                            Strategy Type
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {strategy.strategyType}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {strategy.instruments.map((inst, idx) => (
                          <Chip
                            key={idx}
                            label={inst}
                            size="small"
                            sx={{
                              bgcolor: '#f1f3f5',
                              color: '#495057',
                              fontSize: '0.75rem'
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{
                          textTransform: 'none',
                          borderRadius: 2,
                          borderColor: '#4c6ef5',
                          color: '#4c6ef5'
                        }}
                      >
                        Back Test
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        sx={{
                          textTransform: 'none',
                          borderRadius: 2,
                          bgcolor: '#4c6ef5',
                          '&:hover': { bgcolor: '#3b5bdb' }
                        }}
                      >
                        Deploy
                      </Button>
                      <IconButton size="small">
                        <MoreIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Card>
              ))}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" sx={{ color: '#868e96', mb: 1 }}>
                No Strategies Yet
              </Typography>
              <Typography variant="body2" sx={{ color: '#adb5bd', mb: 3 }}>
                Create your first strategy to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{
                  bgcolor: '#4c6ef5',
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 3
                }}
              >
                Create Strategy
              </Button>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box
              component="img"
              src="/empty-state.svg"
              sx={{ width: 200, height: 200, mb: 3, opacity: 0.6 }}
            />
            <Typography variant="h6" sx={{ color: '#868e96', mb: 1 }}>
              No Deployed Strategy
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{
                bgcolor: '#4c6ef5',
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
                mt: 2
              }}
            >
              Create Strategy
            </Button>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <TextField
              placeholder="Search Strategies"
              size="small"
              sx={{ maxWidth: 400 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#adb5bd' }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2, bgcolor: '#f8f9fa' }
              }}
            />
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                borderColor: '#dee2e6',
                color: '#495057'
              }}
            >
              Filter
            </Button>
          </Box>

          <Grid container spacing={3}>
            {templates.map((template) => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card
                  sx={{
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    border: '1px solid #f1f3f5',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <Box
                    sx={{
                      height: 150,
                      bgcolor: '#f8f9fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: '1px solid #f1f3f5'
                    }}
                  >
                    <AssessmentIcon sx={{ fontSize: 60, color: '#dee2e6' }} />
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                      {template.name}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                          Max DD
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#51cf66' }}>
                          {template.maxDD}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#868e96', display: 'block' }}>
                          Margin
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#51cf66' }}>
                          {template.margin}
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                        borderColor: '#4c6ef5',
                        color: '#4c6ef5',
                        '&:hover': { bgcolor: '#e7f5ff' }
                      }}
                    >
                      Add to my strategy
                    </Button>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box
              component="img"
              src="/empty-portfolio.svg"
              sx={{ width: 200, height: 200, mb: 3, opacity: 0.6 }}
            />
            <Typography variant="h6" sx={{ color: '#868e96', mb: 1 }}>
              No Portfolio summary. Create Bucket!
            </Typography>
          </Box>
        </TabPanel>
      </Box>
    </Layout>
  );
};

export default StrategiesNew;
