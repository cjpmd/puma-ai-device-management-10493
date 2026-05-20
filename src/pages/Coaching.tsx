import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveContext } from '@/contexts/ActiveContextContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { BookOpen, ClipboardList, ChevronDown, ChevronUp, Clock, Users } from 'lucide-react';

const sb = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionPlan {
  id: string;
  title: string;
  age_group: string | null;
  curriculum_tags: string[] | null;
  duration_minutes: number | null;
  drills: unknown;
  created_at: string;
}

interface CurriculumOutcome {
  id: string;
  age_group: string | null;
  season: string | null;
  outcome_title: string;
  outcome_description: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tagColor(index: number): string {
  const colors = [
    'bg-violet-100 text-violet-700',
    'bg-sky-100 text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ];
  return colors[index % colors.length];
}

function drillCount(drills: unknown): number {
  if (Array.isArray(drills)) return drills.length;
  if (drills && typeof drills === 'object') return Object.keys(drills as object).length;
  return 0;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ plan }: { plan: SessionPlan }) {
  const [expanded, setExpanded] = useState(false);
  const tags = plan.curriculum_tags ?? [];
  const count = drillCount(plan.drills);

  const drillList: { name?: string; description?: string; duration?: number }[] =
    Array.isArray(plan.drills) ? plan.drills as any[] : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Card header — always visible, click to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">{plan.title}</h3>
            <div className="flex items-center gap-3 mt-1.5">
              {plan.age_group && (
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Users className="w-3 h-3" />
                  {plan.age_group}
                </div>
              )}
              {plan.duration_minutes != null && (
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {plan.duration_minutes} min
                </div>
              )}
              <span className="text-xs text-slate-400">{fmtDate(plan.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <span className="text-xs text-slate-400">{count} drill{count !== 1 ? 's' : ''}</span>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </div>
        </div>

        {/* Curriculum tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {tags.map((tag, i) => (
              <span key={tag} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${tagColor(i)}`}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expanded drill list */}
      {expanded && (
        <div className="border-t border-slate-100">
          {drillList.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-400">No drills added yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {drillList.map((drill, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-800 font-medium">
                      {drill.name ?? `Drill ${i + 1}`}
                    </p>
                    {drill.duration != null && (
                      <span className="text-xs text-slate-400 flex-shrink-0">{drill.duration} min</span>
                    )}
                  </div>
                  {drill.description && (
                    <p className="mt-0.5 text-xs text-slate-500">{drill.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Curriculum outcomes table ────────────────────────────────────────────────

function OutcomesTable({ outcomes }: { outcomes: CurriculumOutcome[] }) {
  const grouped: Record<string, CurriculumOutcome[]> = {};
  for (const o of outcomes) {
    const key = [o.age_group ?? 'All', o.season ?? '—'].join(' · ');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  }

  if (outcomes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
        <ClipboardList className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No curriculum outcomes defined yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {Object.entries(grouped).map(([groupKey, items], gi) => (
        <div key={groupKey}>
          <div className="px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
            {groupKey}
          </div>
          {items.map((o, i) => (
            <div
              key={o.id}
              className={`px-5 py-3 ${i < items.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <p className="text-sm font-medium text-slate-800">{o.outcome_title}</p>
              {o.outcome_description && (
                <p className="mt-0.5 text-xs text-slate-500">{o.outcome_description}</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Coaching() {
  const { activeContext } = useActiveContext();
  const academyId = activeContext?.kind === 'academy' ? activeContext.id : null;

  const { data: plans = [], isLoading: plansLoading } = useQuery<SessionPlan[]>({
    queryKey: ['coaching-plans', academyId],
    enabled: !!academyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb
        .from('session_plan')
        .select('id, title, age_group, curriculum_tags, duration_minutes, drills, created_at')
        .eq('academy_id', academyId!)
        .order('created_at', { ascending: false });
      return (data ?? []) as SessionPlan[];
    },
  });

  const { data: outcomes = [], isLoading: outcomesLoading } = useQuery<CurriculumOutcome[]>({
    queryKey: ['coaching-outcomes', academyId],
    enabled: !!academyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb
        .from('curriculum_outcome')
        .select('id, age_group, season, outcome_title, outcome_description')
        .eq('academy_id', academyId!)
        .order('age_group')
        .order('season');
      return (data ?? []) as CurriculumOutcome[];
    },
  });

  const loading = plansLoading || outcomesLoading;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Coaching"
        subtitle={loading ? 'Loading…' : `${plans.length} session plan${plans.length !== 1 ? 's' : ''} · ${outcomes.length} outcome${outcomes.length !== 1 ? 's' : ''}`}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Session plans (2/3 width on large screens) ─────── */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Session Plans
          </h2>

          {plansLoading && (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
              Loading session plans…
            </div>
          )}

          {!plansLoading && plans.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
              <BookOpen className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No session plans yet.</p>
            </div>
          )}

          {plans.map(plan => (
            <SessionCard key={plan.id} plan={plan} />
          ))}
        </div>

        {/* ── Curriculum outcomes (1/3 width) ─────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Curriculum Outcomes
          </h2>
          {outcomesLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
              Loading outcomes…
            </div>
          ) : (
            <OutcomesTable outcomes={outcomes} />
          )}
        </div>
      </div>
    </div>
  );
}
