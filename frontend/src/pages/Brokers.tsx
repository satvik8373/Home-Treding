import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress
} from '@mui/material';
import { Add as AddIcon, Refresh, Shield, AccountBalance } from '@mui/icons-material';
import Layout from '../components/Layout';
import { DhanConnectionCard } from '../components/brokers/DhanConnectionCard';
import { ConnectDhanModal } from '../components/brokers/ConnectDhanModal';
import { brokerApi, BrokerSummary } from '../services/brokerApi';
import { PageHeader, StatCard, SectionCard, StatusBadge } from '../components/ui';

const Brokers: React.FC = () => {
  const [brokers, setBrokers] = useState<BrokerSummary[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrokers();
    const interval = setInterval(fetchBrokers, 20000);
    return () => clearInterval(interval);
  }, []);

  const fetchBrokers = async () => {
    try {
      const list = await brokerApi.getBrokers();
      setBrokers(list);
    } catch (error) {
      console.error('Failed to fetch brokers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBrokerAdded = (newBroker: BrokerSummary) => {
    setBrokers((prev) => {
      const exists = prev.some(b => b.id === newBroker.id);
      if (exists) {
        return prev.map(b => b.id === newBroker.id ? newBroker : b);
      }
      return [...prev, newBroker];
    });
    setShowAddModal(false);
  };

  const handleBrokerDeleted = (brokerId: string) => {
    setBrokers((prev) => prev.filter(b => b.id !== brokerId));
  };

  const connectedCount = brokers.filter(b => b.status === 'Connected').length;

  return (
    <Layout>
      <Box sx={{ maxWidth: '100%' }}>
        {/* Unified Page Header */}
        <PageHeader
          title="Broker Integrations"
          subtitle="Connect and manage live DhanHQ v2 broker accounts and execution gateways"
          badge={<StatusBadge status={connectedCount > 0 ? 'live' : 'paper'} dot pulse label={connectedCount > 0 ? 'DHAN CONNECTED' : 'STANDBY'} />}
          action={
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh sx={{ fontSize: 16 }} />}
                onClick={fetchBrokers}
                disabled={loading}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderRadius: 2, borderColor: '#e2e8f0', color: '#475569' }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={() => setShowAddModal(true)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  px: 2,
                  borderRadius: 2,
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#1e293b' }
                }}
              >
                Connect Dhan
              </Button>
            </Box>
          }
        />

        {/* Minimal Metric Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          <StatCard
            label="Connected Accounts"
            value={`${connectedCount} Active`}
            subtext="DhanHQ v2 Feed"
            icon={<AccountBalance sx={{ fontSize: 18 }} />}
          />

          <StatCard
            label="API Token Security"
            value="AES-256-GCM"
            subtext="Encrypted At Rest"
            color="#16a34a"
            icon={<Shield sx={{ fontSize: 18 }} />}
          />

          <StatCard
            label="Execution Status"
            value={connectedCount > 0 ? 'Ready' : 'Paper Mode'}
            subtext="Live / Virtual Gateway"
            color={connectedCount > 0 ? '#16a34a' : '#b45309'}
            icon={<AccountBalance sx={{ fontSize: 18 }} />}
          />
        </Box>

        {/* Broker Connection Cards Grid */}
        <SectionCard title="Configured Broker Accounts" subtitle="Active DhanHQ API credentials and terminal gateways">
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} sx={{ color: '#0f172a' }} />
            </Box>
          ) : brokers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5, fontWeight: 600 }}>
                No broker account connected yet
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setShowAddModal(true)}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a' }}
              >
                Connect Dhan Account
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
              {brokers.map((broker) => (
                <DhanConnectionCard
                  key={broker.id}
                  broker={broker}
                  onDisconnect={handleBrokerDeleted}
                  onRefresh={fetchBrokers}
                />
              ))}
            </Box>
          )}
        </SectionCard>

        {/* Connect Dhan Modal */}
        <ConnectDhanModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleBrokerAdded}
        />
      </Box>
    </Layout>
  );
};

export default Brokers;