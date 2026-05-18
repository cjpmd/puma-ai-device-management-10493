import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Users, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgType } from '@/contexts/OrgTypeContext';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType   = 'tournament' | 'festival' | 'training_camp' | 'friendly_tour';
type EventStatus = 'draft' | 'planning' | 'confirmed' | 'in_progress' | 'complete';

interface ConsentRow { id: string; travel_consent_signed: boolean }

interface TravelEvent {
  id: string;
  title: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  return_date: string;
  event_type: EventType;
  squads: string[];
  total_budget: number | null;
  status: EventStatus;
  travel_player_consent: ConsentRow[];
}

interface CreateForm {
  title: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  return_date: string;
  event_type: EventType | '';
  squads_raw: string;
  total_budget: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  tournament:    'Tournament',
  festival:      'Festival',
  training_camp: 'Training Camp',
  friendly_tour: 'Friendly Tour',
};

const EVENT_TYPE_STYLE: Record<EventType, string> = {
  tournament:    'bg-rose-50 text-rose-700',
  festival:      'bg-amber-50 text-amber-700',
  training_camp: 'bg-sky-50 text-sky-700',
  friendly_tour: 'bg-violet-50 text-violet-700',
};

const STATUS_CONFIG: Record<EventStatus, { label: string; bg: string; text: string }> = {
  draft:       { label: 'Draft',       bg: 'bg-slate-100',   text: 'text-slate-600'   },
  planning:    { label: 'Planning',    bg: 'bg-amber-100',   text: 'text-amber-700'   },
  confirmed:   { label: 'Confirmed',   bg: 'bg-blue-100',    text: 'text-blue-700'    },
  in_progress: { label: 'In Progress', bg: 'bg-violet-100',  text: 'text-violet-700'  },
  complete:    { label: 'Complete',    bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

const INPUT_CLS =
  'rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 ' +
  'px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full';

const blank = (): CreateForm => ({
  title: '', destination_city: '', destination_country: '',
  departure_date: '', return_date: '', event_type: '',
  squads_raw: '', total_budget: '',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function nightCount(dep: string, ret: string) {
  return Math.round(
    (new Date(ret).getTime() - new Date(dep).getTime()) / 86_400_000,
  );
}

function prepStats(consents: ConsentRow[]) {
  const total  = consents.length;
  const signed = consents.filter(c => c.travel_consent_signed).length;
  const pct    = total === 0 ? 0 : Math.round((signed / total) * 100);
  return { total, signed, pct };
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onClick }: { event: TravelEvent; onClick: () => void }) {
  const status = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.draft;
  const { total, signed, pct } = prepStats(event.travel_player_consent);
  const n = nightCount(event.departure_date, event.return_date);

  const barColour =
    pct === 100 ? 'bg-emerald-500' :
    pct >= 50   ? 'bg-amber-400'   :
                  'bg-slate-300';

  const pctColour =
    pct === 100 ? 'text-emerald-600' :
    pct >= 50   ? 'text-amber-600'   :
                  'text-slate-500';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-slate-200 p-4
                 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      {/* Title + status badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-800 truncate leading-snug
                      group-hover:text-blue-700 transition-colors">
          {event.title}
        </p>
        <span className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full
                          ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>

      {/* Destination */}
      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
        <MapPin className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{event.destination_city}, {event.destination_country}</span>
      </div>

      {/* Event type pill */}
      <div className="mt-2.5">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded
                          ${EVENT_TYPE_STYLE[event.event_type]}`}>
          {EVENT_TYPE_LABELS[event.event_type]}
        </span>
      </div>

      {/* Dates */}
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{fmtDate(event.departure_date)} → {fmtDate(event.return_date)}</span>
        <span className="text-slate-300">·</span>
        <span>{n}n</span>
      </div>

      {/* Squads */}
      {event.squads.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{event.squads.join(', ')}</span>
        </div>
      )}

      {/* Prep completion bar */}
      <div className="mt-3">
        {total > 0 ? (
          <>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">Prep completion</span>
              <span className={`font-medium ${pctColour}`}>
                {signed}/{total} · {pct}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColour}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400 italic">No players added yet</p>
        )}
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TravelEvents() {
  const { academyId } = useOrgType();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState<CreateForm>(blank());
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: events = [], isLoading } = useQuery<TravelEvent[]>({
    queryKey: ['travel-events', academyId],
    enabled: !!academyId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_event')
        .select(`
          id, title, destination_city, destination_country,
          departure_date, return_date, event_type, squads,
          total_budget, status,
          travel_player_consent (id, travel_consent_signed)
        `)
        .eq('academy_id', academyId!)
        .order('departure_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Create ────────────────────────────────────────────────────────────────

  const set =
    (k: keyof CreateForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const canSubmit =
    !!form.title && !!form.destination_city && !!form.destination_country &&
    !!form.departure_date && !!form.return_date && !!form.event_type;

  const handleCreate = async () => {
    if (!academyId || !canSubmit) return;
    setSaving(true);
    setSaveError(null);
    const squads = form.squads_raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const { error } = await (supabase as any).from('travel_event').insert({
      academy_id:          academyId,
      title:               form.title,
      destination_city:    form.destination_city,
      destination_country: form.destination_country,
      departure_date:      form.departure_date,
      return_date:         form.return_date,
      event_type:          form.event_type,
      squads,
      total_budget: form.total_budget ? parseFloat(form.total_budget) : null,
    });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setForm(blank());
    setShowCreate(false);
    qc.invalidateQueries({ queryKey: ['travel-events', academyId] });
  };

  const closeCreate = () => {
    setShowCreate(false);
    setForm(blank());
    setSaveError(null);
  };

  // ── Partition into upcoming / completed ──────────────────────────────────

  const upcoming = events.filter(e => e.status !== 'complete');
  const past     = events.filter(e => e.status === 'complete');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Travel Events"
        subtitle={
          isLoading
            ? 'Loading…'
            : `${upcoming.length} upcoming${past.length ? `, ${past.length} complete` : ''}`
        }
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                       bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New travel event
          </button>
        }
      />

      {isLoading && (
        <div className="mt-10 text-center text-sm text-slate-400">Loading events…</div>
      )}

      {!isLoading && events.length === 0 && (
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <MapPin className="w-10 h-10 text-slate-300" />
          <p className="text-slate-500 font-medium">No travel events yet</p>
          <p className="text-sm text-slate-400">Create your first event to start planning</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Upcoming
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map(ev => (
              <EventCard key={ev.id} event={ev} onClick={() => navigate(`/travel/${ev.id}`)} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Completed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
            {past.map(ev => (
              <EventCard key={ev.id} event={ev} onClick={() => navigate(`/travel/${ev.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Create dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) closeCreate(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New travel event</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-slate-500">Title *</span>
              <input
                value={form.title}
                onChange={set('title')}
                placeholder="e.g. Barcelona Festival 2026"
                className={INPUT_CLS}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Destination city *</span>
              <input
                value={form.destination_city}
                onChange={set('destination_city')}
                placeholder="Barcelona"
                className={INPUT_CLS}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Country *</span>
              <input
                value={form.destination_country}
                onChange={set('destination_country')}
                placeholder="Spain"
                className={INPUT_CLS}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Departure date *</span>
              <input
                type="date"
                value={form.departure_date}
                onChange={set('departure_date')}
                className={INPUT_CLS}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Return date *</span>
              <input
                type="date"
                value={form.return_date}
                onChange={set('return_date')}
                className={INPUT_CLS}
              />
            </label>

            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-slate-500">Event type *</span>
              <select value={form.event_type} onChange={set('event_type')} className={INPUT_CLS}>
                <option value="">Select type…</option>
                <option value="tournament">Tournament</option>
                <option value="festival">Festival</option>
                <option value="training_camp">Training Camp</option>
                <option value="friendly_tour">Friendly Tour</option>
              </select>
            </label>

            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-slate-500">Squads (comma-separated age groups)</span>
              <input
                value={form.squads_raw}
                onChange={set('squads_raw')}
                placeholder="U12, U13, U14"
                className={INPUT_CLS}
              />
            </label>

            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-slate-500">Total budget (£)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.total_budget}
                onChange={set('total_budget')}
                placeholder="0.00"
                className={INPUT_CLS}
              />
            </label>
          </div>

          {saveError && (
            <p className="mt-2 text-xs text-red-500">{saveError}</p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={closeCreate}
              className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !canSubmit}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white
                         hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Creating…' : 'Create event'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
