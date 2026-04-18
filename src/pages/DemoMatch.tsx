import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { MatchCinemaLayout } from '@/components/Matches/Cinema/MatchCinemaLayout';
import { demoMatch, demoMatchJob, demoMatchInsights } from '@/data/demoMatchData';

const DemoMatch = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/matches">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-emerald-700">{demoMatch.title}</h1>
            <p className="text-sm text-muted-foreground">Sample analytics — explore every panel</p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> Demo
          </Badge>
        </div>

        <MatchCinemaLayout
          matchId="demo"
          match={demoMatch}
          job={demoMatchJob}
          demoVideoUrl={demoMatchJob.output_video_url}
          demoInsights={demoMatchInsights}
        />

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Ready to analyse a real match?</p>
            <Link to="/matches">
              <Button size="sm">Back to My Matches</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DemoMatch;
