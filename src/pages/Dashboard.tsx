import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrgType } from '@/contexts/OrgTypeContext';
import { useActiveContext } from '@/contexts/ActiveContextContext';
import { PageHeader } from '@/components/layout/PageHeader';

interface StatCard {
  label: string;
  value: number | string;
  color: string;
}

interface AlertItem {
  id: string;
  type: 'attendance' | 'acwr' | 'safeguarding' | 'scholarship';
  text: string;
  severity: 'warning' | 'danger' | 'info';
}

function StatTile({ label, value, color }: StatCard) {
  return (
    <div className={`rounded-xl p-5 ${color} flex flex-col gap-1`}>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  danger:  'bg-red-50 border-red-200 text-red-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
};

export default function Dashboard() {
  const { orgType, academyId } = useOrgType();
  const { activeContext } = useActiveContext();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalPlayers: 0,
    openInjuries: 0,
    activeProspects: 0,
    upcomingFixtures: 0,
  });

  useEffect(() => {
    if (orgType !== 'academy' || !academyId || !activeContext) return;
    const sb = supabase as any;
    const clubId = activeContext.clubId;

    (async () => {
      // Players scoped to this academy's club
      const { count: playerCount } = await sb
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId);

      // Open injuries scoped to this academy's club via players join
      // TODO: verify injury_record column name — codebase uses both is_resolved and
      // resolved_at; Medical.tsx uses resolved_at which matches the types file.
      const { count: injuryCount } = await sb
        .from('injury_record')
        .select('players!inner(club_id)', { count: 'exact', head: true })
        .eq('players.club_id', clubId)
        .eq('is_resolved', false);

      // Active prospects — already scoped to academy_id ✓
      const { count: prospectCount } = await sb
        .from('prospect')
        .select('id', { count: 'exact', head: true })
        .eq('academy_id', academyId)
        .not('pipeline_stage', 'in', '("rejected","signed","released")');

      // Upcoming fixtures scoped to this academy's club via teams join
      const today = new Date();
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      const { count: fixtureCount } = await sb
        .from('team_events')
        .select('teams!inner(club_id)', { count: 'exact', head: true })
        .eq('teams.club_id', clubId)
        .gte('event_date', today.toISOString().split('T')[0])
        .lte('event_date', weekEnd.toISOString().split('T')[0]);

      setStats({
        totalPlayers:     playerCount   ?? 0,
        openInjuries:     injuryCount   ?? 0,
        activeProspects:  prospectCount ?? 0,
        upcomingFixtures: fixtureCount  ?? 0,
      });
    })();
  }, [orgType, academyId, activeContext]);

  // Alert feed — placeholder data; TODO comments mark where real queries go
  const alerts: AlertItem[] = [
    {
      id: 'att-1',
      type: 'attendance',
      // TODO: replace with real query: SELECT players with school_attendance.attendance_pct < 80
      text: 'Placeholder — players below 80% school attendance threshold will appear here',
      severity: 'warning',
    },
    {
      id: 'acwr-1',
      type: 'acwr',
      // TODO: replace with real query: SELECT players with training_load.acwr_at_time > 1.5 (latest record)
      text: 'Placeholder — players with ACWR > 1.5 will appear here',
      severity: 'danger',
    },
    {
      id: 'safe-1',
      type: 'safeguarding',
      // TODO: replace with real query: SELECT welfare_log WHERE status = 'open' AND log_date < now() - interval '7 days'
      text: 'Placeholder — overdue safeguarding items will appear here',
      severity: 'danger',
    },
    {
      id: 'scholar-1',
      type: 'scholarship',
      // TODO: replace with real query: SELECT trial_session WHERE decision_deadline BETWEEN now() AND now() + 14 days
      text: 'Placeholder — upcoming scholarship decision deadlines will appear here',
      severity: 'info',
    },
  ];

  if (orgType !== 'academy') {
    return <DashboardClub />;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Academy Dashboard"
        subtitle="Live overview across all squads"
        action={
          <button
            onClick={() => navigate('/squads')}
            className="text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors"
          >
            View squads
          </button>
        }
      />

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total players" value={stats.totalPlayers}    color="bg-violet-50" />
        <StatTile label="Open injuries" value={stats.openInjuries}    color="bg-red-50"    />
        <StatTile label="Active prospects" value={stats.activeProspects} color="bg-amber-50"  />
        <StatTile label="Fixtures this week" value={stats.upcomingFixtures} color="bg-green-50" />
      </div>

      {/* Alert feed */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Alerts</h2>
        <div className="flex flex-col gap-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`rounded-lg border px-4 py-3 text-sm ${SEVERITY_STYLES[alert.severity]}`}
            >
              {alert.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Inline club/team dashboard used when orgType !== 'academy'
function DashboardClub() {
  const { orgType } = useOrgType();
  const { activeContext } = useActiveContext();
  const navigate = useNavigate();
  const [playerCount, setPlayerCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    if (!activeContext) return;
    const sb = supabase as any;
    const clubId = activeContext.clubId;
    const teamId = activeContext.kind === 'team' ? activeContext.id : null;
    const col = teamId ? 'team_id' : 'club_id';
    const val = teamId ?? clubId;

    (async () => {
      const [{ count: p }, { count: m }] = await Promise.all([
        sb.from('players').select('id', { count: 'exact', head: true }).eq(col, val),
        // matches has club_id and team_id columns directly in the schema
        sb.from('matches').select('id', { count: 'exact', head: true }).eq(col, val),
      ]);
      setPlayerCount(p ?? 0);
      setMatchCount(m  ?? 0);
    })();
  }, [activeContext]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title={orgType === 'club' ? 'Club Dashboard' : 'Team Dashboard'}
        subtitle="Your squad at a glance"
      />

      <div className="mt-6 grid grid-cols-2 gap-4">
        <StatTile label="Players" value={playerCount} color="bg-violet-50" />
        <StatTile label="Matches" value={matchCount}  color="bg-blue-50"   />
      </div>

      <div className="mt-8">
        <button
          onClick={() => navigate('/matches')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
          </svg>
          Go to Matches
        </button>
      </div>
    </div>
  );
}
