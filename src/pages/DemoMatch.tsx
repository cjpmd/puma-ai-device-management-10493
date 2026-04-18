import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin, Sparkles } from 'lucide-react';
import { MatchVideoPlayer } from '@/components/Matches/MatchVideoPlayer';
import { MatchAnalyticsDashboard } from '@/components/Matches/MatchAnalyticsDashboard';
import { demoMatch, demoMatchJob, demoMatchInsights } from '@/data/demoMatchData';

const DemoMatch = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/matches">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-emerald-700">{demoMatch.title}</h1>
            <div className="flex gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(demoMatch.match_date).toLocaleDateString()}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{demoMatch.location}</span>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> Demo
          </Badge>
        </div>

        {/* Demo banner */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">This is a demo with sample data.</p>
              <p className="text-muted-foreground mt-1">
                Explore every analytics view below — once you record and process a real match, your dashboard will look just like this with your team's data.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Match Video Player with click-to-jump events */}
        <MatchVideoPlayer matchId="demo" job={demoMatchJob as any} demoVideoUrl={demoMatchJob.output_video_url} />

        {/* Analytics Dashboard */}
        <MatchAnalyticsDashboard matchId="demo" job={demoMatchJob as any} demoInsights={demoMatchInsights} />

        <Card>
          <CardHeader><CardTitle className="text-sm">Ready to analyse a real match?</CardTitle></CardHeader>
          <CardContent>
            <Link to="/matches">
              <Button>Back to My Matches</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DemoMatch;
