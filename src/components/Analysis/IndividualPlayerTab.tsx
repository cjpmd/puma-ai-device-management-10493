
import { useState, useEffect } from 'react';
import PlayerSelector from './PlayerSelector';
import PlayerPerformanceCard from './PlayerPerformanceCard';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bluetooth, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Player {
  id: string;
  name: string;
  position?: string;
}

interface IndividualPlayerTabProps {
  sessionId?: string | null;
  isLiveMode?: boolean;
  clubId?: string;
  teamId?: string;
}

const IndividualPlayerTab = ({ sessionId, isLiveMode = true, clubId, teamId }: IndividualPlayerTabProps) => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [availableSessions, setAvailableSessions] = useState<{id: string, date: string}[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionId);
  const [loading, setLoading] = useState(false);
  const [isBluetoothConnected, setIsBluetoothConnected] = useState(false);

  useEffect(() => {
    // Set the session ID from props when it changes
    setSelectedSessionId(sessionId);
  }, [sessionId]);

  useEffect(() => {
    // Fetch available sessions for this player if one is selected
    if (selectedPlayer) {
      fetchPlayerSessions(selectedPlayer.id);
    }
  }, [selectedPlayer]);

  const fetchPlayerSessions = async (playerId: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('sessions')
        .select('id, start_time')
        .eq('player_id', playerId)
        .order('start_time', { ascending: false })
        .limit(10);
        
      if (error) throw error;
      
      if (data) {
        const formattedSessions = data.map(session => ({
          id: session.id.toString(),
          date: new Date(session.start_time).toLocaleString()
        }));
        
        setAvailableSessions(formattedSessions);
        // If we don't have a selected session yet, select the first one
        if (!selectedSessionId && formattedSessions.length > 0) {
          setSelectedSessionId(formattedSessions[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching player sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  useEffect(() => {
    // Simulate Bluetooth connection check
    const timer = setTimeout(() => {
      setIsBluetoothConnected(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="w-full md:w-1/3">
          <PlayerSelector 
            onPlayerSelect={handlePlayerSelect} 
            selectedPlayerId={selectedPlayer?.id}
            clubId={clubId}
            teamId={teamId}
          />
        </div>
        
        {selectedPlayer && !isLiveMode && availableSessions.length > 0 && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedSessionId || ""}
              onValueChange={handleSessionChange}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select historical session" />
              </SelectTrigger>
              <SelectContent>
                {availableSessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      
      {!isBluetoothConnected && !isLiveMode && (
        <Alert variant="default" className="bg-blue-50 border-blue-200 mb-4">
          <Bluetooth className="h-4 w-4" />
          <AlertTitle>Bluetooth Range Booster Recommended</AlertTitle>
          <AlertDescription>
            For optimal performance when tracking multiple players, consider using a 
            Bluetooth range booster device to extend signal reach and stability.
          </AlertDescription>
        </Alert>
      )}

      {selectedPlayer ? (
        <PlayerPerformanceCard 
          player={selectedPlayer} 
          sessionId={selectedSessionId} 
          isLiveMode={isLiveMode}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Player Performance</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-72">
            <p className="text-muted-foreground">
              Select a player to view their performance analysis
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IndividualPlayerTab;
