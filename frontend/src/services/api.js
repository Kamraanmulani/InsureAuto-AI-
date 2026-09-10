import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export const claimAPI = {
  submitClaim: async (formData, onUploadProgress) => {
    const response = await api.post('/claims/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000,
      onUploadProgress
    });
    return response.data;
  },

  getProcessingStatus: async (jobId) => {
    const response = await api.get(`/claims/${jobId}/processing-status`);
    return response.data;
  },

  retryProcessing: async (jobId) => {
    const response = await api.post(`/claims/${jobId}/retry`);
    return response.data;
  },

  getClaims: async (filters = {}) => {
    const response = await api.get('/claims', { params: filters });
    return response.data;
  },

  getClaim: async (jobId) => {
    const response = await api.get(`/claims/${jobId}`);
    return response.data;
  },

  updateStatus: async (jobId, status, notes) => {
    const response = await api.patch(`/claims/${jobId}/status`, {
      status,
      assessorNotes: notes
    });
    return response.data;
  },

  overrideDecision: async (jobId, newRecommendation, reason) => {
    const response = await api.patch(`/claims/${jobId}/override`, {
      newRecommendation,
      reason
    });
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/claims/stats/summary');
    return response.data;
  }
};

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  getUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },

  updateUserRole: async (userId, data) => {
    const response = await api.patch(`/auth/users/${userId}`, data);
    return response.data;
  }
};

export default api;
