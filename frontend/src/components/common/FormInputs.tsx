import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const darkInputClass =
  'w-full bg-[#1D212B] border border-white/[0.08] text-white placeholder-[#64748B] text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-white/30 transition-colors font-mono';

export const darkSelectClass =
  'w-full bg-[#1D212B] border border-white/[0.08] text-white placeholder-[#64748B] text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-white/30 transition-colors';

export const DarkFormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="p-3 bg-[#241419] border border-rose-500/30 rounded-xl text-rose-200 text-xs flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 text-[#E11D48]" />
      <span>{message}</span>
    </div>
  ) : null;
