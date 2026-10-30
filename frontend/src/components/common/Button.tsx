import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'glass' | 'coral';
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
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0C0E12] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary: 'bg-white text-black hover:bg-slate-200 font-semibold focus:ring-white',
    secondary: 'bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/[0.08] focus:ring-white/20',
    outline: 'bg-transparent text-white border border-white/[0.15] hover:bg-white/[0.06] focus:ring-white/20',
    danger: 'bg-[#E11D48] text-white hover:bg-rose-600 focus:ring-rose-500 font-semibold',
    ghost: 'bg-transparent text-[#8E96A4] hover:text-white hover:bg-white/[0.06] focus:ring-white/20',
    glass: 'bg-[#1D212B] text-white border border-white/[0.08] hover:bg-[#252A36]',
    coral: 'bg-[#E85D38] text-white hover:bg-[#D94F2B] font-semibold',
  };

  const sizes = {
    sm: 'text-xs px-4 py-1.5 gap-1.5',
    md: 'text-sm px-5 py-2 gap-2',
    lg: 'text-base px-6 py-2.5 gap-2.5',
    icon: 'w-8 h-8 p-0 flex items-center justify-center rounded-full',
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
