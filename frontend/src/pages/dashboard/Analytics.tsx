import React from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import {
  TrendingUp,
  Activity,
  ShieldCheck,
  Zap,
  Gauge,
  Clock,
  Navigation,
  CheckCircle2,
  Calendar,
  Download,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const Analytics: React.FC = () => {
  const kpis = useFleetStore((state) => state.kpis);

  const hourlySpeeds = [
    { hour: '06:00', avg: 42, max: 68 },
    { hour: '08:00', avg: 28, max: 55 },
    { hour: '10:00', avg: 34, max: 62 },
    { hour: '12:00', avg: 31, max: 59 },
    { hour: '14:00', avg: 39, max: 71 },
    { hour: '16:00', avg: 25, max: 48 },
    { hour: '18:00', avg: 36, max: 65 },
  ];

  const dwellDistribution = [
    { range: '< 15 mins', percent: 45, count: 64 },
    { range: '15 - 30 mins', percent: 35, count: 50 },
    { range: '30 - 60 mins', percent: 15, count: 21 },
    { range: '> 60 mins', percent: 5, count: 7 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-teal" />
            <span>Operations & Fleet Analytics</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Kinematic velocity profiles, site dwell time distribution, and geofence compliance trends.
          </p>
        </div>

        <Button variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
          Export Intelligence PDF
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Fleet Compliance Rate"
          value={`${kpis.complianceScore}%`}
          change={+1.4}
          variant="emerald"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
        />
        <StatCard
          title="Avg Turnaround / Dwell"
          value="24.5 mins"
          subValue="Across 142 sites"
          change={-3.2}
          changeLabel="vs last week (faster)"
          variant="teal"
          icon={<Clock className="w-5 h-5 text-brand-teal" />}
        />
        <StatCard
          title="Total Telemetry Pings"
          value="1.84M"
          subValue="Zero dropped pings"
          variant="default"
          icon={<Activity className="w-5 h-5 text-cyan-400" />}
        />
        <StatCard
          title="Fuel / Battery Efficiency"
          value="94.2%"
          change={+0.8}
          variant="amber"
          icon={<Gauge className="w-5 h-5 text-amber-400" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Velocity Trend */}
        <Card
          header={
            <div className="flex items-center justify-between w-full">
              <span className="font-bold text-xs uppercase tracking-wider font-mono">
                Hourly Velocity & Congestion Profile (km/h)
              </span>
              <span className="text-[10px] text-gray-400 font-mono">San Francisco Sector</span>
            </div>
          }
        >
          <div className="space-y-4 pt-2">
            {hourlySpeeds.map((item) => (
              <div key={item.hour} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-400">{item.hour}</span>
                  <span className="text-white font-bold">
                    Avg: {item.avg} km/h <span className="text-gray-500 font-normal">(Max {item.max})</span>
                  </span>
                </div>
                <div className="w-full bg-ops-base h-2.5 rounded-full overflow-hidden border border-ops-border">
                  <div
                    className="h-full bg-gradient-to-r from-brand-teal to-emerald-400 rounded-full"
                    style={{ width: `${(item.avg / 80) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Dwell Time Histogram */}
        <Card
          header={
            <div className="flex items-center justify-between w-full">
              <span className="font-bold text-xs uppercase tracking-wider font-mono">
                Client Site Dwell Time Distribution
              </span>
              <span className="text-[10px] text-gray-400 font-mono">142 Visits Audited</span>
            </div>
          }
        >
          <div className="space-y-4 pt-2">
            {dwellDistribution.map((d) => (
              <div key={d.range} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-300 font-semibold">{d.range}</span>
                  <span className="text-brand-teal font-bold">{d.count} visits ({d.percent}%)</span>
                </div>
                <div className="w-full bg-ops-base h-2.5 rounded-full overflow-hidden border border-ops-border">
                  <div
                    className="h-full bg-brand-teal rounded-full"
                    style={{ width: `${d.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
