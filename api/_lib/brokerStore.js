// Shared broker storage for serverless functions
// In production, this should use a database like MongoDB, PostgreSQL, or Redis

const brokers = new Map();

// Load from environment or external storage
function loadBrokers() {
  // In serverless, state is ephemeral
  // You should use a database for persistent storage
  return brokers;
}

function saveBroker(broker) {
  brokers.set(broker.id, broker);
  return broker;
}

function getBroker(id) {
  return brokers.get(id);
}

function getAllBrokers() {
  return Array.from(brokers.values());
}

function deleteBroker(id) {
  return brokers.delete(id);
}

module.exports = {
  loadBrokers,
  saveBroker,
  getBroker,
  getAllBrokers,
  deleteBroker
};
