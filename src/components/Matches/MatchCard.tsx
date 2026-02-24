import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MatchCardProps {
  match: {
    id: string;
    title: string;
    match_date: string | null;
    location: string | null;
    status: string;
  };
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  uploading: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  complete: 'bg-green-100 text-green-800',
  failed: 'bg-destructive/10 text-destructive',
};

export function MatchCard({ match }: MatchCardProps) {
  return (
    <Link to={`/matches/${match.id}`}>
      <Card className="hover:shadow-lg transition-shadow border-emerald-100 cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="h-5 w-5 text-emerald-600" />
              {match.title || 'Untitled Match'}
            </CardTitle>
            <Badge className={statusColors[match.status] || ''}>
              {match.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex gap-4 text-sm text-muted-foreground">
          {match.match_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(match.match_date).toLocaleDateString()}
            </span>
          )}
          {match.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {match.location}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
