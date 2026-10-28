import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Navigation,
  CheckCircle2,
  History,
  Shield,
  AlertTriangle,
  Layers,
  ChevronRight,
  Radio,
  Sparkles,
  Users,
  ClipboardList,
  TrendingUp,
  FileClock,
  Settings,
  LogOut,
} from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { useAuthStore, userAvatar } from '../../store/useAuthStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: string;
  badgeColor?: string;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const anomalies = useFleetStore((state) => state.anomalies);
  const agents = useFleetStore((state) => state.agents);
  const openAnomaliesCount = anomalies.filter((a) => a.status === 'open' || a.status === 'acknowledged').length;
  const movingCount = agents.filter((a) => a.status === 'moving').length;

  const user = useAuthStore((state) => state.user);
  const organization = useAuthStore((state) => state.organization);
  const logout = useAuthStore((state) => state.logout);
  const isAdmin = user?.role === 'admin';

  const sections: NavSection[] = [
    {
      title: 'OPERATIONS',
      items: [
        {
          to: '/dashboard',
          label: 'Ops Overview',
          icon: <LayoutDashboard className="w-4 h-4" />,
          exact: true,
        },
        {
          to: '/dashboard/live',
          label: 'Live Fleet Radar',
          icon: <Navigation className="w-4 h-4 text-brand-teal" />,
          badge: `${movingCount} live`,
          badgeColor: 'bg-brand-teal/20 text-brand-teal border-brand-teal/30',
        },
        {
          to: '/dashboard/agents',
          label: 'Field Staff Roster',
          icon: <Users className="w-4 h-4 text-emerald-400" />,
        },
      ],
    },
    {
      title: 'EXECUTION & AUDITING',
      items: [
        {
          to: '/dashboard/tasks',
          label: 'Tasks & Work Orders',
          icon: <ClipboardList className="w-4 h-4 text-amber-400" />,
        },
        {
          to: '/dashboard/visits',
          label: 'Proof-of-Visit Audit',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        },
        {
          to: '/dashboard/geofences',
          label: 'Geofence Site Hub',
          icon: <Shield className="w-4 h-4 text-indigo-400" />,
        },
        {
          to: '/dashboard/replay',
          label: 'Route Replay Scrubber',
          icon: <History className="w-4 h-4 text-cyan-400" />,
        },
      ],
    },
    {
      title: 'SECURITY & INTELLIGENCE',
      items: [
        {
          to: '/dashboard/anomalies',
          label: 'AI Anomaly Center',
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
          badge: openAnomaliesCount > 0 ? `${openAnomaliesCount}` : undefined,
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
        },
        {
          to: '/dashboard/analytics',
          label: 'Operations Analytics',
          icon: <TrendingUp className="w-4 h-4 text-brand-teal" />,
        },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [
        {
          to: '/dashboard/audit-logs',
          label: 'Immutable Audit Trail',
          icon: <FileClock className="w-4 h-4 text-gray-400" />,
          adminOnly: true,
        },
        {
          to: '/dashboard/settings',
          label: 'Platform Settings',
          icon: <Settings className="w-4 h-4 text-gray-400" />,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-ops-panel border-r border-ops-border flex flex-col h-screen shrink-0 select-none">
      {/* Brand Logo */}
      <div className="p-4 border-b border-ops-border bg-ops-base/40 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-teal to-emerald-500 flex items-center justify-center text-ops-base font-black shadow-lg shadow-teal-950/50 group-hover:scale-105 transition-transform">
            <Radio className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5 font-sans">
              FLEETORA <span className="text-[10px] text-brand-teal font-mono px-1 py-0.2 bg-brand-teal/10 rounded border border-brand-teal/30">v2.4</span>
            </div>
            <div className="text-[10px] text-gray-400 tracking-wider font-mono">INTELLIGENCE OPS</div>
          </div>
        </NavLink>
      </div>

      {/* Structured Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {sections.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <div className="text-[10px] font-bold text-gray-400 px-3 uppercase tracking-wider font-mono">
              {sec.title}
            </div>
            {sec.items.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                    isActive
                      ? 'bg-brand-teal/15 text-white font-semibold border border-brand-teal/40 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-ops-card'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}

        {/* Separator / Field Endpoint */}
        <div className="pt-2 border-t border-ops-border/60">
          <div className="text-[10px] font-bold text-gray-400 px-3 uppercase tracking-wider mb-1 font-mono">
            MORE
          </div>

          <NavLink
            to="/"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-200 hover:bg-ops-card mt-0.5 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Public Landing Demo</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          </NavLink>
        </div>
      </div>

      {/* Signed-in User */}
      <div className="p-3 border-t border-ops-border bg-ops-base/50">
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-ops-card/80 border border-ops-border">
          <img
            src={userAvatar(user)}
            alt={user?.name ?? 'User'}
            className="w-8 h-8 rounded-full object-cover border border-brand-teal/40"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">{user?.name}</div>
            <div className="text-[10px] text-brand-teal font-mono capitalize truncate">
              {user?.role} · {organization?.name}
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-ops-hover"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
