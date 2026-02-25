import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Video, RefreshCw } from 'lucide-react';
import { useMatchPolling } from '@/hooks/useMatchPolling';
import { MatchCard } from '@/components/Matches/MatchCard';
import { CreateMatchDialog } from '@/components/Matches/CreateMatchDialog';
import { EventCard, type TeamEvent } from '@/components/Matches/EventCard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';


const Matches = () => {
  const { matches, loading, refetch } = useMatchPolling();
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('team_events')
      .select('*')
      .order('date', { ascending: true });
    if (data) setEvents(data as TeamEvent[]);
    setEventsLoading(false);
  }, []);

  const fetchTeams = useCallback(async () => {
    const { data } = await supabase.from('teams').select('id, name');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((t: any) => { map[t.id] = t.name; });
      setTeams(map);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchTeams();
  }, [fetchEvents, fetchTeams]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await supabase.functions.invoke('sync-external-data', {
        body: { entity: 'events' },
      });
      if (res.error) throw new Error(res.error.message);
      toast({ title: 'Events synced', description: `${res.data?.results?.events?.updated || 0} events updated` });
      fetchEvents();
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSetupRecording = async (event: TeamEvent) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create a match linked to this event
      const { data, error } = await supabase.from('matches').insert({
        user_id: user.id,
        title: event.title,
        match_date: event.date,
        location: event.location || null,
        team_id: event.team_id || null,
        status: 'draft',
      }).select().single();

      if (error) throw error;

      // Link event to match
      await supabase.from('team_events').update({ match_id: data.id }).eq('id', event.id);

      toast({ title: 'Recording setup created' });
      refetch();
      fetchEvents();
      navigate(`/matches/${data.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Split events: upcoming (future, no match linked) and recent (past, sorted newest first)
  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const recentEvents = events
    .filter(e => e.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <h1 className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
              <Video className="h-6 w-6" />
              Match Analysis
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Events'}
            </Button>
            <CreateMatchDialog onCreated={refetch} />
          </div>
        </div>

        {/* Upcoming & Recent Events Banner */}
        {!eventsLoading && (upcomingEvents.length > 0 || recentEvents.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Upcoming */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</h2>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events</p>
              ) : (
                upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    teamName={event.team_id ? teams[event.team_id] : undefined}
                    onSetupRecording={handleSetupRecording}
                  />
                ))
              )}
            </div>
            {/* Recent */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent</h2>
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent events</p>
              ) : (
                recentEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    teamName={event.team_id ? teams[event.team_id] : undefined}
                    onSetupRecording={handleSetupRecording}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Matches List */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All Matches</h2>
          {loading ? (
            <p className="text-muted-foreground text-center py-12">Loading matches...</p>
          ) : matches.length === 0 ? (
            <div className="text-center py-12">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No matches yet. Create one or set up recording from a team event.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Matches;
