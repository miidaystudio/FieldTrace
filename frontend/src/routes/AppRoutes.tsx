import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { LandingPage } from '../pages/landing/LandingPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { ChangePasswordPage } from '../pages/auth/ChangePasswordPage';
import { Overview } from '../pages/dashboard/Overview';
import { LiveFleet } from '../pages/dashboard/LiveFleet';
import { FieldAgents } from '../pages/dashboard/FieldAgents';
import { TasksAssignments } from '../pages/dashboard/TasksAssignments';
import { VisitsAudit } from '../pages/dashboard/VisitsAudit';
import { RouteReplay } from '../pages/dashboard/RouteReplay';
import { Geofences } from '../pages/dashboard/Geofences';
import { AnomalyCenter } from '../pages/dashboard/AnomalyCenter';
import { Analytics } from '../pages/dashboard/Analytics';
import { AuditLogs } from '../pages/dashboard/AuditLogs';
import { Settings } from '../pages/dashboard/Settings';
import { DriverPortal } from '../pages/driver/DriverPortal';
import { useAuthStore } from '../store/useAuthStore';
import { RequireAuth } from './RequireAuth';

export const AppRoutes: React.FC = () => {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  // Restore the session from the httpOnly refresh cookie once on load.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* Driver PWA — field agents */}
      <Route element={<RequireAuth roles={['agent']} />}>
        <Route path="/driver" element={<DriverPortal />} />
      </Route>

      {/* Operations dashboard — admins and managers */}
      <Route element={<RequireAuth roles={['admin', 'manager']} />}>
        <Route path="/dashboard" element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="live" element={<LiveFleet />} />
          <Route path="agents" element={<FieldAgents />} />
          <Route path="tasks" element={<TasksAssignments />} />
          <Route path="visits" element={<VisitsAudit />} />
          <Route path="replay" element={<RouteReplay />} />
          <Route path="geofences" element={<Geofences />} />
          <Route path="anomalies" element={<AnomalyCenter />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Fallback redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
