import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'pills' | 'underline';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  className,
}) => {
  return (
    <div
      className={twMerge(
        'flex items-center gap-1',
        variant === 'pills' && 'bg-[#12151C] p-1.5 rounded-full inline-flex items-center gap-1 border border-white/[0.05]',
        variant === 'underline' && 'border-b border-white/[0.05]',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        if (variant === 'underline') {
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={twMerge(
                'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all',
                isActive
                  ? 'border-white text-white'
                  : 'border-transparent text-[#8E96A4] hover:text-white'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={twMerge(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono',
                    isActive ? 'bg-white text-black font-semibold' : 'bg-white/[0.06] text-[#8E96A4]'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={twMerge(
              'px-4 py-1.5 rounded-full text-xs flex items-center gap-2 transition-colors',
              isActive
                ? 'bg-white text-black font-semibold shadow-xs'
                : 'text-[#8E96A4] hover:text-white hover:bg-white/[0.04]'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={twMerge(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-mono',
                  isActive ? 'bg-black/10 text-black font-bold' : 'bg-white/[0.06] text-[#8E96A4]'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
