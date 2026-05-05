import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import InjuryLogModal from '../components/medical/InjuryLogModal';

const sb = supabase as any;

interface Player {
  id: string;
  name: string;
  position?: string;
  date_of_birth?: string;
}

interface InjuryRecord {
  id: string;
  player_id: string;
  injury_date: string;
  body_part: string;
  severity?: string;
  rtp_phase?: number;
  resolved_at?: string | null;
}

interface AcwrAlert {
  player_id: string;
  player_name: string;
  acwr: number;
  session_date: string;
}

const STATUS_CONFIG = {
  available: { label: 'Available', text: 'text-emerald-400', bg: 'bg-emerald-500/20 text-emerald-400' },
  injured:   { label: 'Injured',   text: 'text-rose-400',    bg: 'bg-rose-500/20 text-rose-400' },
  high_load: { label: 'High Load', text: 'text-red-400',     bg: 'bg-red-500/20 text-red-400' },
  monitoring:{ label: 'Monitoring',text: 'text-amber-400',   bg: 'bg-amber-500/20 text-amber-400' },
} as const;

type PlayerStatus = keyof typeof STATUS_CONFIG;

export default function Medical() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PlayerStatus | 'all'>('all');
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);

  const { data: players = [] } = useQuery({
    queryKey: ['medical-players'],
    queryFn: async () => {
      const { data } = await sb.from('players').select('id, name, position, date_of_birth').order('name');
      return (data ?? []) as Player[];
    },
  });

  const { data: activeInjuries = [], refetch: refetchInjuries } = useQuery({
    queryKey: ['active-injuries'],
    queryFn: async () => {
      const { data } = await sb
        .from('injury_record')
        .select('id, player_id, injury_date, body_part, severity, rtp_phase, resolved_at')
        .is('resolved_at', null)
        .order('injury_date', { ascending: false });
      return (data ?? []) as InjuryRecord[];
    },
  });

  const { data: acwrAlerts = [] } = useQuery({
    queryKey: ['acwr-alerts'],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const { data } = await sb
        .from('training_load')
        .select('player_id, acwr_at_time, session_date, players(name)')
        .gte('session_date', cutoff.toISOString().split('T')[0])
        .not('acwr_at_time', 'is', null)
        .order('session_date', { ascending: false });

      const seen = new Map<string, AcwrAlert>();
      for (const row of data ?? []) {
        if (!seen.has(row.player_id) && row.acwr_at_time >= 1.3) {
          seen.set(row.player_id, {
            player_id: row.player_id,
            player_name: row.players?.name ?? 'Unknown',
            acwr: row.acwr_at_time,
            session_date: row.session_date,
          });
        }
      }
      return Array.from(seen.values()).sort((a, b) => b.acwr - a.acwr);
    },
  });

  const injuredIds = new Set(activeInjuries.map(i => i.player_id));
  const alertMap   = new Map(acwrAlerts.map(a => [a.player_id, a]));

  const counts = {
    available:  players.filter(p => !injuredIds.has(p.id) && !alertMap.has(p.id)).length,
    injured:    activeInjuries.length,
    high_load:  acwrAlerts.filter(a => a.acwr > 1.5  && !injuredIds.has(a.player_id)).length,
    monitoring: acwrAlerts.filter(a => a.acwr >= 1.3 && a.acwr <= 1.5 && !injuredIds.has(a.player_id)).length,
  };

  function getStatus(playerId: string): PlayerStatus {
    if (injuredIds.has(playerId)) return 'injured';
    const alert = alertMap.get(playerId);
    if (alert) return alert.acwr > 1.5 ? 'high_load' : 'monitoring';
    return 'available';
  }

  const filteredPlayers = players.filter(p =>
    statusFilter === 'all' || getStatus(p.id) === statusFilter
  );

  function openInjuryModal(playerId: string | null = null) {
    setModalPlayerId(playerId);
    setShowInjuryModal(true);
  }

  function handleInjurySuccess() {
    setShowInjuryModal(false);
    refetchInjuries();
    qc.invalidateQueries({ queryKey: ['acwr-alerts'] });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Medical &amp; Load</h1>
        <button
          onClick={() => openInjuryModal()}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Log Injury
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.entries(counts) as [PlayerStatus, number][]).map(([key, count]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            className={`p-4 rounded-xl border text-left transition-all ${
              statusFilter === key
                ? `${STATUS_CONFIG[key].bg} border-current/30`
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className={`text-3xl font-bold ${STATUS_CONFIG[key].text}`}>{count}</div>
            <div className="text-sm text-slate-400 mt-1">{STATUS_CONFIG[key].label}</div>
          </button>
        ))}
      </div>

      {/* ACWR Alerts */}
      {acwrAlerts.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block animate-pulse" />
            <h2 className="font-semibold text-white text-sm">ACWR Alerts</h2>
          </div>
          <div className="divide-y divide-white/5">
            {acwrAlerts.map(alert => (
              <div key={alert.player_id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <Link to={`/players/${alert.player_id}`} className="text-white font-medium hover:text-violet-300 transition-colors">
                    {alert.player_name}
                  </Link>
                  <span className="text-slate-500 text-xs ml-2">last: {alert.session_date}</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  alert.acwr > 1.5 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  ACWR {alert.acwr.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player list */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <h2 className="font-semibold text-white text-sm">Squad Status</h2>
          <span className="text-slate-500 text-xs">{filteredPlayers.length} players</span>
          {statusFilter !== 'all' && (
            <button onClick={() => setStatusFilter('all')} className="text-xs text-slate-500 hover:text-white ml-auto transition-colors">
              Clear filter ✕
            </button>
          )}
        </div>
        <div className="divide-y divide-white/5">
          {filteredPlayers.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">No players in this category</div>
          ) : (
            filteredPlayers.map(player => {
              const status  = getStatus(player.id);
              const injury  = activeInjuries.find(i => i.player_id === player.id);
              const alert   = alertMap.get(player.id);
              return (
                <div key={player.id} className="px-4 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <Link to={`/players/${player.id}`} className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{player.name}</div>
                    {player.position && <div className="text-slate-500 text-xs">{player.position}</div>}
                  </Link>

                  {injury && (
                    <div className="hidden sm:block text-xs text-rose-300">
                      {injury.body_part}{injury.rtp_phase ? ` — Phase ${injury.rtp_phase}/5` : ''}
                    </div>
                  )}

                  {alert && !injury && (
                    <div className={`text-xs font-medium ${alert.acwr > 1.5 ? 'text-red-400' : 'text-amber-400'}`}>
                      ACWR {alert.acwr.toFixed(2)}
                    </div>
                  )}

                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_CONFIG[status].bg}`}>
                    {STATUS_CONFIG[status].label}
                  </span>

                  <button
                    onClick={() => openInjuryModal(player.id)}
                    className="text-xs text-slate-500 hover:text-white px-2 py-1 rounded border border-white/10 hover:border-white/30 transition-colors flex-shrink-0"
                  >
                    Log injury
                  </button>

                  {injury && (
                    <RtpStepper injury={injury} onUpdate={() => refetchInjuries()} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {showInjuryModal && (
        <InjuryLogModal
          playerId={modalPlayerId}
          players={players}
          onClose={() => setShowInjuryModal(false)}
          onSuccess={handleInjurySuccess}
        />
      )}
    </div>
  );
}

function RtpStepper({ injury, onUpdate }: { injury: InjuryRecord; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const phase = injury.rtp_phase ?? 1;

  async function advance() {
    if (phase >= 5) return;
    setSaving(true);
    await sb.from('injury_record').update({ rtp_phase: phase + 1 }).eq('id', injury.id);
    setSaving(false);
    onUpdate();
  }

  async function markResolved() {
    setSaving(true);
    await sb.from('injury_record')
      .update({ rtp_phase: 5, resolved_at: new Date().toISOString() })
      .eq('id', injury.id);
    setSaving(false);
    onUpdate();
  }

  return (
    <div className="flex-shrink-0">
      {phase < 5 ? (
        <button
          onClick={advance}
          disabled={saving}
          className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50 transition-colors"
        >
          {saving ? '…' : `→ Phase ${phase + 1}`}
        </button>
      ) : (
        <button
          onClick={markResolved}
          disabled={saving}
          className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50 transition-colors"
        >
          {saving ? '…' : 'Mark returned'}
        </button>
      )}
    </div>
  );
}
