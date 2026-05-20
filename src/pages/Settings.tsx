import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { useActiveContext } from '@/contexts/ActiveContextContext';

const sb = supabase as any;

type Tab = 'academy' | 'staff' | 'attributes' | 'curriculum' | 'eppp' | 'integrations' | 'notifications';

const TABS: { id: Tab; label: string }[] = [
  { id: 'academy', label: 'Academy Profile' },
  { id: 'staff', label: 'Staff' },
  { id: 'attributes', label: 'Attribute Framework' },
  { id: 'curriculum', label: 'Curriculum Outcomes' },
  { id: 'eppp', label: 'EPPP Config' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'notifications', label: 'Notifications' },
];

const ATTRIBUTE_CATEGORIES = ['technical', 'physical', 'tactical', 'mental'];

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm rounded-lg transition-colors ${
        active ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <h3 className="text-slate-900 font-medium">{title}</h3>
      {children}
    </div>
  );
}

function InputRow({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-slate-500 text-sm w-44 flex-shrink-0">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500"
      />
    </div>
  );
}

// ---- Academy Profile Tab ----
function AcademyProfileTab() {
  const qc = useQueryClient();
  const { activeContext } = useActiveContext();
  const academyId = activeContext?.kind === 'academy' ? activeContext.id : null;

  // Trigger a one-shot academy sync when this page opens
  const synced = useRef(false);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    setSyncing(true);
    supabase.functions.invoke('sync-external-academy')
      .catch((e) => console.warn('academy sync skipped:', e))
      .finally(() => {
        setSyncing(false);
        qc.invalidateQueries({ queryKey: ['academy-row', academyId] });
        qc.invalidateQueries({ queryKey: ['academy-settings', academyId] });
        qc.invalidateQueries({ queryKey: ['academy-hoa', academyId] });
      });
  }, [academyId, qc]);

  const { data: academy } = useQuery({
    queryKey: ['academy-row', academyId],
    enabled: !!academyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb.from('academies')
        .select('id, name, fa_registration_number, eppp_category, founded_year, logo_url, head_of_academy_user_id, club_website_url, background_check_jurisdiction, synced_at')
        .eq('id', academyId).maybeSingle();
      return data ?? {};
    },
  });

  const { data: hoa } = useQuery({
    queryKey: ['academy-hoa', academy?.head_of_academy_user_id],
    enabled: !!academy?.head_of_academy_user_id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb.from('profiles')
        .select('id, full_name, email').eq('id', academy.head_of_academy_user_id).maybeSingle();
      return data ?? null;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['academy-settings', academyId],
    enabled: !!academyId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb.from('academy_settings')
        .select('*').eq('academy_id', academyId).limit(1).maybeSingle();
      return data ?? {};
    },
  });

  const prefs = (settings?.prefs ?? {}) as Record<string, string>;
  const [form, setForm] = useState<Record<string, string>>({});
  const merged = {
    name: academy?.name ?? '',
    fa_affiliation_number: settings?.fa_affiliation_number ?? academy?.fa_registration_number ?? '',
    eppp_category: settings?.eppp_category ?? academy?.eppp_category ?? '',
    founded_year: academy?.founded_year ? String(academy.founded_year) : '',
    club_website_url: academy?.club_website_url ?? '',
    background_check_jurisdiction: academy?.background_check_jurisdiction ?? 'england',
    academy_tier: prefs.academy_tier ?? '',
    license_expiry: prefs.license_expiry ?? '',
    address: prefs.address ?? '',
    ...form,
  };

  async function save() {
    if (!academyId) return;
    // 1. Write synced/base fields to academies
    await sb.from('academies').update({
      name: merged.name || null,
      fa_registration_number: merged.fa_affiliation_number || null,
      eppp_category: merged.eppp_category || null,
      founded_year: merged.founded_year ? Number(merged.founded_year) : null,
      club_website_url: merged.club_website_url || null,
      background_check_jurisdiction: merged.background_check_jurisdiction || 'england',
    }).eq('id', academyId);

    // 2. Write extras to academy_settings (+ prefs jsonb)
    const nextPrefs = {
      ...prefs,
      academy_tier: merged.academy_tier || undefined,
      license_expiry: merged.license_expiry || undefined,
      address: merged.address || undefined,
    };
    await sb.from('academy_settings').upsert({
      id: settings?.id ?? undefined,
      academy_id: academyId,
      name: merged.name || null,
      fa_affiliation_number: merged.fa_affiliation_number || null,
      eppp_category: merged.eppp_category || null,
      founded_year: merged.founded_year ? Number(merged.founded_year) : null,
      prefs: nextPrefs,
    });
    qc.invalidateQueries({ queryKey: ['academy-row', academyId] });
    qc.invalidateQueries({ queryKey: ['academy-settings', academyId] });
    setForm({});
  }

  return (
    <div className="space-y-4">
      {syncing && (
        <div className="text-xs text-slate-500">Syncing from Origin Sports…</div>
      )}
      <SectionCard title="Basic Information">
        <InputRow label="Academy name" value={merged.name ?? ''} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        <InputRow label="FA affiliation number" value={merged.fa_affiliation_number ?? ''} onChange={(v) => setForm((f) => ({ ...f, fa_affiliation_number: v }))} />
        <InputRow label="EPPP category" value={merged.eppp_category ?? ''} onChange={(v) => setForm((f) => ({ ...f, eppp_category: v }))} placeholder="e.g. Category 1" />
        <InputRow label="Founded year" value={merged.founded_year ?? ''} type="number" onChange={(v) => setForm((f) => ({ ...f, founded_year: v }))} />
        <InputRow label="Academy tier" value={merged.academy_tier ?? ''} onChange={(v) => setForm((f) => ({ ...f, academy_tier: v }))} placeholder="1–3" />
        <InputRow label="License expiry" value={merged.license_expiry ?? ''} type="date" onChange={(v) => setForm((f) => ({ ...f, license_expiry: v }))} />
        <InputRow label="Club website" value={merged.club_website_url ?? ''} onChange={(v) => setForm((f) => ({ ...f, club_website_url: v }))} placeholder="https://yourclub.com" />
        <div className="flex items-center gap-4">
          <label className="text-slate-500 text-sm w-44 flex-shrink-0">Background check jurisdiction</label>
          <select
            value={merged.background_check_jurisdiction}
            onChange={(e) => setForm((f) => ({ ...f, background_check_jurisdiction: e.target.value }))}
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-violet-500"
          >
            <option value="england">England — DBS</option>
            <option value="scotland">Scotland — PVG</option>
            <option value="wales">Wales — DBS</option>
            <option value="northern_ireland">Northern Ireland — AccessNI</option>
          </select>
        </div>
      </SectionCard>
      <SectionCard title="Contact">
        <div className="flex items-center gap-4">
          <label className="text-slate-500 text-sm w-44 flex-shrink-0">Head of Academy</label>
          <div className="flex-1 text-sm text-slate-900">
            {hoa ? (
              <>
                <div>{hoa.full_name || '—'}</div>
                <div className="text-slate-500 text-xs">{hoa.email}</div>
              </>
            ) : (
              <span className="text-slate-400">Not assigned (synced from Origin Sports admin)</span>
            )}
          </div>
        </div>
        <InputRow label="Address" value={merged.address ?? ''} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
      </SectionCard>
      <button onClick={save} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-6 py-2 rounded-lg transition-colors">
        Save changes
      </button>
    </div>
  );
}

