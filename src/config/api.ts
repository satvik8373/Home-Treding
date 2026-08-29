// Centralized API configuration
// Remove trailing slashes to prevent double slashes in URLs
const stripTrailingSlash = (url: string) => url.replace(/\/$/, '');

// Production API URL (hardcoded for reliability)
const PRODUCTION_API_URL = 'https://home-treding-api-satvik8373s-projects.vercel.app';
const LOCAL_API_URL = 'http://localhost:5000';

// Use production URL in production, local URL in development
const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_API_BASE_URL || PRODUCTION_API_URL;
  }
  return process.env.REACT_APP_API_BASE_URL || LOCAL_API_URL;
};

export const API_CONFIG = {
  BASE_URL: stripTrailingSlash(getApiUrl()),
  WS_URL: stripTrailingSlash(getApiUrl()),
};

// Log configuration on load
console.log('🔧 API Configuration:', {
  NODE_ENV: process.env.NODE_ENV,
  BASE_URL: API_CONFIG.BASE_URL,
  WS_URL: API_CONFIG.WS_URL,
  ENV_VAR: process.env.REACT_APP_API_BASE_URL,
  USING: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'
});

export default API_CONFIG;
