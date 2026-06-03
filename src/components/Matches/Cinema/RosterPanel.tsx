import { useEffect, useRef, useState } from 'react';
import { Users, Plus, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface RosterPanelProps {
  matchId: string;
  homeName?: string | null;
  awayName?: string | null;
  teamId?: string | null;
  isHome?: boolean;
}

interface RosterRow {
  id: string;
  side: 'home' | 'away';
  jersey_number: number;
  player_name: string | null;
  player_id: string | null;
}

export function RosterPanel({ matchId, homeName, awayName, teamId, isHome = true }: RosterPanelProps) {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [busy, setBusy] = useState(false);
  const ourSide: 'home' | 'away' = isHome ? 'home' : 'away';
  const autoImportedRef = useRef(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('match_rosters')
      .select('id, side, jersey_number, player_name, player_id')
      .eq('match_id', matchId)
      .order('side', { ascending: true })
      .order('jersey_number', { ascending: true });
    setRows((data || []) as RosterRow[]);
    return (data || []) as RosterRow[];
  };

  useEffect(() => { if (matchId && matchId !== 'demo') load(); }, [matchId]);

  const importFromSquad = async (silent = false): Promise<number> => {
    if (!teamId) {
      if (!silent) toast({ title: 'No team linked', description: 'This match has no team set, so we can\'t pull the squad.', variant: 'destructive' });
      return 0;
    }
    setBusy(true);
    try {
      const { data: squad, error: squadErr } = await supabase
        .from('players')
        .select('id, name, squad_number')
        .eq('team_id', teamId)
        .not('squad_number', 'is', null);
      if (squadErr) throw squadErr;
      if (!squad || squad.length === 0) {
        if (!silent) toast({ title: 'No squad numbers', description: 'Linked squad has no players with jersey numbers.' });
        return 0;
      }
      const existing = new Set(rows.filter((r) => r.side === ourSide).map((r) => r.jersey_number));
      const toInsert = squad
        .filter((p: any) => p.squad_number != null && !existing.has(p.squad_number))
        .map((p: any) => ({
          match_id: matchId,
          side: ourSide,
          jersey_number: p.squad_number as number,
          player_name: p.name as string,
          player_id: p.id as string,
        }));
      if (toInsert.length === 0) {
        if (!silent) toast({ title: 'Already up to date', description: 'All squad numbers are already in the roster.' });
        return 0;
      }
      const { error: insErr } = await (supabase as any).from('match_rosters').insert(toInsert);
      if (insErr) throw insErr;
      await load();
      if (!silent) toast({ title: 'Imported', description: `Added ${toInsert.length} player${toInsert.length === 1 ? '' : 's'} from squad.` });
      return toInsert.length;
    } catch (e: any) {
      if (!silent) toast({ title: 'Import failed', description: e.message ?? String(e), variant: 'destructive' });
      return 0;
    } finally {
      setBusy(false);
    }
  };

  // Auto-import once if our side is empty and we have a team link
  useEffect(() => {
    if (autoImportedRef.current) return;
    if (!matchId || matchId === 'demo' || !teamId) return;
    const ourRows = rows.filter((r) => r.side === ourSide);
    if (ourRows.length > 0) { autoImportedRef.current = true; return; }
    autoImportedRef.current = true;
    importFromSquad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, teamId, rows.length]);

  const remove = async (id: string) => {
    await (supabase as any).from('match_rosters').delete().eq('id', id);
    await load();
  };

  if (matchId === 'demo') {
    return (
      <PanelShell>
        <p className="text-sm text-muted-foreground p-4">Roster editing isn't available in demo mode.</p>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <SideColumn
          title={homeName || 'Home'}
          side="home"
          rows={rows.filter((r) => r.side === 'home')}
          onAdded={load}
          onRemoved={remove}
          matchId={matchId}
          busy={busy}
          setBusy={setBusy}
          isOurSide={ourSide === 'home'}
          canImport={ourSide === 'home' && !!teamId}
          onImport={() => importFromSquad(false)}
        />
        <SideColumn
          title={awayName || 'Away'}
          side="away"
          rows={rows.filter((r) => r.side === 'away')}
          onAdded={load}
          onRemoved={remove}
          matchId={matchId}
          busy={busy}
          setBusy={setBusy}
          isOurSide={ourSide === 'away'}
          canImport={ourSide === 'away' && !!teamId}
          onImport={() => importFromSquad(false)}
        />
      </div>
      <p className="text-xs text-muted-foreground px-5 pb-4">
        Rosters are sent to the GPU on the next analysis run — they help jersey OCR snap noisy reads to a legal squad number.
      </p>
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border/40">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Team rosters
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Enter the jersey numbers (and optional names) for each side. Used by the analyser to identify players.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function SideColumn({
  title, side, rows, onAdded, onRemoved, matchId, busy, setBusy, isOurSide, canImport, onImport,
}: {
  title: string;
  side: 'home' | 'away';
  rows: RosterRow[];
  onAdded: () => void | Promise<unknown>;
  onRemoved: (id: string) => void;
  matchId: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  isOurSide: boolean;
  canImport: boolean;
  onImport: () => void | Promise<unknown>;
}) {
  const [num, setNum] = useState('');
  const [name, setName] = useState('');

  const add = async () => {
    const n = Number(num);
    if (!Number.isFinite(n) || n < 0 || n > 99) {
      toast({ title: 'Invalid number', description: 'Use 0–99.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any).from('match_rosters').insert({
      match_id: matchId,
      side,
      jersey_number: n,
      player_name: name.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
      return;
    }
    setNum('');
    setName('');
    await onAdded();
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold truncate flex items-center gap-2">
          {title}
          {isOurSide && <Badge variant="secondary" className="text-[10px] py-0">Us</Badge>}
        </h3>
        <div className="flex items-center gap-2">
          {isOurSide && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!canImport || busy}
              onClick={() => onImport()}
              title={canImport ? 'Import from linked squad' : 'No team linked to this match'}
            >
              <Download className="h-3 w-3 mr-1" /> Import squad
            </Button>
          )}
          <Badge variant="outline">{rows.length}</Badge>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          placeholder="#"
          value={num}
          onChange={(e) => setNum(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
          className="h-8 w-14 text-center text-sm"
        />
        <Input
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" disabled={busy || !num} onClick={add} className="h-8">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-1">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">No players yet.</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-foreground/5">
            <Badge variant="secondary" className="font-mono w-9 justify-center">#{r.jersey_number}</Badge>
            <span className="truncate flex-1">{r.player_name || <em className="text-muted-foreground">unnamed</em>}</span>
            {r.player_id && (
              <Badge variant="outline" className="text-[10px] py-0">Squad</Badge>
            )}
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onRemoved(r.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}