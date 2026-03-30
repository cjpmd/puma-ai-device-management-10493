
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { useEffect, useState, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface GroupAnalysisCardProps {
  title: string;
  players: Array<{
    id: string;
    name: string;
    position?: string;
  }>;
  sessionId?: string | null;
  isLiveMode?: boolean;
}

const GroupAnalysisCard = ({ title, players, sessionId, isLiveMode = true }: GroupAnalysisCardProps) => {
  const initialRandoms = useRef({
    avgSpeed: Math.floor(Math.random() * 30 + 70),
    avgEndurance: Math.floor(Math.random() * 30 + 70),
  });
  const [groupMetrics, setGroupMetrics] = useState<any[]>([]);
  const [averageSpeed, setAverageSpeed] = useState(initialRandoms.current.avgSpeed);
  const [averageEndurance, setAverageEndurance] = useState(initialRandoms.current.avgEndurance);
  
  // Generate colors for each player
  const getPlayerColors = () => {
    const colors = ['#0F766E', '#EAB308', '#8B5CF6', '#EC4899', '#F97316', '#84CC16'];
    
    return players.map((player, index) => ({
      player: player.name,
      color: colors[index % colors.length]
    }));
  };
  
  const playerColors = getPlayerColors();
  
  useEffect(() => {
    // Generate initial metrics
    const initialMetrics = generateMetrics();
    setGroupMetrics(initialMetrics);
    
    // If we have a sessionId, fetch real data
    if (sessionId) {
      fetchSessionData(sessionId);
    }
  }, [players, sessionId]);
  
  const generateMetrics = () => {
    const metrics = ['Speed', 'Endurance', 'Technique', 'Accuracy', 'Power', 'Agility'];
    
    return metrics.map(metric => {
      const result: Record<string, any> = { name: metric };
      
      players.forEach(player => {
        // Generate a random value for each player and metric
        result[player.name] = Math.floor(Math.random() * 100);
      });
      
      return result;
    });
  };
  
  const fetchSessionData = async (sessionId: string) => {
    try {
      // Fetch sensor data for all players in this group for the specified session
      const playerIds = players.map(player => player.id);
      
      const { data, error } = await supabase
        .from('sensor_recordings')
        .select('*')
        .eq('training_session_id', sessionId)
        .limit(200);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Process the data to extract metrics for each player
        // This is simplified - in a real app, you'd have more sophisticated data processing
        
        // For demo purposes, we'll use the session data to influence our random values
        const metrics = ['Speed', 'Endurance', 'Technique', 'Accuracy', 'Power', 'Agility'];
        
        const processedMetrics = metrics.map(metric => {
          const result: Record<string, any> = { name: metric };
          
          players.forEach(player => {
            // Since sensor_recordings don't have player_id, we'll use the session data volume
            // as a general influence factor for demonstration purposes
            const dataFactor = data.length > 0 ? Math.min(data.length / 50, 1) : 0.5;
            
            // Generate a semi-random value influenced by the data volume
            result[player.name] = Math.floor(60 + Math.random() * 40 * dataFactor);
          });
          
          return result;
        });
        
        setGroupMetrics(processedMetrics);
        
        // Update average metrics
        const speedSum = players.reduce((sum, player) => {
          const playerSpeed = processedMetrics.find(m => m.name === 'Speed')?.[player.name] || 0;
          return sum + playerSpeed;
        }, 0);
        
        const enduranceSum = players.reduce((sum, player) => {
          const playerEndurance = processedMetrics.find(m => m.name === 'Endurance')?.[player.name] || 0;
          return sum + playerEndurance;
        }, 0);
        
        setAverageSpeed(Math.floor(speedSum / players.length));
        setAverageEndurance(Math.floor(enduranceSum / players.length));
      }
    } catch (error) {
      console.error('Error fetching group session data:', error);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="text-sm text-muted-foreground">
          {players.length} player{players.length !== 1 && 's'}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={groupMetrics}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              {players.map((player, index) => (
                <Bar 
                  key={player.id}
                  dataKey={player.name} 
                  fill={playerColors[index].color} 
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="space-y-2 mt-4">
          <h4 className="font-medium">Group Performance Summary</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Average Speed</span>
                <span>{averageSpeed}/100</span>
              </div>
              <Progress value={averageSpeed} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Average Endurance</span>
                <span>{averageEndurance}/100</span>
              </div>
              <Progress value={averageEndurance} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GroupAnalysisCard;
