import React from 'react';
import { Box, Typography, Container } from '@mui/material';
import Layout from '../components/Layout';

const TestPage: React.FC = () => {
  return (
    <Layout>
      <Container>
        <Box sx={{ py: 4 }}>
          <Typography variant="h4">
            🧪 Test Page - This should be visible
          </Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            If you can see this, the routing and layout are working correctly.
          </Typography>
        </Box>
      </Container>
    </Layout>
  );
};

export default TestPage;