import axios from 'axios';

let isInterceptorConfigured = false;

export function configureAxiosAuthInterceptor(): void {
  if (isInterceptorConfigured) return;
  isInterceptorConfigured = true;

  // Request Interceptor: Attach Bearer token to all outgoing requests
  axios.interceptors.request.use(
    (config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('mavrix_auth_token');
        if (token) {
          config.headers = config.headers || {};
          // Only add Authorization if not already explicitly provided
          if (!config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token.trim()}`;
          }
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response Interceptor: Gracefully handle 401 session expiration
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // If an API rejected an expired token, clear it
        const url = error.config?.url || '';
        if (!url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
          console.warn('[Axios] 401 Unauthorized received for:', url);
        }
      }
      return Promise.reject(error);
    }
  );
}

// Automatically configure on import
configureAxiosAuthInterceptor();
