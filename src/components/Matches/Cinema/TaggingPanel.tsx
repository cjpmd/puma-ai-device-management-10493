import { useEffect, useState } from 'react';
import { Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface TaggingPanelProps {
  matchId: string;
  currentTime: number;
  onTagsChanged?: () => void;
}

const EVENT_TYPES = [
  'goal', 'shot', 'shot_on_target', 'pass', 'key_pass',
  'tackle', 'foul', 'corner', 'free_kick', 'yellow_card', 'red_card',
  'substitution', 'save', 'key_moment',
] as const;

interface TagRow {
  id: string;
  event_type: string;
  timestamp_ms: number;
  team: string | null;
  notes: string | null;
}

export function TaggingPanel({ matchId, currentTime, onTagsChanged }: TaggingPanelProps) {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [notes, setNotes] = useState('');
  const [team, setTeam] = useState<'home' | 'away' | ''>('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('match_event_tags')
      .select('id, event_type, timestamp_ms, team, notes')
      .eq('match_id', matchId)
      .order('timestamp_ms', { ascending: true });
    setTags((data || []) as TagRow[]);
  };

  useEffect(() => { if (matchId && matchId !== 'demo') load(); }, [matchId]);

  const addTag = async (event_type: string) => {
    if (matchId === 'demo') return;
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('match_event_tags').insert({
      match_id: matchId,
      event_type,
      timestamp_ms: Math.round(currentTime * 1000),
      team: team || null,
      notes: notes || null,
      tagged_by: auth.user?.id ?? null,
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Tag failed', description: error.message, variant: 'destructive' });
      return;
    }
    setNotes('');
    await load();
    onTagsChanged?.();
  };

  const removeTag = async (id: string) => {
    await (supabase as any).from('match_event_tags').delete().eq('id', id);
    await load();
    onTagsChanged?.();
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border/40">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="h-4 w-4" /> Tag events (ground truth)
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Scrub the video to a moment, then tap an event. Tags are used to measure analytics accuracy.
        </p>
      </div>

      <div className="p-4 space-y-3 border-b border-border/40">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">@ {fmt(Math.round(currentTime * 1000))}</Badge>
          <div className="flex gap-1">
            {(['', 'home', 'away'] as const).map((t) => (
              <Button key={t || 'any'} size="sm" variant={team === t ? 'default' : 'outline'}
                onClick={() => setTeam(t)} className="h-7 text-xs">
                {t === '' ? 'Any team' : t}
              </Button>
            ))}
          </div>
        </div>
        <Input
          placeholder="Optional notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <Button key={t} size="sm" variant="secondary" disabled={busy}
              onClick={() => addTag(t)} className="h-7 text-xs capitalize">
              {t.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {tags.length === 0 && (
          <p className="text-sm text-muted-foreground p-4 text-center">No tags yet.</p>
        )}
        {tags.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-foreground/5">
            <Badge variant="outline" className="font-mono">{fmt(t.timestamp_ms)}</Badge>
            <span className="capitalize font-medium">{t.event_type.replace(/_/g, ' ')}</span>
            {t.team && <Badge variant="secondary" className="text-xs">{t.team}</Badge>}
            {t.notes && <span className="text-xs text-muted-foreground truncate">— {t.notes}</span>}
            <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => removeTag(t.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}