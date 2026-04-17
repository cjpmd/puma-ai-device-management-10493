import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface AIInsightsPanelProps {
  matchId: string;
}

interface Insights {
  status: string;
  summary?: string | null;
  team_strengths?: string[] | null;
  team_weaknesses?: string[] | null;
  top_performers?: { track_id: number; reason: string }[] | null;
  coaching_focus?: string[] | null;
  error?: string | null;
}

export function AIInsightsPanel({ matchId }: AIInsightsPanelProps) {
  const { toast } = useToast();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchInsights = async () => {
    const { data } = await supabase
      .from('match_insights')
      .select('*')
      .eq('match_id', matchId)
      .maybeSingle();
    setInsights(data ? (data as unknown as Insights) : null);
    setLoading(false);
  };

  useEffect(() => {
    fetchInsights();
    // Realtime subscription for status updates
    const ch = supabase
      .channel(`match_insights:${matchId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'match_insights',
        filter: `match_id=eq.${matchId}`,
      }, () => fetchInsights())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('generate-match-insights', {
        body: { match_id: matchId },
      });
      if (error) throw error;
      toast({ title: 'Insights generated', description: 'AI analysis complete.' });
      fetchInsights();
    } catch (err: any) {
      toast({ title: 'Failed to generate insights', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading insights...
      </div>
    );
  }

  const isGenerating = generating || insights?.status === 'generating' || insights?.status === 'pending';
  const hasContent = insights?.status === 'complete' && insights.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Coach Insights</h3>
          {insights?.status && (
            <Badge variant={insights.status === 'complete' ? 'default' : 'secondary'}>
              {insights.status}
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={generate} disabled={isGenerating}>
          {isGenerating
            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating...</>
            : <><RefreshCw className="h-4 w-4 mr-1" /> {hasContent ? 'Regenerate' : 'Generate'}</>
          }
        </Button>
      </div>

      {insights?.status === 'failed' && insights.error && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>{insights.error}</div>
          </CardContent>
        </Card>
      )}

      {!hasContent && !isGenerating && insights?.status !== 'failed' && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No AI insights yet. Click <strong>Generate</strong> to analyse this match.
          </CardContent>
        </Card>
      )}

      {hasContent && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Match Summary</CardTitle></CardHeader>
            <CardContent className="text-sm leading-relaxed">{insights.summary}</CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm text-primary">Strengths</CardTitle></CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1.5 list-disc pl-4">
                  {insights.team_strengths?.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-destructive">Weaknesses</CardTitle></CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1.5 list-disc pl-4">
                  {insights.team_weaknesses?.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Top Performers</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                {insights.top_performers?.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <Badge variant="secondary" className="font-mono shrink-0">#{p.track_id}</Badge>
                    <span>{p.reason}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Coaching Focus</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1.5 list-disc pl-4">
                {insights.coaching_focus?.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
