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

export const claimAPI = {
  submitClaim: async (formData, onUploadProgress) => {
    const response = await api.post('/claims/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 240000,
      onUploadProgress
    });
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

  overrideDecision: async (jobId, newRecommendation, reason, assessorId) => {
    const response = await api.patch(`/claims/${jobId}/override`, {
      newRecommendation,
      reason,
      assessorId
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
  }
};

export default api;
