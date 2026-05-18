import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff,
  Plane, Trophy, Activity, Utensils, Smile, Star, Moon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TravelEvent } from '@/pages/TravelEventDetail';

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemType =
  | 'travel' | 'match' | 'training' | 'meal'
  | 'free_time' | 'ceremony' | 'curfew';

interface ItineraryItem {
  id: string;
  day_date: string;
  item_time: string | null;
  title: string;
  description: string | null;
  location: string | null;
  item_type: ItemType;
  visible_to_parents: boolean;
  sort_order: number;
}

interface ItemForm {
  item_time: string;
  title: string;
  description: string;
  location: string;
  item_type: ItemType | '';
  visible_to_parents: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

type TypeCfg = {
  label: string;
  dotBg: string;
  pillCls: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const TYPE_CONFIG: Record<ItemType, TypeCfg> = {
  travel:    { label: 'Travel',    dotBg: 'bg-blue-500',    pillCls: 'bg-blue-50 text-blue-700',      Icon: Plane     },
  match:     { label: 'Match',     dotBg: 'bg-rose-500',    pillCls: 'bg-rose-50 text-rose-700',      Icon: Trophy    },
  training:  { label: 'Training',  dotBg: 'bg-violet-500',  pillCls: 'bg-violet-50 text-violet-700',  Icon: Activity  },
  meal:      { label: 'Meal',      dotBg: 'bg-amber-500',   pillCls: 'bg-amber-50 text-amber-700',    Icon: Utensils  },
  free_time: { label: 'Free time', dotBg: 'bg-emerald-500', pillCls: 'bg-emerald-50 text-emerald-700',Icon: Smile     },
  ceremony:  { label: 'Ceremony',  dotBg: 'bg-yellow-500',  pillCls: 'bg-yellow-50 text-yellow-700',  Icon: Star      },
  curfew:    { label: 'Curfew',    dotBg: 'bg-slate-400',   pillCls: 'bg-slate-100 text-slate-600',   Icon: Moon      },
};

const TYPE_ORDER = Object.keys(TYPE_CONFIG) as ItemType[];

const INPUT_CLS =
  'rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 ' +
  'px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full';

const blank = (): ItemForm => ({
  item_time: '', title: '', description: '', location: '',
  item_type: '', visible_to_parents: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : '';
}

// ─── Item form panel (defined outside to keep stable identity) ────────────────

function ItemFormPanel({
  form,
  saving,
  onChange,
  onCheckbox,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: ItemForm;
  saving: boolean;
  onChange: (k: keyof ItemForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onCheckbox: (v: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const canSubmit = !!form.title && !!form.item_type;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Time</span>
          <input
            type="time"
            value={form.item_time}
            onChange={onChange('item_time')}
            className={INPUT_CLS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Type *</span>
          <select value={form.item_type} onChange={onChange('item_type')} className={INPUT_CLS}>
            <option value="">Select…</option>
            {TYPE_ORDER.map(k => (
              <option key={k} value={k}>{TYPE_CONFIG[k].label}</option>
            ))}
          </select>
        </label>

        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-slate-500">Title *</span>
          <input
            value={form.title}
            onChange={onChange('title')}
            placeholder="e.g. Pre-match team meeting"
            className={INPUT_CLS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Location</span>
          <input
            value={form.location}
            onChange={onChange('location')}
            placeholder="Hotel lobby"
            className={INPUT_CLS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Visible to parents</span>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onCheckbox(!form.visible_to_parents)}
            onKeyDown={e => e.key === ' ' && onCheckbox(!form.visible_to_parents)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-colors
              ${form.visible_to_parents
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-500'}
            `}
          >
            {form.visible_to_parents
              ? <Eye    className="w-4 h-4 flex-shrink-0" />
              : <EyeOff className="w-4 h-4 flex-shrink-0" />}
            <span className="text-sm">
              {form.visible_to_parents ? 'Visible' : 'Staff only'}
            </span>
          </div>
        </label>

        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-slate-500">Description</span>
          <textarea
            value={form.description}
            onChange={onChange('description')}
            placeholder="Additional details…"
            rows={2}
            className={INPUT_CLS + ' resize-none'}
          />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-500 hover:bg-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={saving || !canSubmit}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white
                     hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TravelItineraryTab({ event }: { event: TravelEvent }) {
  const qc = useQueryClient();

  const days = useMemo(
    () => dateRange(event.departure_date, event.return_date),
    [event.departure_date, event.return_date],
  );

  const [selectedDay, setSelectedDay] = useState(event.departure_date);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [form,        setForm]        = useState<ItemForm>(blank());
  const [saving,      setSaving]      = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: allItems = [], isLoading } = useQuery<ItineraryItem[]>({
    queryKey: ['travel-itinerary', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_itinerary_item')
        .select(
          'id, day_date, item_time, title, description, location, ' +
          'item_type, visible_to_parents, sort_order',
        )
        .eq('travel_event_id', event.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItineraryItem[];
    },
  });

  // Items for the active day, sorted by time then sort_order
  const dayItems = useMemo(() => {
    return allItems
      .filter(i => i.day_date === selectedDay)
      .sort((a, b) => {
        const ta = a.item_time ?? '99:99';
        const tb = b.item_time ?? '99:99';
        if (ta !== tb) return ta < tb ? -1 : 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
  }, [allItems, selectedDay]);

  // Count per day for badge on tabs
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of allItems) {
      map.set(item.day_date, (map.get(item.day_date) ?? 0) + 1);
    }
    return map;
  }, [allItems]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['travel-itinerary', event.id] });

  // ── Form handlers ─────────────────────────────────────────────────────────

  const onChange =
    (k: keyof ItemForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const onCheckbox = (v: boolean) => setForm(prev => ({ ...prev, visible_to_parents: v }));

  const nextSortOrder = () => {
    const forDay = allItems.filter(i => i.day_date === selectedDay);
    return forDay.length === 0 ? 10 : Math.max(...forDay.map(i => i.sort_order ?? 0)) + 10;
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!form.title || !form.item_type) return;
    setSaving(true);
    const { error } = await (supabase as any).from('travel_itinerary_item').insert({
      travel_event_id:    event.id,
      day_date:           selectedDay,
      item_time:          form.item_time  || null,
      title:              form.title,
      description:        form.description || null,
      location:           form.location    || null,
      item_type:          form.item_type,
      visible_to_parents: form.visible_to_parents,
      sort_order:         nextSortOrder(),
    });
    setSaving(false);
    if (!error) {
      setForm(blank());
      setShowAdd(false);
      invalidate();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!form.title || !form.item_type) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('travel_itinerary_item')
      .update({
        item_time:          form.item_time  || null,
        title:              form.title,
        description:        form.description || null,
        location:           form.location    || null,
        item_type:          form.item_type,
        visible_to_parents: form.visible_to_parents,
      })
      .eq('id', id);
    setSaving(false);
    if (!error) {
      setEditingId(null);
      setForm(blank());
      invalidate();
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await (supabase as any).from('travel_itinerary_item').delete().eq('id', id);
    setDeletingId(null);
    if (editingId === id) { setEditingId(null); setForm(blank()); }
    invalidate();
  };

  const handleToggleVisible = async (item: ItineraryItem) => {
    setTogglingId(item.id);
    await (supabase as any)
      .from('travel_itinerary_item')
      .update({ visible_to_parents: !item.visible_to_parents })
      .eq('id', item.id);
    setTogglingId(null);
    invalidate();
  };

  const startEdit = (item: ItineraryItem) => {
    setShowAdd(false);
    setEditingId(item.id);
    setForm({
      item_time:          fmtTime(item.item_time),
      title:              item.title,
      description:        item.description ?? '',
      location:           item.location    ?? '',
      item_type:          item.item_type,
      visible_to_parents: item.visible_to_parents,
    });
  };

  const cancelEdit = () => { setEditingId(null); setForm(blank()); };

  const changeDay = (day: string) => {
    setSelectedDay(day);
    setShowAdd(false);
    setEditingId(null);
    setForm(blank());
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 space-y-4">

      {/* ── Day selector tabs ──────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-0">
        {days.map(day => {
          const count = countByDay.get(day) ?? 0;
          return (
            <button
              key={day}
              onClick={() => changeDay(day)}
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
                  text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center
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

      {/* ── Day body ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <div>

          {/* Empty state */}
          {dayItems.length === 0 && !showAdd && (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <p className="text-slate-500 text-sm">No items for this day yet</p>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700
                           font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add first item
              </button>
            </div>
          )}

          {/* Timeline */}
          {dayItems.length > 0 && (
            <div>
              {dayItems.map((item, idx) => {
                const cfg = TYPE_CONFIG[item.item_type] ?? TYPE_CONFIG.travel;
                const { Icon } = cfg;
                const isEditing  = editingId  === item.id;
                const isDeleting = deletingId === item.id;
                const isToggling = togglingId === item.id;
                const isLast     = idx === dayItems.length - 1;

                return (
                  <div key={item.id} className="flex gap-3">

                    {/* Time column */}
                    <div className="w-12 pt-1.5 text-right flex-shrink-0">
                      <span className="text-xs text-slate-400 tabular-nums leading-tight block">
                        {fmtTime(item.item_time)}
                      </span>
                    </div>

                    {/* Icon dot + connecting line */}
                    <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.dotBg} flex-shrink-0`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      {!isLast && (
                        <div className="w-px bg-slate-200 flex-1 my-1 min-h-[16px]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-5 min-w-0">
                      {isEditing ? (
                        <ItemFormPanel
                          form={form}
                          saving={saving}
                          onChange={onChange}
                          onCheckbox={onCheckbox}
                          onSubmit={() => handleUpdate(item.id)}
                          onCancel={cancelEdit}
                          submitLabel="Save changes"
                        />
                      ) : (
                        <div className="group">
                          <div className="flex items-start justify-between gap-2 pt-0.5">
                            <div className="min-w-0">
                              {/* Title + type pill */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium text-slate-800">
                                  {item.title}
                                </span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.pillCls}`}>
                                  {cfg.label}
                                </span>
                              </div>

                              {/* Location */}
                              {item.location && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {item.location}
                                </p>
                              )}

                              {/* Description */}
                              {item.description && (
                                <p className="text-sm text-slate-500 mt-1 leading-snug">
                                  {item.description}
                                </p>
                              )}

                              {/* Staff-only badge (always shown when hidden from parents) */}
                              {!item.visible_to_parents && (
                                <span className="mt-1.5 inline-flex items-center gap-1
                                                 text-[10px] text-slate-400 bg-slate-100
                                                 rounded px-1.5 py-0.5">
                                  <EyeOff className="w-3 h-3" />
                                  Staff only
                                </span>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-0.5 flex-shrink-0 pt-0.5">
                              <button
                                onClick={() => handleToggleVisible(item)}
                                disabled={isToggling}
                                title={item.visible_to_parents
                                  ? 'Visible to parents — click to hide'
                                  : 'Hidden from parents — click to show'}
                                className={`
                                  p-1.5 rounded transition-colors disabled:opacity-40
                                  ${item.visible_to_parents
                                    ? 'text-emerald-400 hover:bg-emerald-50'
                                    : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}
                                `}
                              >
                                {item.visible_to_parents
                                  ? <Eye    className="w-3.5 h-3.5" />
                                  : <EyeOff className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => startEdit(item)}
                                title="Edit"
                                className="p-1.5 rounded text-slate-300 hover:text-slate-600
                                           hover:bg-slate-100 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDelete(item.id)}
                                disabled={isDeleting}
                                title="Delete"
                                className="p-1.5 rounded text-slate-300 hover:text-red-500
                                           hover:bg-red-50 transition-colors disabled:opacity-40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add item form */}
          {showAdd && (
            <div className={dayItems.length > 0 ? 'mt-2' : ''}>
              <ItemFormPanel
                form={form}
                saving={saving}
                onChange={onChange}
                onCheckbox={onCheckbox}
                onSubmit={handleAdd}
                onCancel={() => { setShowAdd(false); setForm(blank()); }}
                submitLabel="Add item"
              />
            </div>
          )}

          {/* Add button below existing items */}
          {!showAdd && !editingId && dayItems.length > 0 && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-1 flex items-center gap-1.5 text-sm text-slate-400
                         hover:text-blue-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add item
            </button>
          )}

        </div>
      )}
    </div>
  );
}
