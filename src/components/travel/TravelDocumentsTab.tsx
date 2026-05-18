import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Circle, FileText, Lock, Plus, Trash2, Upload, Download,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TravelEvent } from '@/pages/TravelEventDetail';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType =
  | 'consent' | 'passport' | 'medical' | 'insurance'
  | 'booking' | 'risk_assessment' | 'other';

interface DocumentRow {
  id: string;
  title: string;
  document_type: DocType;
  file_url: string | null;
  is_restricted: boolean;
  required: boolean;
  uploaded_at: string;
}

interface ConsentRow {
  id: string;
  player_id: string;
  travel_consent_signed: boolean;
  passport_submitted: boolean;
  medical_declaration_signed: boolean;
  photo_consent: boolean;
  emergency_contact_confirmed: boolean;
  dietary_requirements: string | null;
  passport_expiry: string | null;
  players: { id: string; name: string } | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CONSENT_FIELDS: { key: keyof ConsentRow; label: string; short: string }[] = [
  { key: 'travel_consent_signed',       label: 'Travel consent signed',        short: 'Consent'    },
  { key: 'passport_submitted',          label: 'Passport submitted',            short: 'Passport'   },
  { key: 'medical_declaration_signed',  label: 'Medical declaration signed',    short: 'Medical'    },
  { key: 'photo_consent',               label: 'Photo consent',                 short: 'Photo'      },
  { key: 'emergency_contact_confirmed', label: 'Emergency contact confirmed',   short: 'Emergency'  },
];

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: 'consent',         label: 'Travel consent form'   },
  { value: 'passport',        label: 'Passport copies'       },
  { value: 'medical',         label: 'Medical information'   },
  { value: 'insurance',       label: 'Travel insurance'      },
  { value: 'booking',         label: 'Booking confirmation'  },
  { value: 'risk_assessment', label: 'Risk assessment'       },
  { value: 'other',           label: 'Other'                 },
];

const DOC_TYPE_LABELS: Record<DocType, string> = Object.fromEntries(
  DOC_TYPE_OPTIONS.map(o => [o.value, o.label]),
) as Record<DocType, string>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreOf(c: ConsentRow): number {
  return CONSENT_FIELDS.filter(f => c[f.key] === true).length;
}

function borderAccent(score: number): string {
  if (score === 5) return 'border-l-emerald-500';
  if (score >= 3)  return 'border-l-amber-400';
  if (score >= 1)  return 'border-l-orange-400';
  return 'border-l-red-400';
}

function scoreBadge(score: number): React.ReactNode {
  const colour =
    score === 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    score >= 3  ? 'bg-amber-50 text-amber-700 border-amber-200'       :
    score >= 1  ? 'bg-orange-50 text-orange-700 border-orange-200'    :
                  'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colour}`}>
      {score}/5
    </span>
  );
}

