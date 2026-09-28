import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Route guard enforcing authentication and role-based permissions (RBAC).
 * Handles loading, unauthenticated redirection, and role denials.
 */
export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, role, isLoading } = useAuth();
  const location = useLocation();

  // Show accessible loading spinner while session restores from MongoDB
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: '1rem',
          color: 'var(--text-secondary)',
        }}
      >
        <Loader2 size={32} className="spin" style={{ color: 'var(--accent-primary)' }} />
        <span style={{ fontSize: '0.92rem' }}>Verifying authenticated session...</span>
      </div>
    );
  }

  // If unauthenticated, redirect to appropriate login portal
  if (!isAuthenticated || !user) {
    const isAdminRoute = allowedRoles.includes('EVENTADMIN');
    return <Navigate to={isAdminRoute ? '/admin/login' : '/login'} state={{ from: location }} replace />;
  }

  // If role is restricted, deny access and route to user's authorized dashboard
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    if (role === 'EVENTADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/student/dashboard" replace />;
  }

  return children;
};
