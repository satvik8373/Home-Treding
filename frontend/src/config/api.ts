// Centralized API configuration
// Remove trailing slashes to prevent double slashes in URLs
const stripTrailingSlash = (url: string) => url.replace(/\/$/, '');

export const API_CONFIG = {
  BASE_URL: stripTrailingSlash(process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'),
  WS_URL: stripTrailingSlash(process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:5000'),
};

// Log configuration on load (will be removed in production build if not used)
if (process.env.NODE_ENV === 'production') {
  console.log('🔧 API Configuration:', {
    BASE_URL: API_CONFIG.BASE_URL,
    WS_URL: API_CONFIG.WS_URL,
    ENV_VAR: process.env.REACT_APP_API_BASE_URL
  });
}

export default API_CONFIG;
