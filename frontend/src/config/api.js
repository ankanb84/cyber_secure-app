// API Configuration - use localhost only
const getApiBaseUrl = () => {
  // In production (served by backend), use relative path
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }

  // In production, use environment variable
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Always use localhost for local development
  return 'http://localhost:5000/api';
};

const getSocketUrl = () => {
  // In production (served by backend), use relative path
  if (process.env.NODE_ENV === 'production') {
    return '/';
  }

  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }

  // Always use localhost for local development
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();
export const SOCKET_URL = getSocketUrl();
