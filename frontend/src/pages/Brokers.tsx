import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Alert
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import Layout from '../components/Layout';
import BrokerageForm from '../components/BrokerageForm';
import BrokerCard from '../components/BrokerCard';
import axios from 'axios';

interface Broker {
  id: string;
  broker: string;
  clientId: string;
  status: 'Connected' | 'Disconnected';
  accountName?: string;
  strategyPerformance?: string;
  terminalEnabled: boolean;
  tradingEngineEnabled: boolean;
}

const Brokers: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBrokers();
  }, []);

  const fetchBrokers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/broker/list');
      setBrokers(response.data.brokers || []);
    } catch (error) {
      console.error('Failed to fetch brokers:', error);
    }
  };

  const handleBrokerAdded = (newBroker: Broker) => {
    setBrokers([...brokers, newBroker]);
    setShowAddForm(false);
  };

  const handleBrokerUpdate = (updatedBroker: Broker) => {
    setBrokers(brokers.map(broker => 
      broker.id === updatedBroker.id ? updatedBroker : broker
    ));
  };

  const handleBrokerDelete = (brokerId: string) => {
    setBrokers(brokers.filter(broker => broker.id !== brokerId));
  };

  return (
    <Layout>
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" component="h1">
              🔗 Broker Connections
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddForm(true)}
              sx={{ px: 3 }}
            >
              Add Broker
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {showAddForm && (
            <Box sx={{ mb: 4 }}>
              <BrokerageForm
                onBrokerAdded={handleBrokerAdded}
                onCancel={() => setShowAddForm(false)}
              />
            </Box>
          )}

          {brokers.length === 0 && !showAddForm ? (
            <Card sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  No Brokers Connected
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Connect your first broker to start trading
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddForm(true)}
                >
                  Add Your First Broker
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {brokers.map((broker) => (
                <Grid item xs={12} md={6} lg={4} key={broker.id}>
                  <BrokerCard
                    broker={broker}
                    onUpdate={handleBrokerUpdate}
                    onDelete={handleBrokerDelete}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Container>
    </Layout>
  );
};

export default Brokers;