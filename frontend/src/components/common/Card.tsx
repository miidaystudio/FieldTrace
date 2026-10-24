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
    teal: 'border-[#E85D38]/50 shadow-[0_12px_32px_rgba(232,93,56,0.15)]',
    emerald: 'border-emerald-500/50 shadow-[0_12px_32px_rgba(16,185,129,0.15)]',
    rose: 'border-rose-500/50 shadow-[0_12px_32px_rgba(239,68,68,0.15)]',
    amber: 'border-amber-500/50 shadow-[0_12px_32px_rgba(245,158,11,0.15)]',
  };

  return (
    <div
      className={twMerge(
        'bg-white border border-stone-200/80 rounded-3xl text-stone-900 shadow-[0_10px_30px_rgba(28,25,23,0.04)] transition-all duration-300 overflow-hidden flex flex-col',
        interactive && 'hover:shadow-[0_20px_45px_rgba(28,25,23,0.08)] hover:-translate-y-1 cursor-pointer',
        glowStyles[glow],
        className
      )}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-stone-100 bg-[#FAF8F5]/60 flex items-center justify-between text-sm font-semibold tracking-wide text-stone-800">
          {header}
        </div>
      )}
      <div className="p-6 flex-1">{children}</div>
      {footer && (
        <div className="px-6 py-3 border-t border-stone-100 bg-[#FAF8F5]/40 text-xs text-stone-500">
          {footer}
        </div>
      )}
    </div>
  );
};
