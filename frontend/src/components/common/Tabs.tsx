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
        variant === 'pills' && 'bg-ops-base/60 p-1 rounded-xl border border-ops-border',
        variant === 'underline' && 'border-b border-ops-border',
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
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={twMerge(
                    'px-1.5 py-0.5 rounded text-[10px] font-mono',
                    isActive ? 'bg-brand-teal/20 text-brand-teal' : 'bg-ops-card text-gray-400'
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
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
              isActive
                ? 'bg-ops-card text-brand-teal font-semibold shadow-sm border border-slate-700/50'
                : 'text-gray-400 hover:text-gray-200 hover:bg-ops-card/40'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={twMerge(
                  'px-1.5 py-0.5 rounded text-[10px] font-mono',
                  isActive ? 'bg-brand-teal/20 text-brand-teal font-bold' : 'bg-slate-800 text-gray-400'
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
