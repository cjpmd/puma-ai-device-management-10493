import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, ArrowRight,
  Plane, Bus, Train, Ship, Building2, DollarSign, CheckCircle2, Circle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import type { TravelEvent } from '@/pages/TravelEventDetail';

// ─── Types ──────────────────────────────────────────────────────────────────

type TransportType   = 'flight' | 'coach' | 'train' | 'ferry';
type TransportStatus = 'provisional' | 'confirmed' | 'cancelled';
type AccomStatus     = 'provisional' | 'confirmed';
type BudgetCategory  =
  | 'flights' | 'accommodation' | 'ground_transport'
  | 'tournament_entry' | 'meals' | 'kit' | 'other';

interface TransportLeg {
  id: string;
  leg_order: number;
  transport_type: TransportType;
  provider: string | null;
  reference_number: string | null;
  departure_location: string | null;
  arrival_location: string | null;
  departure_datetime: string | null;
  arrival_datetime: string | null;
  status: TransportStatus;
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
  booking_reference: string | null;
  status: AccomStatus;
  notes: string | null;
}

interface BudgetItem {
  id: string;
  category: BudgetCategory;
  description: string | null;
  budgeted_amount: number | null;
  actual_amount: number | null;
  paid: boolean;
}

interface LegForm {
  leg_order: string;
  transport_type: TransportType | '';
  provider: string;
  reference_number: string;
  departure_location: string;
  arrival_location: string;
  departure_datetime: string;
  arrival_datetime: string;
  status: TransportStatus | '';
  notes: string;
}

interface AccomForm {
  hotel_name: string;
  address: string;
  phone: string;
  check_in: string;
  check_out: string;
  room_count: string;
  meal_plan: string;
  booking_reference: string;
  status: AccomStatus | '';
  notes: string;
}

