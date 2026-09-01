// Centralized API configuration for Mavrix Trading Platform
const stripTrailingSlash = (url: string) => (url || '').replace(/\/$/, '');

// Production API URL
export const PRODUCTION_API_URL = 'https://home-treding-api-satvik8373s-projects.vercel.app';
export const LOCAL_API_URL = 'http://localhost:5000';

// Resolve appropriate API URL dynamically
export const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      if (!process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_BASE_URL.includes('localhost')) {
        return PRODUCTION_API_URL;
      }
    }
  }

  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }

  return process.env.NODE_ENV === 'production' ? PRODUCTION_API_URL : LOCAL_API_URL;
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

export const API_CONFIG = {
  BASE_URL: stripTrailingSlash(getApiUrl()),
  WS_URL: stripTrailingSlash(getWsUrl()),
};

export default API_CONFIG;
