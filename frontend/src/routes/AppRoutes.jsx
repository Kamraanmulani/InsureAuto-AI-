import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ClaimsDashboardPage from '../pages/ClaimsDashboardPage';
import ClaimsListPage from '../pages/ClaimsListPage';
import ClaimSubmissionPage from '../pages/ClaimSubmissionPage';
import ClaimDetailPage from '../pages/ClaimDetailPage';
import CustomersPage from '../pages/CustomersPage';
import PoliciesPage from '../pages/PoliciesPage';
import ReportsPage from '../pages/ReportsPage';
import SettingsPage from '../pages/SettingsPage';

const AppRoutes = () => {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ClaimsDashboardPage />} />
        <Route path="/claims" element={<ClaimsListPage />} />
        <Route path="/claims/new" element={<ClaimSubmissionPage />} />
        <Route path="/submit" element={<ClaimSubmissionPage />} />
        <Route path="/claims/:jobId" element={<ClaimDetailPage />} />
        <Route path="/claim/:jobId" element={<ClaimDetailPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayout>
  );
};

export default AppRoutes;
