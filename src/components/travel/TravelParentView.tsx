import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, Calendar, Users,
  Plane, Bus, Train, Ship,
  Building2, MessageSquare,
  Trophy, Activity, Utensils, Smile, Star, Moon,
  CheckCircle2, Circle,
  Info, AlertTriangle, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TravelEvent } from '@/pages/TravelEventDetail';

// ─── Types ──────────────────────────────────────────────────────────────────

type ParentTab  = 'trip' | 'itinerary' | 'messages' | 'consent';
type ItemType   = 'travel' | 'match' | 'training' | 'meal' | 'free_time' | 'ceremony' | 'curfew';
type UpdateType = 'info' | 'warning' | 'urgent';

interface ItineraryItem {
  id: string;
  day_date: string;
  item_time: string | null;
  title: string;
  description: string | null;
  location: string | null;
  item_type: ItemType;
}

interface TravelUpdateRow {
  id: string;
  title: string;
  body: string;
  update_type: UpdateType;
  posted_at: string;
  target_squads: string[];
}

interface PlayerConsent {
  id: string;
  player_id: string;
  travel_consent_signed: boolean;
  passport_submitted: boolean;
  medical_declaration_signed: boolean;
  photo_consent: boolean;
  emergency_contact_confirmed: boolean;
  dietary_requirements: string | null;
  passport_expiry: string | null;
  signed_at: string | null;
  players: { id: string; name: string } | null;
}

interface TransportLeg {
  id: string;
  leg_order: number;
  transport_type: 'flight' | 'coach' | 'train' | 'ferry';
  provider: string | null;
  reference_number: string | null;
  departure_location: string | null;
  arrival_location: string | null;
  departure_datetime: string | null;
  arrival_datetime: string | null;
  notes: string | null;
}

