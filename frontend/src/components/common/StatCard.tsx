import React from 'react';
import { twMerge } from 'tailwind-merge';
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: number; // e.g. +4.2 or -1.5
  changeLabel?: string;
  icon?: React.ReactNode;
  progressPercent?: number;
  variant?: 'default' | 'teal' | 'emerald' | 'amber' | 'rose';
  className?: string;
  chartMini?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subValue,
  change,
  changeLabel = 'vs shift target',
  icon,
  progressPercent,
  variant = 'default',
  className,
  chartMini,
}) => {
  return (
    <div
      className={twMerge(
        'rounded-3xl bg-[#161920] p-6 border border-white/[0.05] flex flex-col justify-between hover:border-white/[0.1] transition-all duration-200 relative group overflow-hidden',
        className
      )}
    >
      <div>
        {/* Top Row: Metric label + subtle circular arrow/action button */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#8E96A4] tracking-wider uppercase">{title}</p>
          <div className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white flex items-center justify-center transition-colors shrink-0">
            {icon ? (
              <span className="text-white text-xs">{icon}</span>
            ) : (
              <ArrowUpRight className="w-4 h-4 text-white" />
            )}
          </div>
        </div>

        {/* Big value */}
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-bold font-mono tabular-nums text-white tracking-tight">{value}</h3>
        </div>

        {subValue && (
          <p className="text-xs text-[#8E96A4] mt-2 flex items-center gap-1.5 font-normal">
            {subValue}
          </p>
        )}
      </div>

      {/* Progress bar if applicable */}
      {progressPercent !== undefined && (
        <div className="mt-4 w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-slate-200 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      )}

      {/* Comparison meta text */}
      <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-white/[0.05] text-[#8E96A4]">
        {change !== undefined ? (
          <div className="flex items-center gap-1.5 font-medium">
            {change > 0 ? (
              <span className="text-white flex items-center">
                <TrendingUp className="w-3.5 h-3.5 mr-1 text-white" /> +{change}%
              </span>
            ) : change < 0 ? (
              <span className="text-[#E11D48] flex items-center">
                <TrendingDown className="w-3.5 h-3.5 mr-1 text-[#E11D48]" /> {change}%
              </span>
            ) : (
              <span className="text-[#8E96A4] flex items-center">
                <Minus className="w-3.5 h-3.5 mr-1 text-[#8E96A4]" /> 0%
              </span>
            )}
            <span className="text-[#8E96A4]">{changeLabel}</span>
          </div>
        ) : (
          <span className="text-[#8E96A4] font-mono text-[11px]">Real-time telemetry</span>
        )}
        {chartMini}
      </div>
    </div>
  );
};
