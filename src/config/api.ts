// Centralized API configuration for Mavrix Trading Platform
const stripTrailingSlash = (url: string) => (url || '').replace(/\/$/, '');

// Production API URL
export const PRODUCTION_API_URL = 'https://home-treding-api.vercel.app';
export const LOCAL_API_URL = 'http://localhost:5000';

// Resolve appropriate API URL dynamically
export const getApiUrl = (): string => {
  if (process.env.REACT_APP_API_BASE_URL && !process.env.REACT_APP_API_BASE_URL.includes('localhost')) {
    return process.env.REACT_APP_API_BASE_URL;
  }

  // If running in browser and not on localhost, use same origin
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      return window.location.origin;
    }
  }

  return process.env.NODE_ENV === 'production' ? '' : LOCAL_API_URL;
};

export const getWsUrl = (): string => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      if (!process.env.REACT_APP_WEBSOCKET_URL || process.env.REACT_APP_WEBSOCKET_URL.includes('localhost')) {
        return PRODUCTION_API_URL;
      }
    }
  }

  if (process.env.REACT_APP_WEBSOCKET_URL) {
    return process.env.REACT_APP_WEBSOCKET_URL;
  }

  return process.env.NODE_ENV === 'production' ? PRODUCTION_API_URL : LOCAL_API_URL;
};

const isServerlessEnvironment = (): boolean => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('vercel.app')) return true;
  }
  const apiUrl = getApiUrl();
  return apiUrl.includes('vercel.app');
};

export const API_CONFIG = {
  BASE_URL: stripTrailingSlash(getApiUrl()),
  WS_URL: stripTrailingSlash(getWsUrl()),
  // Vercel serverless functions do not support persistent WebSockets
  ENABLE_WEBSOCKETS: !isServerlessEnvironment() && process.env.REACT_APP_ENABLE_WEBSOCKETS === 'true',
  IS_SERVERLESS: isServerlessEnvironment()
};

// Log configuration on load
if (typeof window !== 'undefined') {
  console.log('🔧 Mavrix API Config:', {
    NODE_ENV: process.env.NODE_ENV,
    BASE_URL: API_CONFIG.BASE_URL,
    HOSTNAME: window.location.hostname,
    ENABLE_WEBSOCKETS: API_CONFIG.ENABLE_WEBSOCKETS
  });
}

export default API_CONFIG;
