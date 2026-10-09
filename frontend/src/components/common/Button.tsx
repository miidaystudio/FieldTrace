import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F17] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary: 'bg-brand-teal text-[#0B0F17] hover:bg-[#4dd4be] font-semibold shadow-lg shadow-teal-950/40 focus:ring-brand-teal border border-teal-300/40',
    secondary: 'bg-ops-card text-gray-200 hover:bg-ops-hover border border-ops-border hover:border-ops-borderHighlight focus:ring-slate-400',
    outline: 'bg-transparent text-brand-teal border border-brand-teal/40 hover:bg-brand-teal/10 focus:ring-brand-teal',
    danger: 'bg-rose-600/90 text-white hover:bg-rose-500 shadow-lg shadow-rose-950/40 focus:ring-rose-500 border border-rose-400/30',
    ghost: 'bg-transparent text-gray-300 hover:text-white hover:bg-ops-hover focus:ring-slate-500',
    glass: 'bg-[#151C28]/80 backdrop-blur-md text-gray-200 border border-slate-700/60 hover:border-brand-teal/50 hover:text-white shadow-xl',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
    icon: 'p-2 aspect-square',
  };

  return (
    <button
      className={twMerge(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
};
