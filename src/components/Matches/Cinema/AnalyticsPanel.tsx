import { BarChart3 } from 'lucide-react';
import { MatchAnalyticsDashboard } from '../MatchAnalyticsDashboard';

interface AnalyticsPanelProps {
  matchId: string;
  job: any;
  demoInsights?: any;
}

export function AnalyticsPanel({ matchId, job, demoInsights }: AnalyticsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border/40">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Analytics
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <MatchAnalyticsDashboard matchId={matchId} job={job} demoInsights={demoInsights} />
      </div>
    </div>
  );
}
