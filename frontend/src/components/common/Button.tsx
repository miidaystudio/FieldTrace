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
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#FAF8F5] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary: 'bg-[#E85D38] text-white hover:bg-[#D94F2B] shadow-[0_10px_25px_rgba(232,93,56,0.32)] hover:shadow-[0_14px_32px_rgba(232,93,56,0.42)] focus:ring-[#E85D38] border border-orange-400/30',
    secondary: 'bg-white text-stone-800 hover:bg-stone-50 border border-stone-200/90 shadow-[0_2px_8px_rgba(28,25,23,0.04)] hover:border-stone-300 focus:ring-stone-400',
    outline: 'bg-transparent text-[#E85D38] border border-[#E85D38]/40 hover:bg-[#FFF2ED] focus:ring-[#E85D38]',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-md focus:ring-rose-500 border border-rose-400/30',
    ghost: 'bg-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 focus:ring-stone-400',
    glass: 'bg-white/90 backdrop-blur-md text-stone-800 border border-stone-200 shadow-[0_4px_16px_rgba(28,25,23,0.04)] hover:border-[#E85D38]/50',
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