interface Accommodation {
  id: string;
  hotel_name: string;
  address: string | null;
  phone: string | null;
  check_in: string | null;
  check_out: string | null;
  room_count: number | null;
  meal_plan: string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const PARENT_TABS: { id: ParentTab; label: string }[] = [
  { id: 'trip',      label: 'Trip info'      },
  { id: 'itinerary', label: 'Itinerary'      },
  { id: 'messages',  label: 'Messages'       },
  { id: 'consent',   label: 'Consent status' },
];

const UPDATE_TYPE_CFG: Record<UpdateType, {
  label: string;
  pillCls: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  info:    { label: 'Info',    pillCls: 'bg-blue-50 text-blue-700',   Icon: Info          },
  warning: { label: 'Warning', pillCls: 'bg-amber-50 text-amber-700', Icon: AlertTriangle },
  urgent:  { label: 'Urgent',  pillCls: 'bg-red-50 text-red-700',     Icon: AlertCircle   },
};

const TRANSPORT_CFG: Record<string, {
  label: string;
  dotBg: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  flight: { label: 'Flight', dotBg: 'bg-sky-500',    Icon: Plane  },
  coach:  { label: 'Coach',  dotBg: 'bg-amber-500',  Icon: Bus    },
  train:  { label: 'Train',  dotBg: 'bg-violet-500', Icon: Train  },
  ferry:  { label: 'Ferry',  dotBg: 'bg-blue-500',   Icon: Ship   },
};

const ITEM_TYPE_CFG: Record<ItemType, {
  dotBg: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  travel:    { dotBg: 'bg-blue-500',    Icon: Plane     },
  match:     { dotBg: 'bg-rose-500',    Icon: Trophy    },
  training:  { dotBg: 'bg-violet-500',  Icon: Activity  },
  meal:      { dotBg: 'bg-amber-500',   Icon: Utensils  },
  free_time: { dotBg: 'bg-emerald-500', Icon: Smile     },
  ceremony:  { dotBg: 'bg-yellow-500',  Icon: Star      },
  curfew:    { dotBg: 'bg-slate-400',   Icon: Moon      },
};

const CONSENT_FIELDS = [
  { key: 'travel_consent_signed'       as const, label: 'Consent'   },
  { key: 'passport_submitted'          as const, label: 'Passport'  },
  { key: 'medical_declaration_signed'  as const, label: 'Medical'   },
  { key: 'photo_consent'               as const, label: 'Photo'     },
  { key: 'emergency_contact_confirmed' as const, label: 'Emergency' },
];

const EVENT_TYPE_STYLE: Record<string, string> = {
  tournament:    'bg-rose-50 text-rose-700',
  festival:      'bg-amber-50 text-amber-700',
  training_camp: 'bg-sky-50 text-sky-700',
  friendly_tour: 'bg-violet-50 text-violet-700',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  tournament:    'Tournament',
  festival:      'Festival',
  training_camp: 'Training Camp',
  friendly_tour: 'Friendly Tour',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtDatetime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : '';
}

function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cur  = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  while (cur <= last) {
    days.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
    );
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function fmtDayTab(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// ─── Main component ────────────────────────────────────────────────────────────────

export function TravelParentViewTab({ event }: { event: TravelEvent }) {
  const [activeTab,    setActiveTab]    = useState<ParentTab>('trip');
  const [selectedDay,  setSelectedDay]  = useState(event.departure_date);

  const days = useMemo(
    () => dateRange(event.departure_date, event.return_date),
    [event.departure_date, event.return_date],
  );

  // ── Queries ──────────────────────────────────────────────────────────────

  // Shared cache keys with TravelLogisticsTab
  const { data: legs = [] } = useQuery<TransportLeg[]>({
    queryKey: ['travel-legs', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_transport_leg')
        .select(
          'id, leg_order, transport_type, provider, reference_number, ' +
          'departure_location, arrival_location, departure_datetime, arrival_datetime, notes',
        )
        .eq('travel_event_id', event.id)
        .order('leg_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TransportLeg[];
    },
  });

  const { data: accoms = [] } = useQuery<Accommodation[]>({
    queryKey: ['travel-accom', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_accommodation')
        .select('id, hotel_name, address, phone, check_in, check_out, room_count, meal_plan')
        .eq('travel_event_id', event.id)
        .order('check_in', { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as Accommodation[];
    },
  });

  // Separate cache: only visible_to_parents items
  const { data: allItems = [], isLoading: itemsLoading } = useQuery<ItineraryItem[]>({
    queryKey: ['travel-itinerary-parents', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_itinerary_item')
        .select('id, day_date, item_time, title, description, location, item_type')
        .eq('travel_event_id', event.id)
        .eq('visible_to_parents', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItineraryItem[];
    },
  });

  const { data: updates = [], isLoading: updatesLoading } = useQuery<TravelUpdateRow[]>({
    queryKey: ['travel-updates', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_update')
        .select('id, title, body, update_type, posted_at, target_squads')
        .eq('travel_event_id', event.id)
        .order('posted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TravelUpdateRow[];
    },
  });

  const { data: consents = [], isLoading: consentsLoading } = useQuery<PlayerConsent[]>({
    queryKey: ['travel-consents-parent', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_player_consent')
        .select(
          'id, player_id, travel_consent_signed, passport_submitted, ' +
          'medical_declaration_signed, photo_consent, emergency_contact_confirmed, ' +
          'dietary_requirements, passport_expiry, signed_at, players(id, name)',
        )
        .eq('travel_event_id', event.id);
      if (error) throw error;
      return (data ?? []) as PlayerConsent[];
    },
  });

  // ── Derived ─────────────────────────────────────────────────────────────────

  const dayItems = useMemo(() =>
    allItems
      .filter(i => i.day_date === selectedDay)
      .sort((a, b) => {
        const ta = a.item_time ?? '99:99';
        const tb = b.item_time ?? '99:99';
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      }),
    [allItems, selectedDay],
  );

  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of allItems) map.set(item.day_date, (map.get(item.day_date) ?? 0) + 1);
    return map;
  }, [allItems]);

  const firstLeg   = legs[0]   ?? null;
  const firstAccom = accoms[0] ?? null;
  const nights     = Math.round(
    (new Date(event.return_date).getTime() - new Date(event.departure_date).getTime()) / 86_400_000,
  );
  const legCfg = firstLeg ? (TRANSPORT_CFG[firstLeg.transport_type] ?? TRANSPORT_CFG.flight) : null;

  const consentFullyDone = (c: PlayerConsent) =>
    CONSENT_FIELDS.every(f => c[f.key] === true);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4">

      {/* Banner */}
      <div className="mb-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-2.5
                      flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          Staff preview — only content marked
          <span className="font-medium"> visible to parents</span> is shown.
        </p>
      </div>

      {/* Sub-tab bar */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-0">
        {PARENT_TABS.map(tab => (
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

      <div className="mt-4">

        {/* ══════════════════════ TRIP INFO ═══════════════════════ */}
        {activeTab === 'trip' && (
          <div className="space-y-3">

            {/* Event details */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Event details
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {event.destination_city}, {event.destination_country}
                    </p>
                    <p className="text-xs text-slate-400">Destination</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {fmtDate(event.departure_date)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Returning {fmtDate(event.return_date)}
                      <span className="ml-1.5">· {nights} night{nights !== 1 ? 's' : ''}</span>
                    </p>
                  </div>
                </div>
                {event.squads.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <Users className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {event.squads.join(', ')}
                      </p>
                      <p className="text-xs text-slate-400">Squads travelling</p>
                    </div>
                  </div>
                )}
                <div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded
                                    ${EVENT_TYPE_STYLE[event.event_type] ?? 'bg-slate-100 text-slate-600'}`}>
                    {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                  </span>
                </div>
              </div>
            </div>

            {/* Getting there */}
            {firstLeg && legCfg && (() => {
              const LegIcon = legCfg.Icon;
              return (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                    Getting there
                  </p>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full
                                     flex items-center justify-center ${legCfg.dotBg}`}>
                      <LegIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {firstLeg.departure_location ?? '—'} → {firstLeg.arrival_location ?? '—'}
                      </p>
                      {firstLeg.departure_datetime && (
                        <p className="text-sm text-slate-600 mt-0.5">
                          Departs {fmtDatetime(firstLeg.departure_datetime)}
                        </p>
                      )}
                      {firstLeg.arrival_datetime && (
                        <p className="text-xs text-slate-400">
                          Arrives {fmtDatetime(firstLeg.arrival_datetime)}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
                        {firstLeg.provider         && <span>{firstLeg.provider}</span>}
                        {firstLeg.reference_number && <span>Ref: {firstLeg.reference_number}</span>}
                      </div>
                      {firstLeg.notes && (
                        <p className="mt-1.5 text-xs text-slate-400 leading-snug">{firstLeg.notes}</p>
                      )}
                    </div>
                  </div>
                  {legs.length > 1 && (
                    <p className="mt-2 text-xs text-slate-400">
                      + {legs.length - 1} more transport leg{legs.length > 2 ? 's' : ''}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Accommodation */}
            {firstAccom && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Accommodation
                </p>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full
                                  flex items-center justify-center bg-violet-500">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{firstAccom.hotel_name}</p>
                    {firstAccom.address && (
                      <p className="text-xs text-slate-400 mt-0.5">{firstAccom.address}</p>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Check-in</p>
                        <p className="text-sm text-slate-700">{fmtDatetime(firstAccom.check_in)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Check-out</p>
                        <p className="text-sm text-slate-700">{fmtDatetime(firstAccom.check_out)}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-slate-400">
                      {firstAccom.phone    && <span>Tel: {firstAccom.phone}</span>}
                      {firstAccom.meal_plan && <span>Meals: {firstAccom.meal_plan}</span>}
                    </div>
                  </div>
                </div>
                {accoms.length > 1 && (
                  <p className="mt-2 text-xs text-slate-400">
                    + {accoms.length - 1} more accommodation{accoms.length > 2 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Questions */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500 leading-relaxed">
                Questions about meeting points, packing lists, or any other arrangements?
                Please contact your academy manager directly.
              </p>
            </div>

          </div>
        )}

        {/* ════════════════════ ITINERARY ═══════════════════════ */}
        {activeTab === 'itinerary' && (
          <div>
            {/* Day selector */}
            <div className="flex border-b border-slate-200 overflow-x-auto gap-0">
              {days.map(day => {
                const count = countByDay.get(day) ?? 0;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`
                      flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap
                      transition-colors border-b-2 -mb-px flex-shrink-0
                      ${selectedDay === day
                        ? 'border-blue-500 text-slate-900 font-medium'
                        : 'border-transparent text-slate-500 hover:text-slate-700'}
                    `}
                  >
                    {fmtDayTab(day)}
                    {count > 0 && (
                      <span className={`
                        text-[10px] font-medium px-1.5 py-0.5 rounded-full
                        min-w-[18px] text-center
                        ${selectedDay === day
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-500'}
                      `}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              {itemsLoading ? (
                <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
              ) : dayItems.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-400">Nothing scheduled for this day yet</p>
                </div>
              ) : (
                <div>
                  {dayItems.map((item, idx) => {
                    const cfg    = ITEM_TYPE_CFG[item.item_type] ?? ITEM_TYPE_CFG.travel;
                    const { Icon } = cfg;
                    const isLast = idx === dayItems.length - 1;
                    return (
                      <div key={item.id} className="flex gap-3">
                        {/* Time */}
                        <div className="w-12 pt-1.5 text-right flex-shrink-0">
                          <span className="text-xs text-slate-400 tabular-nums leading-tight block">
                            {fmtTime(item.item_time)}
                          </span>
                        </div>
                        {/* Icon dot + connecting line */}
                        <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                          <div className={`w-7 h-7 rounded-full flex items-center
                                           justify-center ${cfg.dotBg} flex-shrink-0`}>
                            <Icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          {!isLast && (
                            <div className="w-px bg-slate-200 flex-1 my-1 min-h-[16px]" />
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 pb-5 min-w-0">
                          <p className="text-sm font-medium text-slate-800 pt-0.5">{item.title}</p>
                          {item.location && (
                            <p className="text-xs text-slate-400 mt-0.5">{item.location}</p>
                          )}
                          {item.description && (
                            <p className="text-sm text-slate-500 mt-1 leading-snug">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════ MESSAGES ════════════════════════ */}
        {activeTab === 'messages' && (
          <div className="space-y-3">
            {updatesLoading ? (
              <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
            ) : updates.length === 0 ? (
              <div className="py-12 rounded-xl border-2 border-dashed border-slate-200
                              flex flex-col items-center gap-3">
                <MessageSquare className="w-8 h-8 text-slate-200" />
                <p className="text-sm text-slate-400">No messages yet</p>
              </div>
            ) : updates.map(update => {
              const cfg = UPDATE_TYPE_CFG[update.update_type] ?? UPDATE_TYPE_CFG.info;
              const UpdateIcon = cfg.Icon;
              return (
                <div key={update.id}
                  className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full
                                     flex items-center justify-center ${cfg.pillCls}`}>
                      <UpdateIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{update.title}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded
                                          ${cfg.pillCls}`}>
                          {cfg.label}
                        </span>
                        {update.target_squads.length > 0 && (
                          <span className="text-[10px] text-slate-400">
                            {update.target_squads.join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
                        {update.body}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        {fmtDatetime(update.posted_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════ CONSENT STATUS ═══════════════════ */}
        {activeTab === 'consent' && (
          <div>
            {consentsLoading ? (
              <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
            ) : consents.length === 0 ? (
              <div className="py-12 rounded-xl border-2 border-dashed border-slate-200
                              flex flex-col items-center gap-2">
                <p className="text-sm text-slate-400">No players added to this event yet</p>
              </div>
            ) : (
              <div className="space-y-2">

                {/* Desktop column headers */}
                <div className="hidden sm:grid px-3 pb-1 gap-x-3"
                     style={{ gridTemplateColumns: '1fr repeat(5, 64px)' }}>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                    Player
                  </span>
                  {CONSENT_FIELDS.map(f => (
                    <span key={f.key}
                      className="text-[10px] font-medium text-slate-400 uppercase
                                 tracking-wide text-center">
                      {f.label}
                    </span>
                  ))}
                </div>

                {consents.map(consent => {
                  const name    = consent.players?.name ?? 'Unknown player';
                  const allDone = consentFullyDone(consent);
                  return (
                    <div key={consent.id}
                      className="bg-white rounded-xl border border-slate-200 p-3">

                      {/* Desktop row */}
                      <div className="hidden sm:grid items-center gap-x-3"
                           style={{ gridTemplateColumns: '1fr repeat(5, 64px)' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                          {consent.dietary_requirements && (
                            <p className="text-xs text-slate-400 truncate">
                              Diet: {consent.dietary_requirements}
                            </p>
                          )}
                          {consent.passport_expiry && (
                            <p className="text-xs text-slate-400">
                              Passport exp: {fmtDate(consent.passport_expiry)}
                            </p>
                          )}
                        </div>
                        {CONSENT_FIELDS.map(f => {
                          const checked = consent[f.key] as boolean;
                          return (
                            <div key={f.key} className="flex justify-center">
                              {checked
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                : <Circle       className="w-4 h-4 text-slate-200"   />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Mobile card */}
                      <div className="sm:hidden">
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="text-sm font-medium text-slate-800">{name}</p>
                          {allDone
                            ? <span className="text-[10px] text-emerald-600 bg-emerald-50
                                               px-1.5 py-0.5 rounded font-medium">
                                All complete
                              </span>
                            : <span className="text-[10px] text-amber-600 bg-amber-50
                                               px-1.5 py-0.5 rounded font-medium">
                                Incomplete
                              </span>}
                        </div>
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                          {CONSENT_FIELDS.map(f => {
                            const checked = consent[f.key] as boolean;
                            return (
                              <div key={f.key} className="flex items-center gap-1.5">
                                {checked
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  : <Circle       className="w-3.5 h-3.5 text-slate-300 flex-shrink-0"   />}
                                <span className="text-xs text-slate-600">{f.label}</span>
                              </div>
                            );
                          })}
                        </div>
                        {(consent.dietary_requirements || consent.passport_expiry) && (
                          <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-slate-400">
                            {consent.dietary_requirements && (
                              <span>Diet: {consent.dietary_requirements}</span>
                            )}
                            {consent.passport_expiry && (
                              <span>Passport exp: {fmtDate(consent.passport_expiry)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Summary footer */}
                <p className="pt-1 text-xs text-slate-400 text-right">
                  {consents.filter(consentFullyDone).length} of {consents.length} fully
                  complete
                </p>

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
