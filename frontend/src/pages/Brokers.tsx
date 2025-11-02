import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    Button
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import Layout from '../components/Layout';
import BrokerCard from '../components/BrokerCard';
import AddBrokerForm from '../components/AddBrokerForm';
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
    lastActivity?: string;
    totalOrders?: number;
    activePositions?: number;
    connectedAt?: string;
    lastValidated?: string;
}

const Brokers: React.FC = () => {
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        fetchBrokers();
        
        // Auto-refresh broker status every 30 seconds
        const interval = setInterval(() => {
            fetchBrokers();
        }, 30000);
        
        return () => clearInterval(interval);
    }, []);

    const fetchBrokers = async () => {
        try {
            // Get current user ID
            const { auth } = await import('../config/firebase');
            const userId = auth.currentUser?.uid;
            
            // Fetch only user's brokers
            const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/broker/list${userId ? `?userId=${userId}` : ''}`);
            setBrokers(response.data.brokers || []);
        } catch (error) {
            console.error('Failed to fetch brokers:', error);
        }
    };



    const handleBrokerUpdate = (updatedBroker: Broker) => {
        setBrokers(brokers.map(broker =>
            broker.id === updatedBroker.id ? updatedBroker : broker
        ));
    };

    const handleBrokerDelete = (brokerId: string) => {
        setBrokers(brokers.filter(broker => broker.id !== brokerId));
    };

    const handleBrokerAdded = (newBroker: Broker) => {
        setBrokers([...brokers, newBroker]);
        setShowAddForm(false);
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



                    {brokers.length === 0 && (
                        <Card sx={{ textAlign: 'center', py: 6 }}>
                            <CardContent>
                                <Typography variant="h6" color="textSecondary" gutterBottom>
                                    No Brokers Connected
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                                    Connect your broker account to start live trading
                                </Typography>
                                <Button
                                    variant="outlined"
                                    startIcon={<AddIcon />}
                                    onClick={() => setShowAddForm(true)}
                                    size="large"
                                >
                                    Add Your First Broker
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {brokers.length > 0 && (
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                md: 'repeat(2, 1fr)',
                                lg: 'repeat(3, 1fr)'
                            },
                            gap: 3
                        }}>
                            {brokers.map((broker) => (
                                <BrokerCard
                                    key={broker.id}
                                    broker={broker}
                                    onUpdate={handleBrokerUpdate}
                                    onDelete={handleBrokerDelete}
                                />
                            ))}
                        </Box>
                    )}

                    {/* Add Broker Form Dialog */}
                    <AddBrokerForm
                        open={showAddForm}
                        onClose={() => setShowAddForm(false)}
                        onBrokerAdded={handleBrokerAdded}
                    />
                </Box>
            </Container>
        </Layout>
    );
};

export default Brokers;