function FieldDot({ value }: { value: boolean }) {
  return value
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
    : <Circle       className="w-4 h-4 text-slate-200 mx-auto"   />;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Doc Form (outside component for stable identity) ─────────────────────────

interface DocFormState {
  title: string;
  document_type: DocType;
  is_restricted: boolean;
  required: boolean;
}

const EMPTY_DOC: DocFormState = {
  title: '',
  document_type: 'other',
  is_restricted: false,
  required: true,
};

function DocFormPanel({
  form,
  setForm,
  fileRef,
  onSubmit,
  saving,
  onCancel,
}: {
  form: DocFormState;
  setForm: React.Dispatch<React.SetStateAction<DocFormState>>;
  fileRef: React.RefObject<HTMLInputElement>;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  onCancel: () => void;
}) {
  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <form
      onSubmit={onSubmit}
      className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4"
    >
      <h3 className="text-sm font-semibold text-slate-800">Add document</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Title *</label>
          <input
            className={inputCls}
            placeholder="e.g. Parental consent form"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className={labelCls}>Type *</label>
          <select
            className={inputCls}
            value={form.document_type}
            onChange={e => setForm(f => ({ ...f, document_type: e.target.value as DocType }))}
          >
            {DOC_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>File (optional — can upload later)</label>
        <input
          ref={fileRef}
          type="file"
          className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={form.required}
            onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
          />
          <span className="text-slate-700">Required</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            checked={form.is_restricted}
            onChange={e => setForm(f => ({ ...f, is_restricted: e.target.checked }))}
          />
          <span className="text-slate-700">Restricted (staff only)</span>
        </label>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Add document'}
        </button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TravelDocumentsTab({ event }: { event: TravelEvent }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm]         = useState<DocFormState>(EMPTY_DOC);
  const [savingDoc, setSavingDoc]     = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: consents = [], isLoading: consentLoading } = useQuery<ConsentRow[]>({
    queryKey: ['travel-consents-docs', event.id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_player_consent')
        .select(`
          id, player_id,
          travel_consent_signed, passport_submitted,
          medical_declaration_signed, photo_consent,
          emergency_contact_confirmed,
          dietary_requirements, passport_expiry,
          players (id, name)
        `)
        .eq('travel_event_id', event.id)
        .order('players(name)');
      if (error) throw error;
      return (data ?? []) as ConsentRow[];
    },
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery<DocumentRow[]>({
    queryKey: ['travel-documents', event.id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('travel_document')
        .select('id, title, document_type, file_url, is_restricted, required, uploaded_at')
        .eq('travel_event_id', event.id)
        .order('document_type');
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
  });

  // ── Delete document ──────────────────────────────────────────────────────────

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('travel_document')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel-documents', event.id] }),
    onError: (e: Error) => setError(e.message),
  });

  // ── Upload file to existing doc ──────────────────────────────────────────────

  async function handleUploadFile(doc: DocumentRow, file: File) {
    setUploadingId(doc.id);
    setError(null);
    try {
      const ext  = file.name.split('.').pop() ?? 'bin';
      const path = `${event.id}/${doc.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('travel-documents')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from('travel-documents')
        .getPublicUrl(path);

      const { error: dbErr } = await (supabase as any)
        .from('travel_document')
        .update({ file_url: urlData.publicUrl, uploaded_at: new Date().toISOString() })
        .eq('id', doc.id);
      if (dbErr) throw dbErr;

      qc.invalidateQueries({ queryKey: ['travel-documents', event.id] });
      qc.invalidateQueries({ queryKey: ['travel-required-docs', event.id] });
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  }

  // ── Add document ─────────────────────────────────────────────────────────────

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault();
    setSavingDoc(true);
    setError(null);

    try {
      const { data: inserted, error: insertErr } = await (supabase as any)
        .from('travel_document')
        .insert({
          travel_event_id: event.id,
          title:           docForm.title,
          document_type:   docForm.document_type,
          is_restricted:   docForm.is_restricted,
          required:        docForm.required,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      const file = fileRef.current?.files?.[0];
      if (file && inserted?.id) {
        const ext  = file.name.split('.').pop() ?? 'bin';
        const path = `${event.id}/${inserted.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('travel-documents')
          .upload(path, file, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from('travel-documents')
            .getPublicUrl(path);
          await (supabase as any)
            .from('travel_document')
            .update({ file_url: urlData.publicUrl })
            .eq('id', inserted.id);
        }
      }

      qc.invalidateQueries({ queryKey: ['travel-documents', event.id] });
      qc.invalidateQueries({ queryKey: ['travel-required-docs', event.id] });
      setDocForm(EMPTY_DOC);
      if (fileRef.current) fileRef.current.value = '';
      setShowDocForm(false);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add document');
    } finally {
      setSavingDoc(false);
    }
  }

  // ── Toggle individual consent field ─────────────────────────────────────────

  const toggleConsent = useMutation({
    mutationFn: async ({
      consentId, field, value,
    }: { consentId: string; field: string; value: boolean }) => {
      const { error } = await (supabase as any)
        .from('travel_player_consent')
        .update({ [field]: value })
        .eq('id', consentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel-consents-docs', event.id] });
      qc.invalidateQueries({ queryKey: ['travel-consents', event.id] });
    },
    onError: (e: Error) => setError(e.message),
  });

  // ── Missing count ────────────────────────────────────────────────────────────
  const missingDocs = documents.filter(d => d.required && !d.file_url).length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 space-y-8">

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            className="ml-auto text-red-400 hover:text-red-600"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Section 1: Consent completion grid ──────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Player consent status
          </h2>
          {!consentLoading && (
            <span className="text-xs text-slate-500">
              {consents.filter(c => scoreOf(c) === 5).length}/{consents.length} fully complete
            </span>
          )}
        </div>

        {consentLoading ? (
          <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
        ) : consents.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">
            No players added to this event yet.
          </div>
        ) : (
          <>
            {/* Desktop grid */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div
                className="grid text-[11px] font-semibold uppercase tracking-wider text-slate-400
                           bg-slate-50 border-b border-slate-200 px-4 py-2.5"
                style={{
                  gridTemplateColumns: '1fr repeat(5, 80px) 64px',
                }}
              >
                <div>Player</div>
                {CONSENT_FIELDS.map(f => (
                  <div key={String(f.key)} className="text-center leading-tight px-1">
                    {f.short}
                  </div>
                ))}
                <div className="text-center">Score</div>
              </div>

              <div className="divide-y divide-slate-100">
                {consents.map(c => {
                  const score = scoreOf(c);
                  return (
                    <div
                      key={c.id}
                      className={`grid items-center px-4 py-2.5 border-l-4 ${borderAccent(score)}`}
                      style={{ gridTemplateColumns: '1fr repeat(5, 80px) 64px' }}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {c.players?.name ?? 'Unknown player'}
                        </p>
                        {c.dietary_requirements && (
                          <p className="text-[11px] text-amber-600 truncate max-w-[160px]">
                            Diet: {c.dietary_requirements}
                          </p>
                        )}
                        {c.passport_expiry && (
                          <p className="text-[11px] text-slate-400">
                            Passport exp: {fmtDate(c.passport_expiry)}
                          </p>
                        )}
                      </div>

                      {CONSENT_FIELDS.map(f => (
                        <button
                          key={String(f.key)}
                          title={`Toggle ${f.label}`}
                          className="flex items-center justify-center py-1 hover:bg-slate-50 rounded transition-colors"
                          onClick={() =>
                            toggleConsent.mutate({
                              consentId: c.id,
                              field:     String(f.key),
                              value:     !(c[f.key] as boolean),
                            })
                          }
                        >
                          <FieldDot value={c[f.key] as boolean} />
                        </button>
                      ))}

                      <div className="flex justify-center">
                        {scoreBadge(score)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {consents.map(c => {
                const score = scoreOf(c);
                return (
                  <div
                    key={c.id}
                    className={`bg-white border border-slate-200 rounded-xl border-l-4 ${borderAccent(score)} overflow-hidden`}
                  >
                    <div className="px-4 py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">
                          {c.players?.name ?? 'Unknown player'}
                        </p>
                        {c.dietary_requirements && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            Diet: {c.dietary_requirements}
                          </p>
                        )}
                        {c.passport_expiry && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Passport expires: {fmtDate(c.passport_expiry)}
                          </p>
                        )}
                      </div>
                      {scoreBadge(score)}
                    </div>

                    <div className="border-t border-slate-100 grid grid-cols-2 divide-x divide-y divide-slate-100">
                      {CONSENT_FIELDS.map(f => (
                        <button
                          key={String(f.key)}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                          onClick={() =>
                            toggleConsent.mutate({
                              consentId: c.id,
                              field:     String(f.key),
                              value:     !(c[f.key] as boolean),
                            })
                          }
                        >
                          <FieldDot value={c[f.key] as boolean} />
                          <span className="text-xs text-slate-600">{f.short}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Section 2: Trip documents ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Trip documents
            </h2>
            {missingDocs > 0 && (
              <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5 font-medium">
                {missingDocs} missing
              </span>
            )}
          </div>
          {!showDocForm && (
            <button
              onClick={() => setShowDocForm(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add document
            </button>
          )}
        </div>

        {showDocForm && (
          <div className="mb-4">
            <DocFormPanel
              form={docForm}
              setForm={setDocForm}
              fileRef={fileRef}
              onSubmit={handleAddDoc}
              saving={savingDoc}
              onCancel={() => { setShowDocForm(false); setDocForm(EMPTY_DOC); }}
            />
          </div>
        )}

        {docsLoading ? (
          <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
        ) : documents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-8 text-center">
            <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No documents yet.</p>
            <p className="text-xs text-slate-300 mt-1">Add consent forms, insurance, risk assessments and more.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {documents.map(doc => {
              const uploaded = !!doc.file_url;
              return (
                <div key={doc.id} className="px-4 py-3 flex items-start gap-3">
                  {/* Status icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {uploaded
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : doc.required
                        ? <AlertCircle className="w-4 h-4 text-red-400" />
                        : <Circle      className="w-4 h-4 text-slate-300" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-800">
                        {doc.title}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5">
                        {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                      </span>
                      {doc.is_restricted && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          Restricted
                        </span>
                      )}
                      {doc.required && !uploaded && (
                        <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5 font-medium">
                          Missing
                        </span>
                      )}
                      {doc.required && uploaded && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">
                          Required
                        </span>
                      )}
                    </div>
                    {uploaded && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Uploaded {fmtDate(doc.uploaded_at)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {uploaded ? (
                      <a
                        href={doc.file_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Download / view"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    ) : (
                      <>
                        <input
                          type="file"
                          className="hidden"
                          ref={el => { uploadRefs.current[doc.id] = el; }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadFile(doc, file);
                          }}
                        />
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                          title="Upload file"
                          disabled={uploadingId === doc.id}
                          onClick={() => uploadRefs.current[doc.id]?.click()}
                        >
                          {uploadingId === doc.id
                            ? <span className="text-[10px] text-blue-500 font-medium px-1">…</span>
                            : <Upload className="w-4 h-4" />
                          }
                        </button>
                      </>
                    )}

                    <button
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete document"
                      onClick={() => {
                        if (confirm(`Delete "${doc.title}"?`)) deleteDoc.mutate(doc.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
