import React from 'react';
import { Info } from 'lucide-react';

/**
 * Honest placeholder for features whose backend is not built yet — shown instead of fake data.
 */
export const PhaseNotice: React.FC<{ phase: number; feature: string; children?: React.ReactNode }> = ({
  phase,
  feature,
  children,
}) => (
  <div className="p-4 bg-indigo-950/30 border border-indigo-500/40 rounded-xl text-xs text-indigo-100 flex items-start gap-3">
    <Info className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
    <div className="space-y-1">
      <div className="font-bold text-white">
        {feature} — backend arrives in Phase {phase}
      </div>
      <p className="text-indigo-200/80">
        {children ??
          'No demo data is shown here. This view will fill with real records once the backend for this feature is live.'}
      </p>
    </div>
  </div>
);
