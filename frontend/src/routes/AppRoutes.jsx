import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../layouts/MainLayout';
import LoginPage from '../pages/LoginPage';
import ClaimsDashboardPage from '../pages/ClaimsDashboardPage';
import ClaimsListPage from '../pages/ClaimsListPage';
import ClaimSubmissionPage from '../pages/ClaimSubmissionPage';
import ClaimDetailPage from '../pages/ClaimDetailPage';
import CustomersPage from '../pages/CustomersPage';
import PoliciesPage from '../pages/PoliciesPage';
import ReportsPage from '../pages/ReportsPage';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xs text-slate-500">Verifying session credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ClaimsDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/claims"
        element={
          <ProtectedRoute>
            <ClaimsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/claims/new"
        element={
          <ProtectedRoute>
            <ClaimSubmissionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/submit"
        element={
          <ProtectedRoute>
            <ClaimSubmissionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/claims/:jobId"
        element={
          <ProtectedRoute>
            <ClaimDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/claim/:jobId"
        element={
          <ProtectedRoute>
            <ClaimDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <CustomersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/policies"
        element={
          <ProtectedRoute>
            <PoliciesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