// ---- Staff Tab ----
function StaffTab() {
  const { activeContext } = useActiveContext();
  const academyId = activeContext?.kind === 'academy' ? activeContext.id : null;
  const qc = useQueryClient();

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-list', academyId],
    enabled: !!academyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-academy-staff', {
        body: { academy_id: academyId },
      });
      if (error) throw error;
      const rows = ((data as any)?.staff ?? []) as {
        user_id: string; role: string; created_at: string;
        full_name: string | null; email: string | null;
        external_role?: string | null; external_role_synced_at?: string | null;
      }[];
      const order: Record<string, number> = {
        head_coach: 0, coach: 1, physio: 2, welfare_officer: 3, scout: 4, analyst: 5,
      };
      return rows.sort((a, b) => (order[a.role] ?? 99) - (order[b.role] ?? 99));
    },
  });

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('coach');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const ROLE_OPTIONS: { value: string; label: string }[] = [
    { value: 'head_coach', label: 'Head Coach' },
    { value: 'coach', label: 'Coach' },
    { value: 'assistant_coach', label: 'Assistant Coach' },
    { value: 'academy_manager', label: 'Academy Manager' },
    { value: 'physio', label: 'Physio' },
    { value: 'sports_scientist', label: 'S&C / Sports Scientist' },
    { value: 'analyst', label: 'Analyst' },
    { value: 'scout', label: 'Scout' },
    { value: 'welfare_officer', label: 'Welfare Officer' },
    { value: 'admin', label: 'Admin' },
    { value: 'other', label: 'Other' },
  ];

  async function changeRole(userId: string, nextRole: string) {
    if (!academyId) return;
    setSavingUserId(userId);
    try {
      const { error } = await supabase.functions.invoke('update-academy-staff-role', {
        body: { academy_id: academyId, user_id: userId, role: nextRole },
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['staff-list', academyId] });
    } catch (e: any) {
      alert(`Failed to update role: ${e?.message ?? e}`);
    } finally {
      setSavingUserId(null);
    }
  }

  async function invite() {
    if (!email.trim()) return;
    // In production this would trigger an invite email via Auth Admin API
    alert(`Invitation workflow for ${email} (role: ${role}) would be triggered here via Supabase Auth Admin API.`);
    setEmail('');
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Invite Staff Member">
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="staff@club.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-violet-500"
          >
            <option value="coach">Coach</option>
            <option value="head_coach">Head Coach</option>
            <option value="welfare_officer">Welfare Officer</option>
            <option value="physio">Physio</option>
            <option value="scout">Scout</option>
            <option value="analyst">Analyst</option>
          </select>
          <button onClick={invite} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Invite
          </button>
        </div>
      </SectionCard>
      <SectionCard title={`Current Staff (${staff.length})`}>
        {staff.length === 0 ? (
          <p className="text-slate-500 text-sm">No staff added yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {staff.map((s) => {
              const name = s.full_name || s.email || `${s.user_id.slice(0, 8)}…`;
              const initials = (s.full_name || s.email || '?')
                .split(/[\s@]+/).filter(Boolean).slice(0, 2)
                .map((p) => p[0]?.toUpperCase()).join('') || '?';
              const synced = !!s.external_role_synced_at && s.external_role === s.role;
              return (
                <div key={s.user_id} className="flex items-center gap-3 py-2.5">
                  <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
                    {s.email && (
                      <div className="text-xs text-slate-500 truncate">{s.email}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <select
                      value={s.role}
                      disabled={savingUserId === s.user_id}
                      onChange={(e) => changeRole(s.user_id, e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.find((r) => r.value === s.role) ? null : (
                        <option value={s.role}>{s.role?.replace(/_/g, ' ')}</option>
                      )}
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <span className={`text-[10px] ${synced ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {synced ? 'Synced to Origin Sports' : 'Pending sync'}
                    </span>
                  </div>
                  {s.email ? (
                    <a href={`mailto:${s.email}`} className="text-xs text-violet-600 hover:text-violet-800 font-medium whitespace-nowrap">
                      Contact
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ---- Attributes Tab ----
function AttributesTab() {
  const qc = useQueryClient();
  const { data: defs = [] } = useQuery({
    queryKey: ['attribute-defs-settings'],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb.from('attribute_definition').select('*').order('category').order('name');
      return (data ?? []) as { id: string; name: string; category: string; max_value: number; is_active: boolean; source?: string }[];
    },
  });

  const [newDef, setNewDef] = useState({ name: '', category: 'technical', max_value: '10' });

  async function addDef() {
    if (!newDef.name.trim()) return;
    await sb.from('attribute_definition').insert({
      name: newDef.name.trim(),
      category: newDef.category,
      max_value: parseInt(newDef.max_value) || 10,
      is_active: true,
    });
    qc.invalidateQueries({ queryKey: ['attribute-defs-settings'] });
    setNewDef({ name: '', category: 'technical', max_value: '10' });
  }

  async function toggleActive(id: string, current: boolean) {
    await sb.from('attribute_definition').update({ is_active: !current }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['attribute-defs-settings'] });
  }

  const byCategory = ATTRIBUTE_CATEGORIES.map((cat) => ({
    cat,
    items: defs.filter((d) => d.category === cat),
  }));

  return (
    <div className="space-y-4">
      <SectionCard title="Add Attribute">
        <div className="flex gap-3">
          <input
            placeholder="Attribute name"
            value={newDef.name}
            onChange={(e) => setNewDef((f) => ({ ...f, name: e.target.value }))}
            className="flex-1 bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500"
          />
          <select
            value={newDef.category}
            onChange={(e) => setNewDef((f) => ({ ...f, category: e.target.value }))}
            className="bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-violet-500"
          >
            {ATTRIBUTE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            min={1} max={100}
            value={newDef.max_value}
            onChange={(e) => setNewDef((f) => ({ ...f, max_value: e.target.value }))}
            className="w-20 bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-violet-500"
            placeholder="Max"
          />
          <button onClick={addDef} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Add
          </button>
        </div>
      </SectionCard>

      {byCategory.map(({ cat, items }) => (
        <SectionCard key={cat} title={`${cat.charAt(0).toUpperCase() + cat.slice(1)} (${items.length})`}>
          {items.length === 0 ? (
            <p className="text-slate-500 text-sm">No attributes in this category.</p>
          ) : (
            <div className="space-y-1">
              {items.map((def) => (
                <div key={def.id} className="flex items-center gap-3 py-1">
                  <span className={`flex-1 text-sm ${def.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{def.name}</span>
                  {def.source === 'origin_sports' && (
                    <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
                      Origin Sports
                    </span>
                  )}
                  <span className="text-xs text-slate-400">max {def.max_value}</span>
                  <button
                    onClick={() => toggleActive(def.id, def.is_active)}
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                      def.is_active
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                    }`}
                  >
                    {def.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ))}
    </div>
  );
}

// ---- Curriculum Tab ----
function CurriculumTab() {
  const qc = useQueryClient();
  const { data: outcomes = [] } = useQuery({
    queryKey: ['curriculum-outcomes'],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb.from('curriculum_outcome').select('*').order('age_group').order('title');
      return (data ?? []) as { id: string; title: string; age_group: string; description: string | null }[];
    },
  });

  const [form, setForm] = useState({ title: '', age_group: 'U9', description: '' });

  async function add() {
    if (!form.title.trim()) return;
    await sb.from('curriculum_outcome').insert({ ...form, title: form.title.trim() });
    qc.invalidateQueries({ queryKey: ['curriculum-outcomes'] });
    setForm({ title: '', age_group: 'U9', description: '' });
  }

  const ageGroups = [...new Set(outcomes.map((o) => o.age_group))].sort();

  return (
    <div className="space-y-4">
      <SectionCard title="Add Outcome">
        <div className="space-y-3">
          <div className="flex gap-3">
            <input
              placeholder="Outcome title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="flex-1 bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500"
            />
            <select
              value={form.age_group}
              onChange={(e) => setForm((f) => ({ ...f, age_group: e.target.value }))}
              className="bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-violet-500"
            >
              {['U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U18','U21'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 resize-none"
          />
          <button onClick={add} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Add outcome
          </button>
        </div>
      </SectionCard>

      {ageGroups.map((ag) => (
        <SectionCard key={ag} title={ag}>
          <div className="space-y-2">
            {outcomes.filter((o) => o.age_group === ag).map((o) => (
              <div key={o.id}>
                <p className="text-slate-900 text-sm">{o.title}</p>
                {o.description && <p className="text-slate-400 text-xs mt-0.5">{o.description}</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

// ---- EPPP Config Tab ----
function EPPPConfigTab() {
  const qc = useQueryClient();
  const { activeContext } = useActiveContext();
  const academyId = activeContext?.kind === 'academy' ? activeContext.id : null;

  const { data: academy } = useQuery({
    queryKey: ['academy-row', academyId],
    enabled: !!academyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb.from('academies')
        .select('id, eppp_category').eq('id', academyId).maybeSingle();
      return data ?? {};
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['academy-settings', academyId],
    enabled: !!academyId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb.from('academy_settings')
        .select('*').eq('academy_id', academyId).limit(1).maybeSingle();
      return data ?? {};
    },
  });

  const prefs = (settings?.prefs ?? {}) as Record<string, string>;
  const [form, setForm] = useState<Record<string, string>>({});
  const merged = {
    eppp_category: settings?.eppp_category ?? academy?.eppp_category ?? '',
    eppp_tier: settings?.eppp_tier ?? '',
    pdc_target: prefs.pdc_target ?? '',
    eppp_assessor: prefs.eppp_assessor ?? '',
    eppp_next_review: prefs.eppp_next_review ?? '',
    min_snapshots: prefs.min_snapshots ?? '2',
    min_rpe_sessions: prefs.min_rpe_sessions ?? '8',
    acwr_amber: prefs.acwr_amber ?? '1.3',
    acwr_red: prefs.acwr_red ?? '1.5',
    ...form,
  };

  async function save() {
    if (!academyId) return;
    const nextPrefs = {
      ...prefs,
      pdc_target: merged.pdc_target || undefined,
      eppp_assessor: merged.eppp_assessor || undefined,
      eppp_next_review: merged.eppp_next_review || undefined,
      min_snapshots: merged.min_snapshots || undefined,
      min_rpe_sessions: merged.min_rpe_sessions || undefined,
      acwr_amber: merged.acwr_amber || undefined,
      acwr_red: merged.acwr_red || undefined,
    };
    await sb.from('academy_settings').upsert({
      id: settings?.id ?? undefined,
      academy_id: academyId,
      eppp_category: merged.eppp_category || null,
      eppp_tier: merged.eppp_tier || null,
      prefs: nextPrefs,
    });
    // Mirror eppp_category back to academies for consistency
    if (merged.eppp_category) {
      await sb.from('academies').update({ eppp_category: merged.eppp_category }).eq('id', academyId);
    }
    qc.invalidateQueries({ queryKey: ['academy-settings', academyId] });
    qc.invalidateQueries({ queryKey: ['academy-row', academyId] });
    setForm({});
  }

  return (
    <div className="space-y-4">
      <SectionCard title="EPPP Category & Tier">
        <InputRow label="Category" value={merged.eppp_category ?? ''} onChange={(v) => setForm((f) => ({ ...f, eppp_category: v }))} placeholder="e.g. Category 1" />
        <InputRow label="Tier" value={merged.eppp_tier ?? ''} onChange={(v) => setForm((f) => ({ ...f, eppp_tier: v }))} placeholder="e.g. 1" />
        <InputRow label="PDC target" value={merged.pdc_target ?? ''} onChange={(v) => setForm((f) => ({ ...f, pdc_target: v }))} placeholder="e.g. 800 hours" />
        <InputRow label="Assessor name" value={merged.eppp_assessor ?? ''} onChange={(v) => setForm((f) => ({ ...f, eppp_assessor: v }))} />
        <InputRow label="Next review date" value={merged.eppp_next_review ?? ''} type="date" onChange={(v) => setForm((f) => ({ ...f, eppp_next_review: v }))} />
      </SectionCard>
      <SectionCard title="KPI Thresholds">
        <InputRow label="Min attribute snapshots / season" value={merged.min_snapshots ?? '2'} onChange={(v) => setForm((f) => ({ ...f, min_snapshots: v }))} type="number" />
        <InputRow label="Min RPE sessions / month" value={merged.min_rpe_sessions ?? '8'} onChange={(v) => setForm((f) => ({ ...f, min_rpe_sessions: v }))} type="number" />
        <InputRow label="ACWR amber threshold" value={merged.acwr_amber ?? '1.3'} onChange={(v) => setForm((f) => ({ ...f, acwr_amber: v }))} type="number" />
        <InputRow label="ACWR red threshold" value={merged.acwr_red ?? '1.5'} onChange={(v) => setForm((f) => ({ ...f, acwr_red: v }))} type="number" />
      </SectionCard>
      <button onClick={save} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-6 py-2 rounded-lg transition-colors">
        Save
      </button>
    </div>
  );
}

// ---- Integrations Tab ----
function IntegrationsTab() {
  return (
    <div className="space-y-4">
      {[
        {
          name: 'Catapult / STATSports GPS',
          description: 'Upload CSV exports from Catapult or STATSports to enrich training load records with GPS metrics.',
          status: 'active',
          action: 'Upload CSV',
          href: '#gps-upload',
        },
        {
          name: 'Hudl (read-only)',
          description: 'Link Hudl clip URLs to player video records. Uses the gps-import Edge Function.',
          status: 'active',
          action: 'Configure',
          href: '#hudl',
        },
        {
          name: 'Football Central Sync',
          description: 'Weekly sync of overall_rating, availability_status, and maturation_badge to Football Central player records.',
          status: 'active',
          action: 'Run now',
          href: '#fc-sync',
        },
        {
          name: 'Wyscout / InStat',
          description: 'Import scouting data from Wyscout or InStat (coming soon).',
          status: 'coming_soon',
          action: null,
          href: null,
        },
      ].map((int) => (
        <div key={int.name} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-slate-900 font-medium">{int.name}</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  int.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {int.status === 'active' ? 'Active' : 'Coming soon'}
              </span>
            </div>
            <p className="text-slate-500 text-sm">{int.description}</p>
          </div>
          {int.action && (
            <button className="flex-shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm px-4 py-2 rounded-lg transition-colors">
              {int.action}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Notifications Tab ----
function NotificationsTab() {
  const qc = useQueryClient();
  const { activeContext } = useActiveContext();
  const academyId = activeContext?.kind === 'academy' ? activeContext.id : null;

  const { data: settings } = useQuery({
    queryKey: ['academy-settings', academyId],
    enabled: !!academyId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb.from('academy_settings')
        .select('*').eq('academy_id', academyId).limit(1).maybeSingle();
      return data ?? {};
    },
  });

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const merged = { ...settings, ...prefs };

  const toggles = [
    { key: 'notify_acwr_red', label: 'ACWR red alert (≥1.5)' },
    { key: 'notify_acwr_amber', label: 'ACWR amber alert (≥1.3)' },
    { key: 'notify_injury_rtp', label: 'RTP phase advances' },
    { key: 'notify_welfare_restricted', label: 'New restricted welfare entry' },
    { key: 'notify_safeguarding', label: 'Safeguarding referral logged' },
    { key: 'notify_eppp_expiry', label: 'EPPP compliance below 80%' },
    { key: 'notify_qualification_expiry', label: 'Staff qualification expiring within 30 days' },
    { key: 'notify_fc_sync_fail', label: 'FC sync failure' },
  ];

  async function save() {
    await sb.from('academy_settings')
      .upsert({ id: settings?.id ?? undefined, academy_id: academyId, ...merged });
    qc.invalidateQueries({ queryKey: ['academy-settings', academyId] });
    setPrefs({});
  }

  return (
    <div className="space-y-4">
      <SectionCard title="In-app & email notifications">
        <div className="space-y-3">
          {toggles.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-slate-700">{label}</span>
              <button
                onClick={() => setPrefs((p) => ({ ...p, [key]: !(merged[key] ?? true) }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  (merged[key] ?? true) ? 'bg-violet-600' : 'bg-slate-100'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    (merged[key] ?? true) ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
      <button onClick={save} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-6 py-2 rounded-lg transition-colors">
        Save preferences
      </button>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('academy');

  const panels: Record<Tab, React.ReactNode> = {
    academy: <AcademyProfileTab />,
    staff: <StaffTab />,
    attributes: <AttributesTab />,
    curriculum: <CurriculumTab />,
    eppp: <EPPPConfigTab />,
    integrations: <IntegrationsTab />,
    notifications: <NotificationsTab />,
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Settings" subtitle="Academy configuration, staff & integrations" />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <TabButton key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </TabButton>
        ))}
      </div>

      <div>{panels[activeTab]}</div>
    </div>
  );
}
