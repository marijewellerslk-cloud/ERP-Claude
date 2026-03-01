import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies
});

// Flag to prevent multiple simultaneous logouts
let isLoggingOut = false;

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // If already logging out, don't try to refresh again
      if (isLoggingOut) {
        return Promise.reject(error);
      }

      // Skip refresh for login/register requests — they don't need token refresh
      const requestUrl = originalRequest.url || '';
      if (requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register')) {
        return Promise.reject(error);
      }

      // Check if we have an access token - if not, don't try to refresh
      const hasAccessToken = !!localStorage.getItem('accessToken');
      if (!hasAccessToken) {
        return Promise.reject(error);
      }

      try {
        // Try to refresh the token
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // Save new access token
        localStorage.setItem('accessToken', data.data.accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear auth and redirect, but only once
        if (!isLoggingOut) {
          isLoggingOut = true;

          localStorage.removeItem('accessToken');
          localStorage.removeItem('auth-storage');

          setTimeout(() => {
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.replace('/login');
            }
            setTimeout(() => { isLoggingOut = false; }, 1000);
          }, 100);
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;
