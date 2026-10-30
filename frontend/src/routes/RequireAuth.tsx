import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { Role } from '../api/backend';
import { homePathFor, useAuthStore } from '../store/useAuthStore';

export const FullScreenLoader: React.FC<{ label?: string }> = ({ label = 'Restoring session…' }) => (
  <div className="min-h-screen bg-ops-base flex items-center justify-center text-gray-400 text-xs gap-2">
    <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
    <span>{label}</span>
  </div>
);

/**
 * Gate for authenticated areas. Sends anonymous users to /login, users with a temporary
 * password to /change-password, and users of the wrong role to their own home.
 * (The backend enforces all of this again — this is only navigation.)
 */
export const RequireAuth: React.FC<{ roles: Role[] }> = ({ roles }) => {
  const location = useLocation();
  const { status, user } = useAuthStore();

  if (status === 'loading') return <FullScreenLoader />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
};
