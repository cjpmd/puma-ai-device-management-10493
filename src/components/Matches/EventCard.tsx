import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Clock, Swords, Video } from 'lucide-react';

interface TeamEvent {
  id: string;
  external_id: string;
  team_id: string | null;
  title: string;
  event_type: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  opponent: string | null;
  is_home: boolean | null;
  game_format: string | null;
  match_id: string | null;
}

interface EventCardProps {
  event: TeamEvent;
  teamName?: string;
  onSetupRecording: (event: TeamEvent) => void;
}

const typeColors: Record<string, string> = {
  match: 'bg-blue-100 text-blue-800',
  training: 'bg-amber-100 text-amber-800',
  tournament: 'bg-purple-100 text-purple-800',
  friendly: 'bg-emerald-100 text-emerald-800',
};

export function EventCard({ event, teamName, onSetupRecording }: EventCardProps) {
  const navigate = useNavigate();
  const hasMatch = !!event.match_id;

  return (
    <Card className="border-border hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            {event.title}
          </CardTitle>
          <div className="flex gap-2">
            <Badge className={typeColors[event.event_type] || 'bg-muted text-muted-foreground'}>
              {event.event_type}
            </Badge>
            {hasMatch && (
              <Badge className="bg-emerald-100 text-emerald-800">
                <Video className="h-3 w-3 mr-1" /> Recording set up
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(event.date).toLocaleDateString()}
            </span>
            {event.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {event.start_time.slice(0, 5)}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
            )}
            {event.opponent && (
              <span className="text-foreground font-medium">
                {event.is_home ? 'vs' : '@'} {event.opponent}
              </span>
            )}
            {teamName && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {teamName}
              </span>
            )}
          </div>
          {hasMatch ? (
            <Button size="sm" variant="outline" onClick={() => navigate(`/matches/${event.match_id}`)}>
              <Video className="h-4 w-4 mr-1" /> Open Recording
            </Button>
          ) : (
            <Button size="sm" onClick={() => onSetupRecording(event)}>
              <Video className="h-4 w-4 mr-1" /> Set Up Recording
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export type { TeamEvent };
