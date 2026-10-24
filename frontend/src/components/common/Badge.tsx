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
    verified: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    moving: 'bg-[#FFF2ED] text-[#E85D38] border-[#FCD4C7]',
    idle: 'bg-amber-50 text-amber-800 border-amber-200/80',
    stopped: 'bg-blue-50 text-blue-700 border-blue-200/80',
    stale: 'bg-stone-100 text-stone-600 border-stone-200',
    flagged: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
    deviated: 'bg-orange-50 text-orange-800 border-orange-200',
    offline: 'bg-stone-100 text-stone-400 border-stone-200',
    teal: 'bg-[#FFF2ED] text-[#E85D38] border-[#FCD4C7]',
    slate: 'bg-stone-100 text-stone-700 border-stone-200',
  };

  const dotColors = {
    verified: 'bg-emerald-500',
    moving: 'bg-[#E85D38]',
    idle: 'bg-amber-500',
    stopped: 'bg-blue-500',
    stale: 'bg-stone-400',
    flagged: 'bg-rose-500',
    deviated: 'bg-orange-500',
    offline: 'bg-stone-400',
    teal: 'bg-[#E85D38]',
    slate: 'bg-stone-500',
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
