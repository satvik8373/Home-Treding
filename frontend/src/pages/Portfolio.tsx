import React from 'react';
import { Box } from '@mui/material';
import Layout from '../components/Layout';
import PortfolioDashboard from '../components/PortfolioDashboard';

const Portfolio: React.FC = () => {
  return (
    <Layout>
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        <PortfolioDashboard />
      </Box>
    </Layout>
  );
};

export default Portfolio;