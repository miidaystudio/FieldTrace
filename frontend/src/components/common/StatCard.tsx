import React from 'react';
import { twMerge } from 'tailwind-merge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: number; // e.g. +4.2 or -1.5
  changeLabel?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'teal' | 'emerald' | 'amber' | 'rose';
  className?: string;
  chartMini?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subValue,
  change,
  changeLabel = 'vs last shift',
  icon,
  variant = 'default',
  className,
  chartMini,
}) => {
  const accentColors = {
    default: 'text-gray-400 bg-slate-800/40 border-slate-700/50',
    teal: 'text-brand-teal bg-brand-teal/10 border-brand-teal/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  };

  return (
    <div
      className={twMerge(
        'bg-ops-panel border border-ops-border rounded-xl p-4.5 flex flex-col justify-between hover:border-ops-borderHighlight transition-all duration-200 relative group overflow-hidden',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 tracking-wider uppercase">{title}</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h3 className="text-2xl font-bold font-mono text-white tracking-tight">{value}</h3>
            {subValue && <span className="text-xs text-gray-400 font-normal">{subValue}</span>}
          </div>
        </div>
        {icon && (
          <div className={twMerge('p-2.5 rounded-lg border flex items-center justify-center', accentColors[variant])}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3.5 flex items-center justify-between text-xs pt-2 border-t border-ops-border/60">
        {change !== undefined ? (
          <div className="flex items-center gap-1">
            {change > 0 ? (
              <span className="text-emerald-400 flex items-center font-medium">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +{change}%
              </span>
            ) : change < 0 ? (
              <span className="text-rose-400 flex items-center font-medium">
                <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> {change}%
              </span>
            ) : (
              <span className="text-gray-400 flex items-center font-medium">
                <Minus className="w-3.5 h-3.5 mr-0.5" /> 0%
              </span>
            )}
            <span className="text-gray-500">{changeLabel}</span>
          </div>
        ) : (
          <span className="text-gray-500 font-mono text-[11px]">Real-time telemetry</span>
        )}
        {chartMini}
      </div>
    </div>
  );
};
