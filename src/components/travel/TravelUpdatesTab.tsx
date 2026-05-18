import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Send, Info, AlertTriangle, AlertCircle, Bell, BellOff,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TravelEvent } from '@/pages/TravelEventDetail';

// ─── Types ──────────────────────────────────────────────────────────────────

type UpdateType = 'info' | 'warning' | 'urgent';

interface TravelUpdateRow {
  id: string;
  title: string;
  body: string;
  update_type: UpdateType;
  target_squads: string[];
  posted_at: string;
  sent_push: boolean;
}

interface UpdateForm {
  title: string;
  body: string;
  update_type: UpdateType;
  target_squads: string[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const UPDATE_TYPES: UpdateType[] = ['info', 'warning', 'urgent'];

const UPDATE_TYPE_CFG: Record<UpdateType, {
  label: string;
  pillCls: string;
  activeCls: string;
  borderCls: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  info:    {
    label: 'Info',    Icon: Info,
    pillCls:   'bg-blue-50 text-blue-700',
    activeCls: 'bg-blue-500 text-white border-blue-500',
    borderCls: 'border-blue-200',
  },
  warning: {
    label: 'Warning', Icon: AlertTriangle,
    pillCls:   'bg-amber-50 text-amber-700',
    activeCls: 'bg-amber-500 text-white border-amber-500',
    borderCls: 'border-amber-200',
  },
  urgent:  {
    label: 'Urgent',  Icon: AlertCircle,
    pillCls:   'bg-red-50 text-red-700',
    activeCls: 'bg-red-500 text-white border-red-500',
    borderCls: 'border-red-200',
  },
};

const INPUT_CLS =
  'rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 ' +
  'px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full';

const blankForm = (): UpdateForm => ({
  title: '', body: '', update_type: 'info', target_squads: [],
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── UpdateFormPanel (defined outside to keep stable identity) ──────────────────

function UpdateFormPanel({
  form, saving, squads, onChange, onToggleSquad, onSetType, onSubmit, onCancel,
}: {
  form: UpdateForm;
  saving: boolean;
  squads: string[];
  onChange: (k: 'title' | 'body') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onToggleSquad: (squad: string) => void;
  onSetType: (t: UpdateType) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const canSubmit = !!form.title.trim() && !!form.body.trim();

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">

      {/* Type selector */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">Type *</p>
        <div className="flex gap-2">
          {UPDATE_TYPES.map(t => {
            const cfg     = UPDATE_TYPE_CFG[t];
            const TypeIcon = cfg.Icon;
            const active  = form.update_type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onSetType(t)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm
                  font-medium transition-colors
                  ${active ? cfg.activeCls : `bg-white border-slate-200 text-slate-600
                              hover:${cfg.pillCls}`}
                `}
              >
                <TypeIcon className="w-3.5 h-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Title *</span>
        <input
          value={form.title}
          onChange={onChange('title')}
          placeholder="e.g. Departure time updated"
          className={INPUT_CLS}
        />
      </label>

      {/* Body */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Message *</span>
        <textarea
          value={form.body}
          onChange={onChange('body')}
          placeholder="Write your message to parents…"
          rows={4}
          className={INPUT_CLS + ' resize-none'}
        />
      </label>

      {/* Target squads */}
      {squads.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">
            Target squads
            <span className="ml-1 text-slate-400">
              (leave empty to send to all)
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {squads.map(squad => {
              const active = form.target_squads.includes(squad);
              return (
                <button
                  key={squad}
                  type="button"
                  onClick={() => onToggleSquad(squad)}
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium
                    border transition-colors
                    ${active
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}
                  `}
                >
                  {squad}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-500 hover:bg-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={saving || !canSubmit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                     bg-blue-600 text-white hover:bg-blue-700
                     disabled:opacity-40 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          {saving ? 'Posting…' : 'Post update'}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────────

export function TravelUpdatesTab({ event }: { event: TravelEvent }) {
  const qc = useQueryClient();

  const [filterSquad, setFilterSquad] = useState<string | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState<UpdateForm>(blankForm());
  const [posting,     setPosting]     = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  // ── Query ───────────────────────────────────────────────────────────────

  const { data: updates = [], isLoading } = useQuery<TravelUpdateRow[]>({
    // Shared cache key with TravelParentView messages tab
    queryKey: ['travel-updates', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_update')
        .select('id, title, body, update_type, target_squads, posted_at, sent_push')
        .eq('travel_event_id', event.id)
        .order('posted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TravelUpdateRow[];
    },
  });

  // ── Derived ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!filterSquad) return updates;
    return updates.filter(
      u => u.target_squads.length === 0 || u.target_squads.includes(filterSquad),
    );
  }, [updates, filterSquad]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const onChange =
    (k: 'title' | 'body') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const onToggleSquad = (squad: string) =>
    setForm(prev => ({
      ...prev,
      target_squads: prev.target_squads.includes(squad)
        ? prev.target_squads.filter(s => s !== squad)
        : [...prev.target_squads, squad],
    }));

  const onSetType = (t: UpdateType) =>
    setForm(prev => ({ ...prev, update_type: t }));

  const handlePost = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setPosting(true);

    const { data: inserted, error } = await (supabase as any)
      .from('travel_update')
      .insert({
        travel_event_id: event.id,
        title:           form.title.trim(),
        body:            form.body.trim(),
        update_type:     form.update_type,
        target_squads:   form.target_squads,
        sent_push:       false,
      })
      .select('id')
      .single();

    setPosting(false);

    if (error) {
      console.error('Failed to post travel update:', error);
      return;
    }

    setForm(blankForm());
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['travel-updates', event.id] });

    // Fire and forget — push notification delivery
    supabase.functions
      .invoke('send-travel-update', {
        body: { travel_update_id: inserted.id, travel_event_id: event.id },
      })
      .then(({ error: fnErr }) => {
        if (fnErr) console.warn('send-travel-update edge function error:', fnErr);
        else qc.invalidateQueries({ queryKey: ['travel-updates', event.id] });
      })
      .catch(err => console.warn('send-travel-update invoke failed:', err));
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await (supabase as any).from('travel_update').delete().eq('id', id);
    setDeletingId(null);
    qc.invalidateQueries({ queryKey: ['travel-updates', event.id] });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 space-y-4">

      {/* ── Header row ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {updates.length} update{updates.length !== 1 ? 's' : ''}
        </p>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setForm(blankForm()); }}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600
                       hover:text-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Post update
          </button>
        )}
      </div>

      {/* ── Post form ───────────────────────────────────────────────── */}
      {showForm && (
        <UpdateFormPanel
          form={form}
          saving={posting}
          squads={event.squads}
          onChange={onChange}
          onToggleSquad={onToggleSquad}
          onSetType={onSetType}
          onSubmit={handlePost}
          onCancel={() => { setShowForm(false); setForm(blankForm()); }}
        />
      )}

      {/* ── Squad filter pills ───────────────────────────────────────── */}
      {event.squads.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterSquad(null)}
            className={`
              px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
              ${filterSquad === null
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}
            `}
          >
            All squads
          </button>
          {event.squads.map(squad => (
            <button
              key={squad}
              onClick={() => setFilterSquad(filterSquad === squad ? null : squad)}
              className={`
                px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                ${filterSquad === squad
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}
              `}
            >
              {squad}
            </button>
          ))}
        </div>
      )}

      {/* ── Updates list ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 rounded-xl border-2 border-dashed border-slate-200
                        flex flex-col items-center gap-3">
          {updates.length === 0 ? (
            <>
              <Bell className="w-8 h-8 text-slate-200" />
              <p className="text-sm text-slate-400">No updates posted yet</p>
              {!showForm && (
                <button
                  onClick={() => { setShowForm(true); setForm(blankForm()); }}
                  className="flex items-center gap-1 text-xs text-blue-600
                             hover:text-blue-700 font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" /> Post first update
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">No updates for this squad</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(update => {
            const cfg        = UPDATE_TYPE_CFG[update.update_type] ?? UPDATE_TYPE_CFG.info;
            const UpdateIcon = cfg.Icon;
            const isDeleting = deletingId === update.id;

            return (
              <div
                key={update.id}
                className={`bg-white rounded-xl border p-4 ${cfg.borderCls}`}
              >
                <div className="flex items-start gap-3">
                  {/* Type icon */}
                  <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full
                                   flex items-center justify-center ${cfg.pillCls}`}>
                    <UpdateIcon className="w-3.5 h-3.5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-slate-800">{update.title}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded
                                        ${cfg.pillCls}`}>
                        {cfg.label}
                      </span>
                      {/* Push sent badge */}
                      {update.sent_push
                        ? <span className="inline-flex items-center gap-0.5 text-[10px]
                                           text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Bell className="w-2.5 h-2.5" /> Sent
                          </span>
                        : <span className="inline-flex items-center gap-0.5 text-[10px]
                                           text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            <BellOff className="w-2.5 h-2.5" /> Not sent
                          </span>}
                    </div>

                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed
                                  whitespace-pre-line">
                      {update.body}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs text-slate-400">
                        {fmtDatetime(update.posted_at)}
                      </span>
                      {/* Target squads */}
                      {update.target_squads.length === 0 ? (
                        <span className="text-[10px] text-slate-400 bg-slate-100
                                         px-1.5 py-0.5 rounded">
                          All squads
                        </span>
                      ) : (
                        update.target_squads.map(squad => (
                          <span key={squad}
                            className="text-[10px] text-blue-600 bg-blue-50
                                       px-1.5 py-0.5 rounded">
                            {squad}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(update.id)}
                    disabled={isDeleting}
                    title="Delete"
                    className="flex-shrink-0 p-1.5 rounded text-slate-300
                               hover:text-red-500 hover:bg-red-50
                               transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
