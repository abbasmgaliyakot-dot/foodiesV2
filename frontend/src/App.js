import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import LoginPage from '@/pages/LoginPage';
import StaffView from '@/pages/StaffView';
import ReceptionDashboard from '@/pages/ReceptionDashboard';
import AdminPanel from '@/pages/AdminPanel';
import HistoryPage from '@/pages/HistoryPage';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import '@/App.css';

const ProtectedRoute = ({ children, requireAdmin }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <StaffView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception"
        element={
          <ProtectedRoute>
            <ReceptionDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminPanel />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
            <SocketProvider>
              <AppRoutes />
              <Toaster position="top-center" />
            </SocketProvider>
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
