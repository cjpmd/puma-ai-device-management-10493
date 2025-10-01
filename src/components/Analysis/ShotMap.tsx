import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, MapPin } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface Shot {
  location_x: number;
  location_y: number;
  is_goal: boolean;
}

interface ShotMapProps {
  videoId?: string;
}

const ShotMap = ({ videoId }: ShotMapProps) => {
  const [shots, setShots] = useState<Shot[]>([]);
  const [totalShots, setTotalShots] = useState(0);
  const [goalsScored, setGoalsScored] = useState(0);

  useEffect(() => {
    // Fetch latest shots regardless of video

    const fetchShots = async () => {
      const { data, error } = await supabase
        .from('shot_analysis')
        .select('location_x, location_y, is_goal')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching shots:', error);
        return;
      }

      setShots((data || []) as Shot[]);
      setTotalShots(data?.length || 0);
      setGoalsScored((data || []).filter(shot => shot.is_goal).length);
    };

    fetchShots();
  }, [videoId]);

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Target className="h-4 w-4" />
          Shot Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full aspect-[2/1] bg-green-100 rounded-lg overflow-hidden">
          {/* Soccer field markings */}
          <div className="absolute inset-0 border-2 border-green-600" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-green-600" />
          <div className="absolute left-[10%] right-[10%] top-[20%] bottom-[20%] border-2 border-green-600" />
          
          {/* Plot shots */}
          {shots.map((shot, index) => (
            <div
              key={index}
              className={`absolute w-3 h-3 transform -translate-x-1/2 -translate-y-1/2 rounded-full ${
                shot.is_goal ? 'bg-red-500' : 'bg-yellow-500'
              }`}
              style={{
                left: `${shot.location_x * 100}%`,
                top: `${shot.location_y * 100}%`,
              }}
            >
              <MapPin className="h-4 w-4" />
            </div>
          ))}
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{totalShots}</div>
            <div className="text-sm text-muted-foreground">Total Shots</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{goalsScored}</div>
            <div className="text-sm text-muted-foreground">Goals Scored</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShotMap;