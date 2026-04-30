import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api` 
  : '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Debug logging in development
if (import.meta.env.DEV) {
  console.log('[API] Using base URL:', API_BASE);
}

export default apiClient;
