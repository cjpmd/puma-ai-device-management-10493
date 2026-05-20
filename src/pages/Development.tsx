import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveContext } from '@/contexts/ActiveContextContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { X, Plus, ChevronRight, Activity, Target, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const sb = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  name: string;
  position: string | null;
  date_of_birth: string | null;
  team_id: string | null;
}

interface Milestone {
  id: string;
  player_id: string;
  milestone_date: string;
  category: string | null;
  title: string;
  is_upcoming: boolean;
}

interface AttributeSnapshot {
  id: string;
  player_id: string;
  snapshot_date: string;
  season: string | null;
  scores: Record<string, number>;
  notes: string | null;
}

interface MaturationRecord {
  id: string;
  player_id: string;
  recorded_date: string;
  height_cm: number | null;
  weight_kg: number | null;
  bio_age_estimate: number | null;
  method_used: string;
}

type Tab = 'attributes' | 'milestones' | 'maturation';

const MILESTONE_CATEGORIES = ['Technical', 'Physical', 'Tactical', 'Mental', 'Academic', 'Other'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function posStyle(pos: string | null): string {
  const p = (pos || '').toUpperCase();
  if (p === 'GK') return 'bg-amber-100 text-amber-700';
  if (['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(p)) return 'bg-sky-100 text-sky-700';
  if (['CDM', 'CM', 'CAM', 'RM', 'LM'].includes(p)) return 'bg-emerald-100 text-emerald-700';
  if (['RW', 'LW'].includes(p)) return 'bg-violet-100 text-violet-700';
  if (['ST', 'CF'].includes(p)) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-500';
}

function ageFrom(dob: string | null): string {
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000));
  return `${years}y`;
}

// ─── Log Milestone Dialog ─────────────────────────────────────────────────────

function LogMilestoneDialog({
  playerId,
  playerName,
  onSaved,
  onClose,
}: {
  playerId: string;
  playerName: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState(new Date().toISOString().slice(0, 10));
  const [isUpcoming, setIsUpcoming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && milestoneDate.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const { error: dbErr } = await sb.from('milestones').insert({
      player_id: playerId,
      title: title.trim(),
      category: category || null,
      milestone_date: milestoneDate,
      is_upcoming: isUpcoming,
    });
    setSaving(false);
    if (dbErr) {
      setError(dbErr.message);
    } else {
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Milestone</DialogTitle>
        </DialogHeader>
        <div className="mt-1 space-y-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">
            {playerName}
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="">— select —</option>
              {MILESTONE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Title <span className="text-rose-400">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. First senior appearance"
              className="w-full rounded-lg border border-slate-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Date <span className="text-rose-400">*</span></label>
            <input
              type="date"
              value={milestoneDate}
              onChange={e => setMilestoneDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIsUpcoming(v => !v)}
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${isUpcoming ? 'bg-violet-500' : 'bg-slate-200'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow mt-0.5 transition-transform ${isUpcoming ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-700">Upcoming (future target)</span>
          </label>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : 'Save milestone'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail panel content ─────────────────────────────────────────────────────

function AttributesTab({ player }: { player: Player }) {
  const { data: snapshots = [], isLoading } = useQuery<AttributeSnapshot[]>({
    queryKey: ['dev-attr-snapshots', player.id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb
        .from('attribute_snapshot')
        .select('id, player_id, snapshot_date, season, scores, notes')
        .eq('player_id', player.id)
        .order('snapshot_date', { ascending: false });
      return (data ?? []) as AttributeSnapshot[];
    },
  });

  if (isLoading) return <div className="py-10 text-center text-sm text-slate-400">Loading…</div>;
  if (snapshots.length === 0) {
    return (
      <div className="py-10 text-center">
        <Activity className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No attribute snapshots yet.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {snapshots.map(snap => {
        const entries = Object.entries(snap.scores);
        return (
          <div key={snap.id} className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">
                {new Date(snap.snapshot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {snap.season && <span className="text-xs text-slate-400">{snap.season}</span>}
            </div>
            {entries.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {entries.map(([attr, score]) => (
                  <div key={attr} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 truncate">{attr}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-400"
                          style={{ width: `${Math.min(100, (score / 10) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 w-4 text-right">{score}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No scores recorded.</p>
            )}
            {snap.notes && <p className="mt-2 text-xs text-slate-500 italic">{snap.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}

function MilestonesTab({ player, clubId }: { player: Player; clubId: string }) {
  const qc = useQueryClient();
  const [showLog, setShowLog] = useState(false);

  const { data: milestones = [], isLoading } = useQuery<Milestone[]>({
    queryKey: ['dev-milestones', player.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await sb
        .from('milestones')
        .select('id, player_id, milestone_date, category, title, is_upcoming')
        .eq('player_id', player.id)
        .order('milestone_date', { ascending: false });
      return (data ?? []) as Milestone[];
    },
  });

  const achieved = milestones.filter(m => !m.is_upcoming);
  const upcoming = milestones.filter(m => m.is_upcoming);

  return (
    <div>
      <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
        <span className="text-xs text-slate-400">{milestones.length} milestone{milestones.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowLog(true)}
          className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800"
        >
          <Plus className="w-3.5 h-3.5" /> Log Milestone
        </button>
      </div>

      {isLoading && <div className="py-8 text-center text-sm text-slate-400">Loading…</div>}

      {!isLoading && milestones.length === 0 && (
        <div className="py-10 text-center">
          <Target className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No milestones logged yet.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <div className="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
            Upcoming targets
          </div>
          {upcoming.map(m => (
            <MilestoneRow key={m.id} milestone={m} />
          ))}
        </div>
      )}
      {achieved.length > 0 && (
        <div>
          <div className="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
            Achieved
          </div>
          {achieved.map(m => (
            <MilestoneRow key={m.id} milestone={m} />
          ))}
        </div>
      )}

      {showLog && (
        <LogMilestoneDialog
          playerId={player.id}
          playerName={player.name}
          onSaved={() => qc.invalidateQueries({ queryKey: ['dev-milestones', player.id] })}
          onClose={() => setShowLog(false)}
        />
      )}
    </div>
  );
}

function MilestoneRow({ milestone: m }: { milestone: Milestone }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-slate-100 last:border-0">
      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${m.is_upcoming ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800">{m.title}</p>
        {m.category && (
          <span className="mt-0.5 inline-block text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
            {m.category}
          </span>
        )}
      </div>
      <span className="text-xs text-slate-400 flex-shrink-0">
        {new Date(m.milestone_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
    </div>
  );
}

function MaturationTab({ player }: { player: Player }) {
  const { data: records = [], isLoading } = useQuery<MaturationRecord[]>({
    queryKey: ['dev-maturation', player.id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb
        .from('maturation_record')
        .select('id, player_id, recorded_date, height_cm, weight_kg, bio_age_estimate, method_used')
        .eq('player_id', player.id)
        .order('recorded_date', { ascending: false });
      return (data ?? []) as MaturationRecord[];
    },
  });

  if (isLoading) return <div className="py-10 text-center text-sm text-slate-400">Loading…</div>;
  if (records.length === 0) {
    return (
      <div className="py-10 text-center">
        <TrendingUp className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No maturation records yet.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {records.map(r => (
        <div key={r.id} className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">
              {new Date(r.recorded_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-xs text-slate-400">{r.method_used}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Height', value: r.height_cm != null ? `${r.height_cm} cm` : '—' },
              { label: 'Weight', value: r.weight_kg != null ? `${r.weight_kg} kg` : '—' },
              { label: 'Bio age', value: r.bio_age_estimate != null ? `${r.bio_age_estimate.toFixed(1)} y` : '—' },
            ].map(stat => (
              <div key={stat.label} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-center">
                <p className="text-sm font-semibold text-slate-800">{stat.value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Detail panel / modal ─────────────────────────────────────────────────────

function PlayerDetail({
  player,
  clubId,
  onClose,
  isMobile,
}: {
  player: Player;
  clubId: string;
  onClose: () => void;
  isMobile: boolean;
}) {
  const [tab, setTab] = useState<Tab>('milestones');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'milestones', label: 'Milestones' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'maturation', label: 'Maturation' },
  ];

  const content = (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 flex-shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-900">{player.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {player.position && (
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${posStyle(player.position)}`}>
                {player.position}
              </span>
            )}
            {player.date_of_birth && (
              <span className="text-xs text-slate-400">{ageFrom(player.date_of_birth)}</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 flex-shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'text-violet-700 border-b-2 border-violet-500'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'milestones' && <MilestonesTab player={player} clubId={clubId} />}
        {tab === 'attributes' && <AttributesTab player={player} />}
        {tab === 'maturation' && <MaturationTab player={player} />}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
        <DialogContent className="max-w-full h-[90vh] p-0 flex flex-col overflow-hidden">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="w-96 flex-shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-full">
      {content}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Development() {
  const { activeContext } = useActiveContext();
  const clubId = activeContext?.clubId ?? null;

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isMobile] = useState(() => window.innerWidth < 768);

  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: ['dev-players', clubId],
    enabled: !!clubId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb
        .from('players')
        .select('id, name, position, date_of_birth, team_id')
        .eq('club_id', clubId!)
        .order('name');
      return (data ?? []) as Player[];
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Development"
        subtitle={isLoading ? 'Loading…' : `${players.length} player${players.length !== 1 ? 's' : ''}`}
      />

      <div
        className="mt-6 flex gap-6 items-start"
        style={{ height: 'calc(100vh - 200px)' }}
      >
        {/* ── Player list ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-full">
          <div className="px-4 py-3 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
            Players
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="py-12 text-center text-sm text-slate-400">Loading players…</div>
            )}
            {!isLoading && players.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">No players found for this club.</div>
            )}
            {players.map(p => {
              const active = selectedPlayer?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayer(active ? null : p)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${
                    active ? 'bg-violet-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium truncate block ${active ? 'text-violet-700' : 'text-slate-800'}`}>
                      {p.name}
                    </span>
                    {p.date_of_birth && (
                      <span className="text-xs text-slate-400">{ageFrom(p.date_of_birth)}</span>
                    )}
                  </div>
                  {p.position && (
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${posStyle(p.position)}`}>
                      {p.position}
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${active ? 'text-violet-400' : 'text-slate-300'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Detail panel ─────────────────────────────────────── */}
        {selectedPlayer && !isMobile && (
          <PlayerDetail
            player={selectedPlayer}
            clubId={clubId!}
            onClose={() => setSelectedPlayer(null)}
            isMobile={false}
          />
        )}
        {selectedPlayer && isMobile && (
          <PlayerDetail
            player={selectedPlayer}
            clubId={clubId!}
            onClose={() => setSelectedPlayer(null)}
            isMobile={true}
          />
        )}

        {!selectedPlayer && (
          <div className="w-96 flex-shrink-0 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center h-full text-center">
            <Activity className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Select a player</p>
            <p className="text-xs text-slate-400 mt-1">View milestones, attributes & maturation data</p>
          </div>
        )}
      </div>
    </div>
  );
}
