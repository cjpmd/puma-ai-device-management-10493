import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Clock, FileText, Users, PoundSterling } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TravelEvent } from '@/pages/TravelEventDetail';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsentRow {
  id: string;
  player_id: string;
  travel_consent_signed: boolean;
  passport_submitted: boolean;
  medical_declaration_signed: boolean;
  photo_consent: boolean;
  emergency_contact_confirmed: boolean;
  players: {
    id: string;
    name: string;
    teams: { age_group: string | null; name: string } | null;
  } | null;
}

interface DocumentRow {
  id: string;
  title: string;
  document_type: string;
  file_url: string | null;
  is_restricted: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CONSENT_FIELDS: { key: keyof ConsentRow; label: string }[] = [
  { key: 'travel_consent_signed',       label: 'Travel consent signed'      },
  { key: 'passport_submitted',          label: 'Passport submitted'          },
  { key: 'medical_declaration_signed',  label: 'Medical declaration signed'  },
  { key: 'photo_consent',               label: 'Photo consent'               },
  { key: 'emergency_contact_confirmed', label: 'Emergency contact confirmed' },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  consent:         'Travel consent form',
  passport:        'Passport copies',
  medical:         'Medical information',
  insurance:       'Travel insurance',
  booking:         'Booking confirmations',
  risk_assessment: 'Risk assessment',
  other:           'Other document',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctColour(pct: number) {
  if (pct === 100) return 'text-emerald-600';
  if (pct >= 50)   return 'text-amber-600';
  return 'text-slate-500';
}

function barColour(pct: number) {
  if (pct === 100) return 'bg-emerald-500';
  if (pct >= 50)   return 'bg-amber-400';
  return 'bg-slate-300';
}

function progressBar(pct: number) {
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${barColour(pct)}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, valueColour = 'text-slate-900',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  valueColour?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className={`text-2xl font-bold tabular-nums leading-none ${valueColour}`}>
          {value}
        </div>
        <div className="text-slate-300 mt-0.5">{icon}</div>
      </div>
      <p className="text-sm text-slate-500 mt-2">{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${valueColour}`}>{sub}</p>}
    </div>
  );
}

function ChecklistRow({
  label, signed, total,
}: {
  label: string;
  signed: number;
  total: number;
}) {
  const pct  = total === 0 ? 0 : Math.round((signed / total) * 100);
  const done = pct === 100;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {done
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
            : <Circle       className="w-4 h-4 flex-shrink-0 text-slate-300"   />}
          <span className="text-sm text-slate-700 truncate">{label}</span>
        </div>
        <span className={`text-xs font-medium flex-shrink-0 tabular-nums ${pctColour(pct)}`}>
          {total === 0 ? '—' : `${signed}/${total}`}
        </span>
      </div>
      {total > 0 && progressBar(pct)}
    </div>
  );
}

function DocRow({ doc }: { doc: DocumentRow }) {
  const uploaded = !!doc.file_url;
  return (
    <div className="px-4 py-3 flex items-center gap-2">
      {uploaded
        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
        : <Circle       className="w-4 h-4 flex-shrink-0 text-slate-300"   />}
      <span className="text-sm text-slate-700 flex-1 truncate">
        {doc.title || DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
      </span>
      {doc.is_restricted && (
        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 flex-shrink-0">
          Restricted
        </span>
      )}
      <span className={`text-xs flex-shrink-0 ${uploaded ? 'text-emerald-600' : 'text-slate-400'}`}>
        {uploaded ? 'Uploaded' : 'Missing'}
      </span>
    </div>
  );
}

function SquadCard({
  squad, consents,
}: {
  squad: string;
  consents: ConsentRow[];
}) {
  const total  = consents.length;
  const signed = consents.filter(c => c.travel_consent_signed).length;
  const pct    = total === 0 ? 0 : Math.round((signed / total) * 100);

  // Full prep: all 5 fields true
  const fullyReady = consents.filter(c =>
    c.travel_consent_signed &&
    c.passport_submitted &&
    c.medical_declaration_signed &&
    c.photo_consent &&
    c.emergency_contact_confirmed,
  ).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-semibold text-slate-800">{squad}</span>
        <span className="text-xs text-slate-500 tabular-nums">
          {total} player{total !== 1 ? 's' : ''}
        </span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-slate-400 italic">No players added</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Consent signed</span>
            <span className={`font-medium tabular-nums ${pctColour(pct)}`}>
              {signed}/{total} · {pct}%
            </span>
          </div>
          {progressBar(pct)}

          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-slate-500">Fully ready</span>
            <span className={`font-medium tabular-nums ${pctColour(
              total === 0 ? 0 : Math.round((fullyReady / total) * 100),
            )}`}>
              {fullyReady}/{total}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TravelOverviewTab({ event }: { event: TravelEvent }) {
  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: consents = [], isLoading: consentLoading } = useQuery<ConsentRow[]>({
    queryKey: ['travel-consents', event.id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_player_consent')
        .select(`
          id, player_id,
          travel_consent_signed, passport_submitted,
          medical_declaration_signed, photo_consent,
          emergency_contact_confirmed,
          players (id, name, teams (age_group, name))
        `)
        .eq('travel_event_id', event.id);
      if (error) throw error;
      return (data ?? []) as ConsentRow[];
    },
  });

  const { data: requiredDocs = [], isLoading: docsLoading } = useQuery<DocumentRow[]>({
    queryKey: ['travel-required-docs', event.id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_document')
        .select('id, title, document_type, file_url, is_restricted')
        .eq('travel_event_id', event.id)
        .eq('required', true)
        .order('document_type');
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
  });

  // ── Derived values ──────────────────────────────────────────────────────────

  const total = consents.length;

  // Days to departure
  const daysTo = useMemo(() => {
    return Math.ceil(
      (new Date(event.departure_date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
      86_400_000,
    );
  }, [event.departure_date]);

  const daysLabel = daysTo > 0  ? 'Days to departure'
                  : daysTo === 0 ? 'Departs today'
                  : event.status === 'complete' ? 'Event complete'
                  : 'Underway';
  const daysValue  = daysTo > 0 ? daysTo : daysTo === 0 ? '–' : '–';
  const daysColour = daysTo > 14 ? 'text-slate-900'
                   : daysTo > 0  ? 'text-amber-600'
                   : daysTo === 0 ? 'text-blue-600'
                   : 'text-slate-500';

  // Documents
  const docsUploaded = requiredDocs.filter(d => !!d.file_url).length;
  const docsPct      = requiredDocs.length === 0 ? 100
                     : Math.round((docsUploaded / requiredDocs.length) * 100);

  // Consent signed (overall prep, matching TravelEvents list view)
  const consentSigned = consents.filter(c => c.travel_consent_signed).length;
  const prepPct       = total === 0 ? 0 : Math.round((consentSigned / total) * 100);

  // Per-consent-field counts
  const consentCounts = CONSENT_FIELDS.map(f => ({
    label:  f.label,
    signed: consents.filter(c => c[f.key] === true).length,
    total,
  }));

  // Squad groupings — match each consent row's player team age_group to event.squads
  const squadConsents = useMemo(() => {
    const map = new Map<string, ConsentRow[]>(event.squads.map(s => [s, []]));
    const unmatched: ConsentRow[] = [];
    for (const c of consents) {
      const ag = c.players?.teams?.age_group ?? null;
      if (ag && map.has(ag)) {
        map.get(ag)!.push(c);
      } else {
        unmatched.push(c);
      }
    }
    // Surface unmatched players under "Other" only if they exist
    if (unmatched.length > 0) map.set('Other', unmatched);
    return map;
  }, [consents, event.squads]);

  // ── Loading skeleton ────────────────────────────────────────────────────────

  const loading = consentLoading || docsLoading;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 space-y-6">

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Players travelling"
          value={loading ? '—' : total}
          icon={<Users className="w-5 h-5" />}
          valueColour="text-blue-600"
        />
        <StatCard
          label={daysLabel}
          value={loading ? '—' : daysValue}
          icon={<Clock className="w-5 h-5" />}
          valueColour={daysColour}
        />
        <StatCard
          label="Required docs"
          value={loading ? '—' : `${docsUploaded}/${requiredDocs.length}`}
          sub={requiredDocs.length > 0 ? `${docsPct}% uploaded` : 'None required'}
          icon={<FileText className="w-5 h-5" />}
          valueColour={docsPct === 100 ? 'text-emerald-600' : docsPct > 0 ? 'text-amber-600' : 'text-slate-500'}
        />
        <StatCard
          label="Consent signed"
          value={loading ? '—' : `${prepPct}%`}
          sub={total > 0 ? `${consentSigned} of ${total} players` : 'No players yet'}
          icon={<PoundSterling className="w-5 h-5" />}
          valueColour={pctColour(prepPct)}
        />
      </div>

      {/* ── Prep checklist ───────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Preparation checklist</h2>
          {!loading && total > 0 && (
            <span className={`text-xs font-medium ${pctColour(prepPct)}`}>
              {prepPct}% complete
            </span>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : total === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            No players added to this event yet.
          </div>
        ) : (
          <>
            {/* Sub-header: player fields */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Per-player
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {consentCounts.map(item => (
                <ChecklistRow
                  key={item.label}
                  label={item.label}
                  signed={item.signed}
                  total={item.total}
                />
              ))}
            </div>
          </>
        )}

        {/* Sub-section: required documents */}
        {!loading && requiredDocs.length > 0 && (
          <>
            <div className="px-4 py-2 bg-slate-50 border-t border-b border-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Documents
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {requiredDocs.map(doc => (
                <DocRow key={doc.id} doc={doc} />
              ))}
            </div>
          </>
        )}

        {!loading && requiredDocs.length === 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 italic">
            No required documents configured — add them in the Documents tab.
          </div>
        )}
      </section>

      {/* ── Squad summary cards ──────────────────────────────────────────────── */}
      {event.squads.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Squad summary
          </h2>
          {loading ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from(squadConsents.entries()).map(([squad, rows]) => (
                <SquadCard key={squad} squad={squad} consents={rows} />
              ))}
            </div>
          )}
        </section>
      )}

    </div>
  );
}
