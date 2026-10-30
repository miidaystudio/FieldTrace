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
  return (
    <div
      className={twMerge(
        'bg-[#161920] border border-white/[0.05] rounded-3xl text-white transition-all duration-200 overflow-hidden flex flex-col',
        interactive && 'hover:border-white/[0.1] hover:bg-[#1D212B] cursor-pointer',
        className
      )}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between text-sm font-semibold tracking-wide text-white">
          {header}
        </div>
      )}
      <div className="p-6 flex-1">{children}</div>
      {footer && (
        <div className="px-6 py-3.5 border-t border-white/[0.05] bg-black/20 text-xs text-[#8E96A4]">
          {footer}
        </div>
      )}
    </div>
  );
};
