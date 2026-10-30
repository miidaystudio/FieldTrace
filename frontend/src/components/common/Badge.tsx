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
    verified: 'bg-white/[0.08] text-white border-white/[0.1]',
    moving: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    idle: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    stopped: 'bg-slate-800/80 text-slate-300 border-white/[0.08]',
    stale: 'bg-slate-800/60 text-slate-400 border-white/[0.05]',
    flagged: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    deviated: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    offline: 'bg-slate-900 text-slate-500 border-white/[0.05]',
    teal: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    slate: 'bg-white/[0.06] text-slate-300 border-white/[0.08]',
  };

  const dotColors = {
    verified: 'bg-white',
    moving: 'bg-blue-400',
    idle: 'bg-amber-500',
    stopped: 'bg-slate-400',
    stale: 'bg-slate-500',
    flagged: 'bg-rose-500',
    deviated: 'bg-amber-500',
    offline: 'bg-slate-600',
    teal: 'bg-blue-400',
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
