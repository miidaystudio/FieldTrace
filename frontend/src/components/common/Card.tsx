import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  glow?: 'none' | 'teal' | 'emerald' | 'rose' | 'amber';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  glow = 'none',
  interactive = false,
  className,
  ...props
}) => {
  const glowStyles = {
    none: '',
    teal: 'border-brand-teal/40 shadow-[0_0_20px_rgba(94,234,212,0.15)]',
    emerald: 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    rose: 'border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    amber: 'border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.15)]',
  };

  return (
    <div
      className={twMerge(
        'bg-ops-panel border border-ops-border rounded-xl text-gray-100 transition-all duration-200 overflow-hidden flex flex-col',
        interactive && 'hover:border-ops-borderHighlight hover:bg-ops-card cursor-pointer',
        glowStyles[glow],
        className
      )}
      {...props}
    >
      {header && (
        <div className="px-4 py-3 border-b border-ops-border bg-ops-base/40 flex items-center justify-between text-sm font-semibold tracking-wide">
          {header}
        </div>
      )}
      <div className="p-4 flex-1">{children}</div>
      {footer && (
        <div className="px-4 py-2.5 border-t border-ops-border bg-ops-base/30 text-xs text-gray-400">
          {footer}
        </div>
      )}
    </div>
  );
};
