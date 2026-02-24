import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Video } from 'lucide-react';
import { useMatchPolling } from '@/hooks/useMatchPolling';
import { MatchCard } from '@/components/Matches/MatchCard';
import { CreateMatchDialog } from '@/components/Matches/CreateMatchDialog';

const Matches = () => {
  const { matches, loading, refetch } = useMatchPolling();

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <h1 className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
              <Video className="h-6 w-6" />
              Match Analysis
            </h1>
          </div>
          <CreateMatchDialog onCreated={refetch} />
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading matches...</p>
        ) : matches.length === 0 ? (
          <div className="text-center py-12">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No matches yet. Create your first match to get started.</p>
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
  );
};

export default Matches;
