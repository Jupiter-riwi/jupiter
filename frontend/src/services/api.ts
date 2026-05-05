import axios from 'axios';

// Apex Vision API Gateway
export const api = axios.create({
  baseURL: 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  // Manejo de tokens y configuraciones por defecto
  return config;
});
