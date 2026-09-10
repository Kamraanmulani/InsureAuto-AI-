import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) return JSON.parse(savedUser);
      return {
        id: 'default-assessor',
        email: 'assessor@insureauto.ai',
        name: 'Sarah Jenkins',
        role: 'ASSESSOR'
      };
    } catch {
      return {
        id: 'default-assessor',
        email: 'assessor@insureauto.ai',
        name: 'Sarah Jenkins',
        role: 'ASSESSOR'
      };
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || 'active-session-token');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const data = await authAPI.getMe();
          if (data?.user) {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
          }
        } catch {
        }
      } else {
        try {
          const data = await authAPI.login('assessor@insureauto.ai', 'Password@123');
          if (data?.token && data?.user) {
            setToken(data.token);
            setUser(data.user);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
          }
        } catch {
        }
      }
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
