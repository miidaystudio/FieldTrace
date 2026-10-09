import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { SimulationController } from '../simulation/SimulationController';

export const AppShell: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ops-base font-sans text-gray-100">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Operations Canvas */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar />
        
        <main className="flex-1 overflow-y-auto bg-ops-base relative">
          <Outlet />
        </main>
      </div>

      {/* Floating Simulation Engine Controller */}
      <SimulationController />
    </div>
  );
};