interface BudgetForm {
  category: BudgetCategory | '';
  description: string;
  budgeted_amount: string;
  actual_amount: string;
  paid: boolean;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TRANSPORT_CONFIG: Record<TransportType, {
  label: string;
  dotBg: string;
  pillCls: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  flight: { label: 'Flight', dotBg: 'bg-sky-500',    pillCls: 'bg-sky-50 text-sky-700',       Icon: Plane  },
  coach:  { label: 'Coach',  dotBg: 'bg-amber-500',  pillCls: 'bg-amber-50 text-amber-700',   Icon: Bus    },
  train:  { label: 'Train',  dotBg: 'bg-violet-500', pillCls: 'bg-violet-50 text-violet-700', Icon: Train  },
  ferry:  { label: 'Ferry',  dotBg: 'bg-blue-500',   pillCls: 'bg-blue-50 text-blue-700',     Icon: Ship   },
};

const LEG_STATUS_CFG: Record<TransportStatus, { label: string; cls: string }> = {
  provisional: { label: 'Provisional', cls: 'bg-amber-100 text-amber-700'    },
  confirmed:   { label: 'Confirmed',   cls: 'bg-emerald-100 text-emerald-700' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-100 text-red-600'        },
};

const ACCOM_STATUS_CFG: Record<AccomStatus, { label: string; cls: string }> = {
  provisional: { label: 'Provisional', cls: 'bg-amber-100 text-amber-700'    },
  confirmed:   { label: 'Confirmed',   cls: 'bg-emerald-100 text-emerald-700' },
};

const BUDGET_CATEGORIES: BudgetCategory[] = [
  'flights', 'accommodation', 'ground_transport',
  'tournament_entry', 'meals', 'kit', 'other',
];

const BUDGET_CAT_LABELS: Record<BudgetCategory, string> = {
  flights:          'Flights',
  accommodation:    'Accommodation',
  ground_transport: 'Ground Transport',
  tournament_entry: 'Tournament Entry',
  meals:            'Meals',
  kit:              'Kit',
  other:            'Other',
};

const BUDGET_CAT_SHORT: Record<BudgetCategory, string> = {
  flights:          'Flights',
  accommodation:    'Accom.',
  ground_transport: 'Ground',
  tournament_entry: 'Entry',
  meals:            'Meals',
  kit:              'Kit',
  other:            'Other',
};

const BUDGET_CAT_PILLS: Record<BudgetCategory, string> = {
  flights:          'bg-sky-50 text-sky-700',
  accommodation:    'bg-violet-50 text-violet-700',
  ground_transport: 'bg-amber-50 text-amber-700',
  tournament_entry: 'bg-rose-50 text-rose-700',
  meals:            'bg-emerald-50 text-emerald-700',
  kit:              'bg-pink-50 text-pink-700',
  other:            'bg-slate-100 text-slate-600',
};

// ─── Shared constants ──────────────────────────────────────────────────────────

const INPUT_CLS =
  'rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 ' +
  'px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full';

const blankLeg = (): LegForm => ({
  leg_order: '', transport_type: '', provider: '', reference_number: '',
  departure_location: '', arrival_location: '',
  departure_datetime: '', arrival_datetime: '',
  status: 'provisional', notes: '',
});

const blankAccom = (): AccomForm => ({
  hotel_name: '', address: '', phone: '',
  check_in: '', check_out: '', room_count: '',
  meal_plan: '', booking_reference: '', status: 'provisional', notes: '',
});

const blankBudget = (): BudgetForm => ({
  category: '', description: '', budgeted_amount: '', actual_amount: '', paid: false,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDatetime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toLocalDT(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

type OnChange<T> = (
  k: keyof T,
) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;

// ─── LegFormPanel ───────────────────────────────────────────────────────────────

function LegFormPanel({
  form, saving, onChange, onSubmit, onCancel, submitLabel,
}: {
  form: LegForm; saving: boolean;
  onChange: OnChange<LegForm>;
  onSubmit: () => void; onCancel: () => void; submitLabel: string;
}) {
  const canSubmit = !!form.transport_type && !!form.status;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Type *</span>
          <select value={form.transport_type} onChange={onChange('transport_type')} className={INPUT_CLS}>
            <option value="">Select…</option>
            {(Object.keys(TRANSPORT_CONFIG) as TransportType[]).map(k => (
              <option key={k} value={k}>{TRANSPORT_CONFIG[k].label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Leg #</span>
          <input type="number" min="1" value={form.leg_order}
            onChange={onChange('leg_order')} placeholder="auto" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">From</span>
          <input value={form.departure_location} onChange={onChange('departure_location')}
            placeholder="Manchester Airport" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">To</span>
          <input value={form.arrival_location} onChange={onChange('arrival_location')}
            placeholder="Düsseldorf Airport" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Departure</span>
          <input type="datetime-local" value={form.departure_datetime}
            onChange={onChange('departure_datetime')} className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Arrival</span>
          <input type="datetime-local" value={form.arrival_datetime}
            onChange={onChange('arrival_datetime')} className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Provider</span>
          <input value={form.provider} onChange={onChange('provider')}
            placeholder="Ryanair" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Reference</span>
          <input value={form.reference_number} onChange={onChange('reference_number')}
            placeholder="FR1234" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Status *</span>
          <select value={form.status} onChange={onChange('status')} className={INPUT_CLS}>
            <option value="provisional">Provisional</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-slate-500">Notes</span>
          <textarea value={form.notes} onChange={onChange('notes')} rows={2}
            placeholder="Gate, terminal, collection point…"
            className={INPUT_CLS + ' resize-none'} />
        </label>

      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-500 hover:bg-white rounded-lg transition-colors">
          Cancel
        </button>
        <button onClick={onSubmit} disabled={saving || !canSubmit}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white
                     hover:bg-blue-700 disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── AccomFormPanel ──────────────────────────────────────────────────────────────

function AccomFormPanel({
  form, saving, onChange, onSubmit, onCancel, submitLabel,
}: {
  form: AccomForm; saving: boolean;
  onChange: OnChange<AccomForm>;
  onSubmit: () => void; onCancel: () => void; submitLabel: string;
}) {
  const canSubmit = !!form.hotel_name;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">

        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-slate-500">Hotel name *</span>
          <input value={form.hotel_name} onChange={onChange('hotel_name')}
            placeholder="Hotel Ibis" className={INPUT_CLS} />
        </label>

        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-slate-500">Address</span>
          <input value={form.address} onChange={onChange('address')}
            placeholder="123 Main Street, City" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Check-in</span>
          <input type="datetime-local" value={form.check_in}
            onChange={onChange('check_in')} className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Check-out</span>
          <input type="datetime-local" value={form.check_out}
            onChange={onChange('check_out')} className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Phone</span>
          <input value={form.phone} onChange={onChange('phone')}
            placeholder="+44 123 456789" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Booking ref</span>
          <input value={form.booking_reference} onChange={onChange('booking_reference')}
            placeholder="BK-XXXXXX" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Rooms</span>
          <input type="number" min="1" value={form.room_count}
            onChange={onChange('room_count')} placeholder="5" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Meal plan</span>
          <input value={form.meal_plan} onChange={onChange('meal_plan')}
            placeholder="Bed & Breakfast" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Status</span>
          <select value={form.status} onChange={onChange('status')} className={INPUT_CLS}>
            <option value="provisional">Provisional</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </label>

        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-slate-500">Notes</span>
          <textarea value={form.notes} onChange={onChange('notes')} rows={2}
            placeholder="Access codes, room allocation…"
            className={INPUT_CLS + ' resize-none'} />
        </label>

      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-500 hover:bg-white rounded-lg transition-colors">
          Cancel
        </button>
        <button onClick={onSubmit} disabled={saving || !canSubmit}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white
                     hover:bg-blue-700 disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── BudgetFormPanel ──────────────────────────────────────────────────────────────

function BudgetFormPanel({
  form, saving, onChange, onTogglePaid, onSubmit, onCancel, submitLabel,
}: {
  form: BudgetForm; saving: boolean;
  onChange: OnChange<BudgetForm>;
  onTogglePaid: (v: boolean) => void;
  onSubmit: () => void; onCancel: () => void; submitLabel: string;
}) {
  const canSubmit = !!form.category;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Category *</span>
          <select value={form.category} onChange={onChange('category')} className={INPUT_CLS}>
            <option value="">Select…</option>
            {BUDGET_CATEGORIES.map(c => (
              <option key={c} value={c}>{BUDGET_CAT_LABELS[c]}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Description</span>
          <input value={form.description} onChange={onChange('description')}
            placeholder="e.g. Return flights × 18" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Budgeted (£)</span>
          <input type="number" min="0" step="0.01" value={form.budgeted_amount}
            onChange={onChange('budgeted_amount')} placeholder="0.00" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Actual (£)</span>
          <input type="number" min="0" step="0.01" value={form.actual_amount}
            onChange={onChange('actual_amount')} placeholder="0.00" className={INPUT_CLS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Payment</span>
          <div
            role="button" tabIndex={0}
            onClick={() => onTogglePaid(!form.paid)}
            onKeyDown={e => e.key === ' ' && onTogglePaid(!form.paid)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none
              transition-colors
              ${form.paid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-500'}
            `}
          >
            {form.paid
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : <Circle       className="w-4 h-4 flex-shrink-0" />}
            <span className="text-sm">{form.paid ? 'Paid' : 'Unpaid'}</span>
          </div>
        </label>

      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-500 hover:bg-white rounded-lg transition-colors">
          Cancel
        </button>
        <button onClick={onSubmit} disabled={saving || !canSubmit}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white
                     hover:bg-blue-700 disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────────

export function TravelLogisticsTab({ event }: { event: TravelEvent }) {
  const qc = useQueryClient();

  // ── Transport state ──────────────────────────────────────────────────────
  const [showAddLeg,    setShowAddLeg]    = useState(false);
  const [editingLegId,  setEditingLegId]  = useState<string | null>(null);
  const [legForm,       setLegForm]       = useState<LegForm>(blankLeg());
  const [legSaving,     setLegSaving]     = useState(false);
  const [deletingLegId, setDeletingLegId] = useState<string | null>(null);

  // ── Accommodation state ────────────────────────────────────────────────
  const [showAddAccom,    setShowAddAccom]    = useState(false);
  const [editingAccomId,  setEditingAccomId]  = useState<string | null>(null);
  const [accomForm,       setAccomForm]       = useState<AccomForm>(blankAccom());
  const [accomSaving,     setAccomSaving]     = useState(false);
  const [deletingAccomId, setDeletingAccomId] = useState<string | null>(null);

  // ── Budget state ─────────────────────────────────────────────────────────
  const [showAddBudget,    setShowAddBudget]    = useState(false);
  const [editingBudgetId,  setEditingBudgetId]  = useState<string | null>(null);
  const [budgetForm,       setBudgetForm]       = useState<BudgetForm>(blankBudget());
  const [budgetSaving,     setBudgetSaving]     = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: legs = [], isLoading: legsLoading } = useQuery<TransportLeg[]>({
    queryKey: ['travel-legs', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_transport_leg')
        .select(
          'id, leg_order, transport_type, provider, reference_number, ' +
          'departure_location, arrival_location, departure_datetime, arrival_datetime, status, notes',
        )
        .eq('travel_event_id', event.id)
        .order('leg_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TransportLeg[];
    },
  });

  const { data: accoms = [], isLoading: accomsLoading } = useQuery<Accommodation[]>({
    queryKey: ['travel-accom', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_accommodation')
        .select(
          'id, hotel_name, address, phone, check_in, check_out, ' +
          'room_count, meal_plan, booking_reference, status, notes',
        )
        .eq('travel_event_id', event.id)
        .order('check_in', { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as Accommodation[];
    },
  });

  const { data: budgetItems = [], isLoading: budgetLoading } = useQuery<BudgetItem[]>({
    queryKey: ['travel-budget', event.id],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_budget_item')
        .select('id, category, description, budgeted_amount, actual_amount, paid')
        .eq('travel_event_id', event.id)
        .order('category', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BudgetItem[];
    },
  });

  // ── Derived ─────────────────────────────────────────────────────────────────

  const budgetTotals = useMemo(() => {
    let totalBudgeted = 0, totalActual = 0, paidCount = 0;
    for (const item of budgetItems) {
      totalBudgeted += item.budgeted_amount ?? 0;
      totalActual   += item.actual_amount   ?? 0;
      if (item.paid) paidCount++;
    }
    return { totalBudgeted, totalActual, paidCount };
  }, [budgetItems]);

  const chartData = useMemo(() => {
    const grouped = new Map<BudgetCategory, { budgeted: number; actual: number }>();
    for (const item of budgetItems) {
      const cur = grouped.get(item.category) ?? { budgeted: 0, actual: 0 };
      grouped.set(item.category, {
        budgeted: cur.budgeted + (item.budgeted_amount ?? 0),
        actual:   cur.actual   + (item.actual_amount   ?? 0),
      });
    }
    return BUDGET_CATEGORIES
      .filter(cat => grouped.has(cat))
      .map(cat => ({
        name:     BUDGET_CAT_SHORT[cat],
        Budgeted: Math.round((grouped.get(cat)!.budgeted) * 100) / 100,
        Actual:   Math.round((grouped.get(cat)!.actual)   * 100) / 100,
      }));
  }, [budgetItems]);

  // ── Invalidators ──────────────────────────────────────────────────────────

  const invLegs   = () => qc.invalidateQueries({ queryKey: ['travel-legs',   event.id] });
  const invAccoms = () => qc.invalidateQueries({ queryKey: ['travel-accom',  event.id] });
  const invBudget = () => qc.invalidateQueries({ queryKey: ['travel-budget', event.id] });

  // ── onChange factories ──────────────────────────────────────────────────

  const onLegChange =
    (k: keyof LegForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setLegForm(prev => ({ ...prev, [k]: e.target.value }));

  const onAccomChange =
    (k: keyof AccomForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setAccomForm(prev => ({ ...prev, [k]: e.target.value }));

  const onBudgetChange =
    (k: keyof BudgetForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setBudgetForm(prev => ({ ...prev, [k]: e.target.value }));

  // ── Transport leg mutations ─────────────────────────────────────────────

  const handleAddLeg = async () => {
    if (!legForm.transport_type) return;
    setLegSaving(true);
    const nextOrder = legs.length > 0 ? Math.max(...legs.map(l => l.leg_order)) + 1 : 1;
    await (supabase as any).from('travel_transport_leg').insert({
      travel_event_id:    event.id,
      leg_order:          legForm.leg_order ? parseInt(legForm.leg_order) : nextOrder,
      transport_type:     legForm.transport_type,
      provider:           legForm.provider           || null,
      reference_number:   legForm.reference_number   || null,
      departure_location: legForm.departure_location || null,
      arrival_location:   legForm.arrival_location   || null,
      departure_datetime: legForm.departure_datetime || null,
      arrival_datetime:   legForm.arrival_datetime   || null,
      status:             legForm.status             || 'provisional',
      notes:              legForm.notes              || null,
    });
    setLegSaving(false);
    setLegForm(blankLeg()); setShowAddLeg(false); invLegs();
  };

  const handleUpdateLeg = async (id: string) => {
    if (!legForm.transport_type) return;
    setLegSaving(true);
    await (supabase as any).from('travel_transport_leg').update({
      leg_order:          legForm.leg_order ? parseInt(legForm.leg_order) : undefined,
      transport_type:     legForm.transport_type,
      provider:           legForm.provider           || null,
      reference_number:   legForm.reference_number   || null,
      departure_location: legForm.departure_location || null,
      arrival_location:   legForm.arrival_location   || null,
      departure_datetime: legForm.departure_datetime || null,
      arrival_datetime:   legForm.arrival_datetime   || null,
      status:             legForm.status             || 'provisional',
      notes:              legForm.notes              || null,
    }).eq('id', id);
    setLegSaving(false);
    setEditingLegId(null); setLegForm(blankLeg()); invLegs();
  };

  const handleDeleteLeg = async (id: string) => {
    setDeletingLegId(id);
    await (supabase as any).from('travel_transport_leg').delete().eq('id', id);
    setDeletingLegId(null);
    if (editingLegId === id) { setEditingLegId(null); setLegForm(blankLeg()); }
    invLegs();
  };

  const startEditLeg = (leg: TransportLeg) => {
    setShowAddLeg(false);
    setEditingLegId(leg.id);
    setLegForm({
      leg_order:          String(leg.leg_order),
      transport_type:     leg.transport_type,
      provider:           leg.provider           ?? '',
      reference_number:   leg.reference_number   ?? '',
      departure_location: leg.departure_location ?? '',
      arrival_location:   leg.arrival_location   ?? '',
      departure_datetime: toLocalDT(leg.departure_datetime),
      arrival_datetime:   toLocalDT(leg.arrival_datetime),
      status:             leg.status,
      notes:              leg.notes              ?? '',
    });
  };

  // ── Accommodation mutations ────────────────────────────────────────────

  const handleAddAccom = async () => {
    if (!accomForm.hotel_name) return;
    setAccomSaving(true);
    await (supabase as any).from('travel_accommodation').insert({
      travel_event_id:   event.id,
      hotel_name:        accomForm.hotel_name,
      address:           accomForm.address           || null,
      phone:             accomForm.phone             || null,
      check_in:          accomForm.check_in          || null,
      check_out:         accomForm.check_out         || null,
      room_count:        accomForm.room_count ? parseInt(accomForm.room_count) : null,
      meal_plan:         accomForm.meal_plan         || null,
      booking_reference: accomForm.booking_reference || null,
      status:            accomForm.status            || 'provisional',
      notes:             accomForm.notes             || null,
    });
    setAccomSaving(false);
    setAccomForm(blankAccom()); setShowAddAccom(false); invAccoms();
  };

  const handleUpdateAccom = async (id: string) => {
    if (!accomForm.hotel_name) return;
    setAccomSaving(true);
    await (supabase as any).from('travel_accommodation').update({
      hotel_name:        accomForm.hotel_name,
      address:           accomForm.address           || null,
      phone:             accomForm.phone             || null,
      check_in:          accomForm.check_in          || null,
      check_out:         accomForm.check_out         || null,
      room_count:        accomForm.room_count ? parseInt(accomForm.room_count) : null,
      meal_plan:         accomForm.meal_plan         || null,
      booking_reference: accomForm.booking_reference || null,
      status:            accomForm.status            || 'provisional',
      notes:             accomForm.notes             || null,
    }).eq('id', id);
    setAccomSaving(false);
    setEditingAccomId(null); setAccomForm(blankAccom()); invAccoms();
  };

  const handleDeleteAccom = async (id: string) => {
    setDeletingAccomId(id);
    await (supabase as any).from('travel_accommodation').delete().eq('id', id);
    setDeletingAccomId(null);
    if (editingAccomId === id) { setEditingAccomId(null); setAccomForm(blankAccom()); }
    invAccoms();
  };

  const startEditAccom = (accom: Accommodation) => {
    setShowAddAccom(false);
    setEditingAccomId(accom.id);
    setAccomForm({
      hotel_name:        accom.hotel_name,
      address:           accom.address           ?? '',
      phone:             accom.phone             ?? '',
      check_in:          toLocalDT(accom.check_in),
      check_out:         toLocalDT(accom.check_out),
      room_count:        accom.room_count != null ? String(accom.room_count) : '',
      meal_plan:         accom.meal_plan         ?? '',
      booking_reference: accom.booking_reference ?? '',
      status:            accom.status,
      notes:             accom.notes             ?? '',
    });
  };

  // ── Budget mutations ─────────────────────────────────────────────────────

  const handleAddBudget = async () => {
    if (!budgetForm.category) return;
    setBudgetSaving(true);
    await (supabase as any).from('travel_budget_item').insert({
      travel_event_id: event.id,
      category:        budgetForm.category,
      description:     budgetForm.description     || null,
      budgeted_amount: budgetForm.budgeted_amount ? parseFloat(budgetForm.budgeted_amount) : null,
      actual_amount:   budgetForm.actual_amount   ? parseFloat(budgetForm.actual_amount)   : null,
      paid:            budgetForm.paid,
    });
    setBudgetSaving(false);
    setBudgetForm(blankBudget()); setShowAddBudget(false); invBudget();
  };

  const handleUpdateBudget = async (id: string) => {
    if (!budgetForm.category) return;
    setBudgetSaving(true);
    await (supabase as any).from('travel_budget_item').update({
      category:        budgetForm.category,
      description:     budgetForm.description     || null,
      budgeted_amount: budgetForm.budgeted_amount ? parseFloat(budgetForm.budgeted_amount) : null,
      actual_amount:   budgetForm.actual_amount   ? parseFloat(budgetForm.actual_amount)   : null,
      paid:            budgetForm.paid,
    }).eq('id', id);
    setBudgetSaving(false);
    setEditingBudgetId(null); setBudgetForm(blankBudget()); invBudget();
  };

  const handleDeleteBudget = async (id: string) => {
    setDeletingBudgetId(id);
    await (supabase as any).from('travel_budget_item').delete().eq('id', id);
    setDeletingBudgetId(null);
    if (editingBudgetId === id) { setEditingBudgetId(null); setBudgetForm(blankBudget()); }
    invBudget();
  };

  const startEditBudget = (item: BudgetItem) => {
    setShowAddBudget(false);
    setEditingBudgetId(item.id);
    setBudgetForm({
      category:        item.category,
      description:     item.description     ?? '',
      budgeted_amount: item.budgeted_amount != null ? String(item.budgeted_amount) : '',
      actual_amount:   item.actual_amount   != null ? String(item.actual_amount)   : '',
      paid:            item.paid,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 space-y-8">

      {/* ═════════════════════ TRANSPORT ══════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Plane className="w-4 h-4 text-slate-400" />
            Transport
          </h3>
          {!showAddLeg && !editingLegId && (
            <button
              onClick={() => { setShowAddLeg(true); setLegForm(blankLeg()); }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700
                         font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add leg
            </button>
          )}
        </div>

        {legsLoading ? (
          <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="space-y-2">
            {legs.length === 0 && !showAddLeg && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-8
                              flex flex-col items-center gap-2">
                <p className="text-sm text-slate-400">No transport legs yet</p>
                <button onClick={() => setShowAddLeg(true)}
                  className="flex items-center gap-1 text-xs text-blue-600
                             hover:text-blue-700 font-medium transition-colors">
                  <Plus className="w-3 h-3" /> Add first leg
                </button>
              </div>
            )}

            {legs.map(leg => {
              const cfg      = TRANSPORT_CONFIG[leg.transport_type];
              const stsCfg   = LEG_STATUS_CFG[leg.status];
              const isEditing  = editingLegId  === leg.id;
              const isDeleting = deletingLegId === leg.id;
              const { Icon } = cfg;
              return (
                <div key={leg.id} className="bg-white rounded-xl border border-slate-200 p-3">
                  {isEditing ? (
                    <LegFormPanel
                      form={legForm} saving={legSaving} onChange={onLegChange}
                      onSubmit={() => handleUpdateLeg(leg.id)}
                      onCancel={() => { setEditingLegId(null); setLegForm(blankLeg()); }}
                      submitLabel="Save changes"
                    />
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-full
                                       flex items-center justify-center ${cfg.dotBg}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${cfg.pillCls}`}>
                            {cfg.label}
                          </span>
                          <span className="text-xs text-slate-400">Leg {leg.leg_order}</span>
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${stsCfg.cls}`}>
                            {stsCfg.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-700">
                          <span className="font-medium">{leg.departure_location ?? '—'}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium">{leg.arrival_location ?? '—'}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                          {leg.departure_datetime && <span>{fmtDatetime(leg.departure_datetime)}</span>}
                          {leg.arrival_datetime   && <span>arr. {fmtDatetime(leg.arrival_datetime)}</span>}
                          {leg.provider           && <span>{leg.provider}</span>}
                          {leg.reference_number   && <span>Ref: {leg.reference_number}</span>}
                        </div>
                        {leg.notes && (
                          <p className="mt-1 text-xs text-slate-400 leading-snug">{leg.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={() => startEditLeg(leg)} title="Edit"
                          className="p-1.5 rounded text-slate-300 hover:text-slate-600
                                     hover:bg-slate-100 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteLeg(leg.id)} disabled={isDeleting}
                          title="Delete"
                          className="p-1.5 rounded text-slate-300 hover:text-red-500
                                     hover:bg-red-50 transition-colors disabled:opacity-40">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {showAddLeg && (
              <LegFormPanel
                form={legForm} saving={legSaving} onChange={onLegChange}
                onSubmit={handleAddLeg}
                onCancel={() => { setShowAddLeg(false); setLegForm(blankLeg()); }}
                submitLabel="Add leg"
              />
            )}
          </div>
        )}
      </section>

      {/* ══════════════════ ACCOMMODATION ═══════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-400" />
            Accommodation
          </h3>
          {!showAddAccom && !editingAccomId && (
            <button
              onClick={() => { setShowAddAccom(true); setAccomForm(blankAccom()); }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700
                         font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add hotel
            </button>
          )}
        </div>

        {accomsLoading ? (
          <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="space-y-2">
            {accoms.length === 0 && !showAddAccom && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-8
                              flex flex-col items-center gap-2">
                <p className="text-sm text-slate-400">No accommodation added yet</p>
                <button onClick={() => setShowAddAccom(true)}
                  className="flex items-center gap-1 text-xs text-blue-600
                             hover:text-blue-700 font-medium transition-colors">
                  <Plus className="w-3 h-3" /> Add hotel
                </button>
              </div>
            )}

            {accoms.map(accom => {
              const stsCfg    = ACCOM_STATUS_CFG[accom.status] ?? ACCOM_STATUS_CFG.provisional;
              const isEditing  = editingAccomId  === accom.id;
              const isDeleting = deletingAccomId === accom.id;
              return (
                <div key={accom.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  {isEditing ? (
                    <AccomFormPanel
                      form={accomForm} saving={accomSaving} onChange={onAccomChange}
                      onSubmit={() => handleUpdateAccom(accom.id)}
                      onCancel={() => { setEditingAccomId(null); setAccomForm(blankAccom()); }}
                      submitLabel="Save changes"
                    />
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {accom.hotel_name}
                          </span>
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${stsCfg.cls}`}>
                            {stsCfg.label}
                          </span>
                        </div>
                        {accom.address && (
                          <p className="text-xs text-slate-400 mt-0.5">{accom.address}</p>
                        )}
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Check-in</p>
                            <p className="text-sm text-slate-700">{fmtDatetime(accom.check_in)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Check-out</p>
                            <p className="text-sm text-slate-700">{fmtDatetime(accom.check_out)}</p>
                          </div>
                          {accom.room_count != null && (
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Rooms</p>
                              <p className="text-sm text-slate-700">{accom.room_count}</p>
                            </div>
                          )}
                          {accom.meal_plan && (
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Meals</p>
                              <p className="text-sm text-slate-700">{accom.meal_plan}</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                          {accom.phone             && <span>Tel: {accom.phone}</span>}
                          {accom.booking_reference && <span>Ref: {accom.booking_reference}</span>}
                        </div>
                        {accom.notes && (
                          <p className="mt-1.5 text-xs text-slate-400 leading-snug">{accom.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={() => startEditAccom(accom)} title="Edit"
                          className="p-1.5 rounded text-slate-300 hover:text-slate-600
                                     hover:bg-slate-100 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteAccom(accom.id)} disabled={isDeleting}
                          title="Delete"
                          className="p-1.5 rounded text-slate-300 hover:text-red-500
                                     hover:bg-red-50 transition-colors disabled:opacity-40">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {showAddAccom && (
              <AccomFormPanel
                form={accomForm} saving={accomSaving} onChange={onAccomChange}
                onSubmit={handleAddAccom}
                onCancel={() => { setShowAddAccom(false); setAccomForm(blankAccom()); }}
                submitLabel="Add hotel"
              />
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════ BUDGET ═══════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-slate-400" />
            Budget
          </h3>
          {!showAddBudget && !editingBudgetId && (
            <button
              onClick={() => { setShowAddBudget(true); setBudgetForm(blankBudget()); }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700
                         font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add item
            </button>
          )}
        </div>

        {budgetLoading ? (
          <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="space-y-3">

            {/* Summary stat cards */}
            {budgetItems.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Budgeted</p>
                  <p className="text-base font-semibold text-slate-800">
                    {fmtCurrency(budgetTotals.totalBudgeted)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Actual</p>
                  <p className={`text-base font-semibold ${
                    budgetTotals.totalActual > budgetTotals.totalBudgeted
                      ? 'text-red-600' : 'text-slate-800'
                  }`}>
                    {fmtCurrency(budgetTotals.totalActual)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">
                    {budgetTotals.totalActual <= budgetTotals.totalBudgeted ? 'Remaining' : 'Over budget'}
                  </p>
                  <p className={`text-base font-semibold ${
                    budgetTotals.totalActual > budgetTotals.totalBudgeted
                      ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {fmtCurrency(Math.abs(budgetTotals.totalBudgeted - budgetTotals.totalActual))}
                  </p>
                </div>
              </div>
            )}

            {/* Recharts grouped bar chart */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v =>
                        v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`
                      }
                    />
                    <Tooltip
                      formatter={(v: number) => fmtCurrency(v)}
                      contentStyle={{
                        fontSize: 12, borderRadius: 8,
                        border: '1px solid #e2e8f0', boxShadow: 'none',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Budgeted" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Actual"   fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Empty state */}
            {budgetItems.length === 0 && !showAddBudget && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-8
                              flex flex-col items-center gap-2">
                <p className="text-sm text-slate-400">No budget items yet</p>
                <button onClick={() => setShowAddBudget(true)}
                  className="flex items-center gap-1 text-xs text-blue-600
                             hover:text-blue-700 font-medium transition-colors">
                  <Plus className="w-3 h-3" /> Add first item
                </button>
              </div>
            )}

            {/* Item list */}
            {budgetItems.length > 0 && (
              <div className="space-y-1.5">
                {budgetItems.map(item => {
                  const isEditing  = editingBudgetId  === item.id;
                  const isDeleting = deletingBudgetId === item.id;
                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
                      {isEditing ? (
                        <BudgetFormPanel
                          form={budgetForm} saving={budgetSaving} onChange={onBudgetChange}
                          onTogglePaid={v => setBudgetForm(prev => ({ ...prev, paid: v }))}
                          onSubmit={() => handleUpdateBudget(item.id)}
                          onCancel={() => { setEditingBudgetId(null); setBudgetForm(blankBudget()); }}
                          submitLabel="Save changes"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded
                                               ${BUDGET_CAT_PILLS[item.category]}`}>
                                {BUDGET_CAT_LABELS[item.category]}
                              </span>
                              {item.paid && (
                                <span className="inline-flex items-center gap-0.5 text-[11px]
                                                 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" /> Paid
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-slate-600 mt-0.5">{item.description}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 min-w-[72px]">
                            <p className="text-sm font-medium text-slate-800">
                              {fmtCurrency(item.actual_amount)}
                            </p>
                            {item.budgeted_amount != null && (
                              <p className="text-xs text-slate-400">
                                of {fmtCurrency(item.budgeted_amount)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => startEditBudget(item)} title="Edit"
                              className="p-1.5 rounded text-slate-300 hover:text-slate-600
                                         hover:bg-slate-100 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteBudget(item.id)}
                              disabled={isDeleting} title="Delete"
                              className="p-1.5 rounded text-slate-300 hover:text-red-500
                                         hover:bg-red-50 transition-colors disabled:opacity-40">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add form */}
            {showAddBudget && (
              <BudgetFormPanel
                form={budgetForm} saving={budgetSaving} onChange={onBudgetChange}
                onTogglePaid={v => setBudgetForm(prev => ({ ...prev, paid: v }))}
                onSubmit={handleAddBudget}
                onCancel={() => { setShowAddBudget(false); setBudgetForm(blankBudget()); }}
                submitLabel="Add item"
              />
            )}

          </div>
        )}
      </section>

    </div>
  );
}
