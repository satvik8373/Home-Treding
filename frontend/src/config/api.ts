// Centralized API configuration
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000',
  WS_URL: process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:5000',
};

export default API_CONFIG;
