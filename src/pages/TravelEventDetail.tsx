import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Calendar, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ─── Sub-component imports ────────────────────────────────────────────────────
// Each import below will be uncommented once the file exists in
// src/components/travel/. Until then the inline placeholder is rendered.
//
// import { TravelOverviewTab   } from '@/components/travel/TravelOverviewTab';
// import { TravelItineraryTab  } from '@/components/travel/TravelItineraryTab';
// import { TravelLogisticsTab  } from '@/components/travel/TravelLogisticsTab';
// import { TravelParentViewTab } from '@/components/travel/TravelParentViewTab';
// import { TravelUpdatesTab    } from '@/components/travel/TravelUpdatesTab';
// import { TravelDocumentsTab  } from '@/components/travel/TravelDocumentsTab';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType   = 'tournament' | 'festival' | 'training_camp' | 'friendly_tour';
type EventStatus = 'draft' | 'planning' | 'confirmed' | 'in_progress' | 'complete';

export interface TravelEvent {
  id: string;
  academy_id: string;
  title: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  return_date: string;
  event_type: EventType;
  squads: string[];
  total_budget: number | null;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
}

type TabId = 'overview' | 'itinerary' | 'logistics' | 'parents' | 'updates' | 'documents';

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',   label: 'Event overview' },
  { id: 'itinerary',  label: 'Itinerary'      },
  { id: 'logistics',  label: 'Logistics'      },
  { id: 'parents',    label: 'Parent view'    },
  { id: 'updates',    label: 'Updates'        },
  { id: 'documents',  label: 'Documents'      },
];

// ─── Display config ───────────────────────────────────────────────────────────

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

// ─── Placeholder tab bodies ───────────────────────────────────────────────────
// Each is typed to accept the TravelEvent so the real component can drop in
// with the same props signature once src/components/travel/<Name>.tsx exists.

function TravelOverviewTab({ event }: { event: TravelEvent }) {
  // Replace with: import { TravelOverviewTab } from '@/components/travel/TravelOverviewTab'
  return (
    <Placeholder label="Event overview" hint="src/components/travel/TravelOverviewTab.tsx" />
  );
}

function TravelItineraryTab({ event }: { event: TravelEvent }) {
  // Replace with: import { TravelItineraryTab } from '@/components/travel/TravelItineraryTab'
  return (
    <Placeholder label="Itinerary" hint="src/components/travel/TravelItineraryTab.tsx" />
  );
}

function TravelLogisticsTab({ event }: { event: TravelEvent }) {
  // Replace with: import { TravelLogisticsTab } from '@/components/travel/TravelLogisticsTab'
  return (
    <Placeholder label="Logistics" hint="src/components/travel/TravelLogisticsTab.tsx" />
  );
}

function TravelParentViewTab({ event }: { event: TravelEvent }) {
  // Replace with: import { TravelParentViewTab } from '@/components/travel/TravelParentViewTab'
  return (
    <Placeholder label="Parent view" hint="src/components/travel/TravelParentViewTab.tsx" />
  );
}

function TravelUpdatesTab({ event }: { event: TravelEvent }) {
  // Replace with: import { TravelUpdatesTab } from '@/components/travel/TravelUpdatesTab'
  return (
    <Placeholder label="Updates" hint="src/components/travel/TravelUpdatesTab.tsx" />
  );
}

function TravelDocumentsTab({ event }: { event: TravelEvent }) {
  // Replace with: import { TravelDocumentsTab } from '@/components/travel/TravelDocumentsTab'
  return (
    <Placeholder label="Documents" hint="src/components/travel/TravelDocumentsTab.tsx" />
  );
}

// Shared placeholder shell used by all stub components above.
function Placeholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="mt-2 rounded-xl border-2 border-dashed border-slate-200 p-12
                    flex flex-col items-center justify-center gap-2 text-center">
      <p className="text-slate-500 font-medium">{label}</p>
      <p className="text-xs text-slate-400 font-mono">{hint}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TravelEventDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data: event, isLoading, isError } = useQuery<TravelEvent>({
    queryKey: ['travel-event', id],
    enabled: !!id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_event')
        .select(
          'id, academy_id, title, destination_city, destination_country, ' +
          'departure_date, return_date, event_type, squads, total_budget, ' +
          'status, created_by, created_at',
        )
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as TravelEvent;
    },
  });

  // ── Loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Link to="/travel" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Travel Events
        </Link>
        <div className="text-center text-sm text-slate-400 mt-20">Loading…</div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Link to="/travel" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Travel Events
        </Link>
        <div className="text-center text-sm text-red-500 mt-20">Event not found.</div>
      </div>
    );
  }

  // ── Derived display values ────────────────────────────────────────────────

  const status  = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.draft;
  const n       = nightCount(event.departure_date, event.return_date);

  // ── Tab content map ───────────────────────────────────────────────────────

  const tabContent: Record<TabId, React.ReactNode> = {
    overview:  <TravelOverviewTab   event={event} />,
    itinerary: <TravelItineraryTab  event={event} />,
    logistics: <TravelLogisticsTab  event={event} />,
    parents:   <TravelParentViewTab event={event} />,
    updates:   <TravelUpdatesTab    event={event} />,
    documents: <TravelDocumentsTab  event={event} />,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Back link */}
      <Link
        to="/travel"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400
                   hover:text-slate-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Travel Events
      </Link>

      {/* Event header */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              {event.title}
            </h1>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
              {status.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {event.destination_city}, {event.destination_country}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              {fmtDate(event.departure_date)} → {fmtDate(event.return_date)}
              <span className="text-slate-400">· {n}n</span>
            </span>
            {event.squads.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                {event.squads.join(', ')}
              </span>
            )}
          </div>

          <div className="mt-2">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded
                              ${EVENT_TYPE_STYLE[event.event_type]}`}>
              {EVENT_TYPE_LABELS[event.event_type]}
            </span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mt-6 flex gap-0 border-b border-slate-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
              border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'border-blue-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active tab body */}
      <div className="mt-1">
        {tabContent[activeTab]}
      </div>

    </div>
  );
}
