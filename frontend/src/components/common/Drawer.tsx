import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  position?: 'right' | 'left';
  width?: string;
  footer?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  position = 'right',
  width = 'w-96 md:w-[480px]',
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />
      <div
        className={twMerge(
          'fixed inset-y-0 flex max-w-full bg-[#161920] border-white/[0.08] text-white shadow-2xl transition-all transform duration-300 ease-in-out',
          position === 'right' ? 'right-0 border-l animate-in slide-in-from-right' : 'left-0 border-r animate-in slide-in-from-left',
          width
        )}
      >
        <div className="flex flex-col w-full h-full">
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/[0.05] bg-[#0C0E12]/80 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
              {subtitle && <p className="text-xs text-[#8E96A4] mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-white/[0.05] bg-[#0C0E12]/60 flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
