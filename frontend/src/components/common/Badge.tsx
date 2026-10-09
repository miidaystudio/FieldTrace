import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'verified' | 'moving' | 'idle' | 'stopped' | 'stale' | 'flagged' | 'deviated' | 'offline' | 'teal' | 'slate';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  size = 'sm',
  dot = true,
  className,
}) => {
  const variantStyles = {
    verified: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
    moving: 'bg-teal-950/70 text-teal-300 border-teal-500/40',
    idle: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
    stopped: 'bg-blue-950/70 text-blue-300 border-blue-500/40',
    stale: 'bg-slate-900/80 text-slate-400 border-slate-700/50',
    flagged: 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse',
    deviated: 'bg-orange-950/80 text-orange-300 border-orange-500/50',
    offline: 'bg-gray-900/90 text-gray-500 border-gray-800',
    teal: 'bg-brand-teal/10 text-brand-teal border-brand-teal/30',
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
  };

  const dotColors = {
    verified: 'bg-emerald-400',
    moving: 'bg-teal-400',
    idle: 'bg-amber-400',
    stopped: 'bg-blue-400',
    stale: 'bg-slate-400',
    flagged: 'bg-rose-400',
    deviated: 'bg-orange-400',
    offline: 'bg-gray-600',
    teal: 'bg-brand-teal',
    slate: 'bg-slate-400',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  };

  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 rounded-full border backdrop-blur-sm transition-all',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span
          className={clsx(
            'h-1.5 w-1.5 rounded-full ring-2 ring-black/40',
            dotColors[variant],
            variant === 'moving' && 'animate-ping'
          )}
        />
      )}
      {children}
    </span>
  );
};
