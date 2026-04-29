import React from 'react';
import { PageHeader } from './PageHeader';

interface PlaceholderPageProps {
  module: string;
  phase?: string;
}

export function PlaceholderPage({ module, phase = 'Phase 2' }: PlaceholderPageProps) {
  return (
    <div className="flex-1 p-6">
      <PageHeader title={module} />
      <div className="mt-8 flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-slate-400">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-700">{module}</h2>
        {/* TODO: replace with real content when this module is built */}
        <p className="mt-1 text-sm text-slate-400">Coming in {phase}</p>
      </div>
    </div>
  );
}
