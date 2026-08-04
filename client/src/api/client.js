import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Attach the JWT token to every request automatically, if we have one
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('occ_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;