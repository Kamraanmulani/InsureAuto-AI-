import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const claimAPI = {
  // Submit new claim (supports both Photo and Walk-Around Video)
  submitClaim: async (formData, onUploadProgress) => {
    const response = await api.post('/claims/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 240000, // 4 minutes
      onUploadProgress
    });
    return response.data;
  },

  // Get all claims
  getClaims: async (filters = {}) => {
    const response = await api.get('/claims', { params: filters });
    return response.data;
  },

  // Get single claim
  getClaim: async (jobId) => {
    const response = await api.get(`/claims/${jobId}`);
    return response.data;
  },

  // Update claim status
  updateStatus: async (jobId, status, notes) => {
    const response = await api.patch(`/claims/${jobId}/status`, {
      status,
      assessorNotes: notes
    });
    return response.data;
  },

  // Override decision
  overrideDecision: async (jobId, newRecommendation, reason, assessorId) => {
    const response = await api.patch(`/claims/${jobId}/override`, {
      newRecommendation,
      reason,
      assessorId
    });
    return response.data;
  },

  // Get statistics
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
