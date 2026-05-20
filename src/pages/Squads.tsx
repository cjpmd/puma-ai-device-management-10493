import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveContext } from '@/contexts/ActiveContextContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Users, Info, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const sb = supabase as any;

interface Team {
  id: string;
  name: string;
  age_group: string | null;
}

interface Player {
  id: string;
  name: string;
  position: string | null;
  availability: string | null;
  team_id: string | null;
}

const POSITION_ORDER = ['GK', 'CB', 'RB', 'LB', 'RWB', 'LWB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST', 'CF'];

function posGroup(pos: string | null): string {
  const p = (pos || '').toUpperCase();
  if (p === 'GK') return 'Goalkeepers';
  if (['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(p)) return 'Defenders';
  if (['CDM', 'CM', 'CAM', 'RM', 'LM'].includes(p)) return 'Midfielders';
  if (['RW', 'LW', 'ST', 'CF'].includes(p)) return 'Forwards';
  return 'Other';
}

const GROUP_ORDER = ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards', 'Other'];

function availDot(availability: string | null) {
  const a = (availability || '').toLowerCase();
  if (a === 'red' || a === 'injured' || a === 'unavailable') return 'bg-red-400';
  if (a === 'amber') return 'bg-amber-400';
  return 'bg-emerald-400';
}

function posStyle(pos: string | null): string {
  const p = (pos || '').toUpperCase();
  if (p === 'GK') return 'bg-amber-100 text-amber-700';
  if (['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(p)) return 'bg-sky-100 text-sky-700';
  if (['CDM', 'CM', 'CAM', 'RM', 'LM'].includes(p)) return 'bg-emerald-100 text-emerald-700';
  if (['RW', 'LW'].includes(p)) return 'bg-violet-100 text-violet-700';
  if (['ST', 'CF'].includes(p)) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-500';
}

// ─── Player row ───────────────────────────────────────────────────────────────

function PlayerRow({
  player,
  teams,
  onMoveClick,
}: {
  player: Player;
  teams: Team[];
  onMoveClick: (player: Player) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${availDot(player.availability)}`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-800 truncate block">{player.name}</span>
      </div>
      {player.position && (
        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${posStyle(player.position)}`}>
          {player.position}
        </span>
      )}
      <button
        onClick={() => onMoveClick(player)}
        className="opacity-0 group-hover:opacity-100 text-xs text-violet-600 hover:text-violet-800 font-medium transition-opacity flex items-center gap-1"
      >
        Move <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Roster panel ─────────────────────────────────────────────────────────────

function RosterPanel({
  squad,
  players,
  teams,
  onMoveClick,
}: {
  squad: Team | 'unassigned';
  players: Player[];
  teams: Team[];
  onMoveClick: (player: Player) => void;
}) {
  const isUnassigned = squad === 'unassigned';
  const title = isUnassigned ? 'Unassigned players' : (squad as Team).name;
  const subtitle = isUnassigned
    ? 'Players not yet assigned to a squad'
    : ((squad as Team).age_group ? `Age group: ${(squad as Team).age_group}` : undefined);

  const grouped: Record<string, Player[]> = {};
  for (const p of players) {
    const g = posGroup(p.position);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(p);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        <p className="text-xs text-slate-400 mt-0.5">{players.length} player{players.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {players.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-slate-400">
            {isUnassigned ? 'All players are assigned to squads.' : 'No players in this squad yet.'}
          </div>
        )}
        {GROUP_ORDER.filter(g => grouped[g]?.length).map(g => (
          <div key={g}>
            <div className="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
              {g}
            </div>
            {grouped[g].map(p => (
              <PlayerRow key={p.id} player={p} teams={teams} onMoveClick={onMoveClick} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Move player dialog ───────────────────────────────────────────────────────

function MoveDialog({
  player,
  teams,
  onConfirm,
  onClose,
  saving,
}: {
  player: Player;
  teams: Team[];
  onConfirm: (toTeamId: string | null) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const currentTeam = teams.find(t => t.id === player.team_id);
  const [toTeamId, setToTeamId] = useState<string>(player.team_id ?? '');

  const toLabel = toTeamId ? (teams.find(t => t.id === toTeamId)?.name ?? '—') : 'Unassigned';
  const unchanged = toTeamId === (player.team_id ?? '');

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move player</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
            <p className="font-semibold text-slate-800">{player.name}</p>
            <p className="text-slate-500 mt-0.5">
              Current squad: <span className="font-medium text-slate-700">{currentTeam?.name ?? 'Unassigned'}</span>
            </p>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Move to squad</label>
            <select
              value={toTeamId}
              onChange={e => setToTeamId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="">Unassigned</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.age_group ? ` (${t.age_group})` : ''}</option>
              ))}
            </select>
          </div>

          {!unchanged && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This will move <strong>{player.name}</strong> to <strong>{toLabel}</strong>. This action can be reversed by moving them again.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(toTeamId || null)}
              disabled={saving || unchanged}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Moving…' : 'Confirm move'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Squads() {
  const { activeContext } = useActiveContext();
  const clubId = activeContext?.clubId ?? null;
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | 'unassigned' | null>(null);
  const [moveTarget, setMoveTarget] = useState<Player | null>(null);
  const [moving, setMoving] = useState(false);

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['squads-teams', clubId],
    enabled: !!clubId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb.from('teams').select('id, name, age_group').eq('club_id', clubId!).order('age_group');
      return (data ?? []) as Team[];
    },
  });

  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ['squads-players', clubId],
    enabled: !!clubId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await sb.from('players').select('id, name, position, availability, team_id').eq('club_id', clubId!).order('name');
      return (data ?? []) as Player[];
    },
  });

  const loading = teamsLoading || playersLoading;

  const playersByTeam = (teamId: string | null) =>
    players.filter(p => p.team_id === teamId);

  const unassigned = playersByTeam(null);

  const selectedSquad: Team | 'unassigned' | null =
    selectedId === 'unassigned' ? 'unassigned'
    : selectedId ? (teams.find(t => t.id === selectedId) ?? null)
    : null;

  const rosterPlayers = selectedId === 'unassigned'
    ? unassigned
    : selectedId ? playersByTeam(selectedId)
    : [];

  const handleMove = async (toTeamId: string | null) => {
    if (!moveTarget) return;
    setMoving(true);
    await sb.from('players').update({ team_id: toTeamId }).eq('id', moveTarget.id);
    setMoving(false);
    setMoveTarget(null);
    qc.invalidateQueries({ queryKey: ['squads-players', clubId] });
    // If we moved the last player out of the selected squad, keep selection
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Squads"
        subtitle={loading ? 'Loading…' : `${teams.length} squad${teams.length !== 1 ? 's' : ''} · ${players.length} players`}
      />

      {/* Origin Sports note */}
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>Squads are managed in Origin Sports. Use the sync button in your profile to pull the latest squad structure.</span>
      </div>

      <div className="mt-6 flex gap-6 items-start">
        {/* ── Squad list (left) ──────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 space-y-2">
          {loading && (
            <div className="text-sm text-slate-400 text-center py-8">Loading squads…</div>
          )}

          {!loading && teams.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
              No squads found. Sync from Origin Sports to pull squad data.
            </div>
          )}

          {teams.map(team => {
            const count = playersByTeam(team.id).length;
            const active = selectedId === team.id;
            return (
              <button
                key={team.id}
                onClick={() => setSelectedId(active ? null : team.id)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                  active
                    ? 'border-violet-300 bg-violet-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${active ? 'text-violet-700' : 'text-slate-800'}`}>
                    {team.name}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    active ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </div>
                {team.age_group && (
                  <div className="text-xs text-slate-400 mt-0.5">{team.age_group}</div>
                )}
              </button>
            );
          })}

          {/* Unassigned bucket */}
          {!loading && unassigned.length > 0 && (
            <button
              onClick={() => setSelectedId(selectedId === 'unassigned' ? null : 'unassigned')}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all mt-2 ${
                selectedId === 'unassigned'
                  ? 'border-slate-400 bg-slate-100 shadow-sm'
                  : 'border-dashed border-slate-300 bg-slate-50 hover:border-slate-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-500">Unassigned</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                  {unassigned.length}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">No squad assigned</div>
            </button>
          )}
        </div>

        {/* ── Roster panel (right) ───────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {selectedSquad ? (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <RosterPanel
                squad={selectedSquad}
                players={rosterPlayers}
                teams={teams}
                onMoveClick={setMoveTarget}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center py-20 text-center">
              <Users className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Select a squad</p>
              <p className="text-xs text-slate-400 mt-1">Choose a squad from the left to view its players</p>
            </div>
          )}
        </div>
      </div>

      {/* Move dialog */}
      {moveTarget && (
        <MoveDialog
          player={moveTarget}
          teams={teams}
          onConfirm={handleMove}
          onClose={() => setMoveTarget(null)}
          saving={moving}
        />
      )}
    </div>
  );
}
