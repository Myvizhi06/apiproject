/**
 * API Sentinel - Centralized API Service Client
 */

import axios from 'axios';

const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api = axios.create({
  baseURL: BACKEND_URL ? `${BACKEND_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sentinel_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401s gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isAuthPath = error.config.url.includes('/auth/login') || error.config.url.includes('/auth/register');
      if (!isAuthPath) {
        localStorage.removeItem('sentinel_token');
        localStorage.removeItem('sentinel_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

export const workflowAPI = {
  list: () => api.get('/workflows'),
  get: (id) => api.get(`/workflows/${id}`),
  create: (data) => api.post('/workflows', data),
  update: (id, data) => api.put(`/workflows/${id}`, data),
  delete: (id) => api.delete(`/workflows/${id}`),
  reorder: (id, stepIds) => api.post(`/workflows/${id}/reorder`, { stepIds }),
  execute: (id, payload = {}) => api.post(`/workflows/${id}/execute`, payload),
};

export const aslAPI = {
  parse: (code) => api.post('/asl/parse', { code }),
  validate: (code) => api.post('/asl/validate', { code }),
  convert: (payload) => api.post('/asl/convert', payload),
  save: (data) => api.post('/asl/save', data),
};

export const executionAPI = {
  list: () => api.get('/executions'),
  get: (id) => api.get(`/executions/${id}`),
  cancel: (id) => api.post(`/executions/${id}/cancel`),
  failures: () => api.get('/executions/failures/all'),
};

export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

export const simulatorAPI = {
  getControl: () => api.get('/simulator/control'),
  setScenario: (data) => api.post('/simulator/control', data),
  reset: () => api.post('/simulator/reset'),
};

export default api;

