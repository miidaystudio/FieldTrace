import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Navigation,
  Users,
  ClipboardList,
  CheckCircle2,
  Shield,
  History,
  AlertTriangle,
  TrendingUp,
  FileClock,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { useAuthStore, userAvatar } from '../../store/useAuthStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: number;
  adminOnly?: boolean;
}

export const Sidebar: React.FC = () => {
  const anomalies = useFleetStore((state) => state.anomalies);
  const openAnomaliesCount = anomalies.filter((a) => a.status === 'open' || a.status === 'acknowledged').length;

  const user = useAuthStore((state) => state.user);
  const organization = useAuthStore((state) => state.organization);
  const logout = useAuthStore((state) => state.logout);
  const isAdmin = user?.role === 'admin';

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: NavItem[] = [
    {
      to: '/dashboard',
      label: 'Operations Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
      exact: true,
    },
    {
      to: '/dashboard/live',
      label: 'Live Fleet Radar',
      icon: <Navigation className="w-4 h-4" />,
    },
    {
      to: '/dashboard/agents',
      label: 'Field Staff Roster',
      icon: <Users className="w-4 h-4" />,
    },
    {
      to: '/dashboard/tasks',
      label: 'Tasks & Dispatches',
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      to: '/dashboard/visits',
      label: 'Proof-of-Visit Audit',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      to: '/dashboard/geofences',
      label: 'Geofence Site Hub',
      icon: <Shield className="w-4 h-4" />,
    },
    {
      to: '/dashboard/replay',
      label: 'Route Replay Scrubber',
      icon: <History className="w-4 h-4" />,
    },
    {
      to: '/dashboard/anomalies',
      label: 'AI Anomaly Center',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: openAnomaliesCount > 0 ? openAnomaliesCount : undefined,
    },
    {
      to: '/dashboard/analytics',
      label: 'Operations Analytics',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      to: '/dashboard/audit-logs',
      label: 'Immutable Audit Trail',
      icon: <FileClock className="w-4 h-4" />,
      adminOnly: true,
    },
    {
      to: '/dashboard/settings',
      label: 'Platform Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="bg-[#161920] border border-white/[0.05] rounded-full py-4 px-2 flex flex-col items-center justify-between gap-3 shadow-2xl select-none max-h-[92vh]">
      {/* Top Nav Items */}
      <div className="flex flex-col items-center gap-2 overflow-y-auto overflow-x-hidden py-1 px-0.5 scrollbar-none">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              title={item.label}
              className={({ isActive }) =>
                `w-10 h-10 rounded-full flex items-center justify-center transition-all relative ${
                  isActive
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#8E96A4] hover:text-white hover:bg-white/[0.06]'
                }`
              }
            >
              {item.icon}
              {item.badge && item.badge > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#E11D48] rounded-full border-2 border-[#161920]" />
              )}
            </NavLink>
          ))}
      </div>

      {/* Bottom Separator & User Avatar */}
      <div className="pt-2 border-t border-white/[0.05] flex flex-col items-center gap-2 relative" ref={userMenuRef}>
        <NavLink
          to="/"
          title="Public Landing Demo"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#8E96A4] hover:text-white hover:bg-white/[0.06] transition-all"
        >
          <Sparkles className="w-4 h-4 text-[#D97706]" />
        </NavLink>

        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-10 h-10 rounded-full p-0.5 border border-white/[0.08] hover:border-white/30 transition-all focus:outline-none overflow-hidden"
          title={`${user?.name ?? 'Account'} (${user?.role})`}
        >
          <img
            src={userAvatar(user)}
            alt={user?.name ?? 'User'}
            className="w-full h-full rounded-full object-cover"
          />
        </button>

        {/* User Popover Menu */}
        {userMenuOpen && (
          <div className="absolute left-14 bottom-0 w-56 bg-[#161920] border border-white/[0.08] rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="pb-2.5 border-b border-white/[0.05] mb-2">
              <div className="font-bold text-xs text-white truncate">{user?.name}</div>
              <div className="text-[10px] text-[#8E96A4] truncate font-mono mt-0.5">
                {user?.role} · {organization?.name}
              </div>
            </div>
            <button
              onClick={() => {
                setUserMenuOpen(false);
                void logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-300 hover:text-white hover:bg-[#E11D48]/20 rounded-xl transition-colors font-medium text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
