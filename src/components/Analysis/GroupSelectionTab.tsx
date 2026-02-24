
import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bluetooth, Clock } from "lucide-react";
import MultiPlayerSelector from './MultiPlayerSelector';
import PositionGroupSelector from './PositionGroupSelector';
import GroupAnalysisCard from './GroupAnalysisCard';
import { supabase } from "@/integrations/supabase/client";

interface Player {
  id: string;
  name: string;
  position?: string;
}

interface GroupSelectionTabProps {
  sessionId?: string | null;
  isLiveMode?: boolean;
  clubId?: string;
  teamId?: string;
}

const GroupSelectionTab = ({ sessionId, isLiveMode = true, clubId, teamId }: GroupSelectionTabProps) => {
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectionMethod, setSelectionMethod] = useState<'players' | 'positions'>('players');
  const [isBluetoothConnected, setIsBluetoothConnected] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<{id: string, date: string}[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionId);

  useEffect(() => {
    // Set the session ID from props when it changes
    setSelectedSessionId(sessionId);
    
    // Fetch available group sessions
    if (!isLiveMode) {
      fetchGroupSessions();
    }
    
    // Simulate Bluetooth connection check
    const timer = setTimeout(() => {
      setIsBluetoothConnected(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [sessionId, isLiveMode]);

  const fetchGroupSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, start_time')
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
      console.error('Error fetching group sessions:', error);
    }
  };

  const handlePlayerSelectionChange = (players: Player[]) => {
    setSelectedPlayers(players);
    setSelectionMethod('players');
  };

  const handlePositionSelectionChange = (positions: string[]) => {
    setSelectedPositions(positions);
    
    // For demo purposes, we'll simulate fetching players by position
    // In a real app, you would fetch players from the database based on position
    if (positions.length > 0) {
      fetchPlayersByPosition(positions);
    } else {
      setSelectedPlayers([]);
    }
  };
  
  const fetchPlayersByPosition = async (positions: string[]) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, player_type');
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Map DB data to our Player type
        const allPlayers = data.map(player => ({
          id: player.id,
          name: player.name,
          position: player.player_type === 'GOALKEEPER' ? 'Goalkeeper' : 'Outfield'
        }));
        
        // Filter based on selected positions - this is simplified, would need better mapping
        const filteredPlayers = allPlayers.filter(player => {
          // Simple matching logic - in a real app would be more sophisticated
          return positions.some(pos => 
            player.position?.toLowerCase().includes(pos.toLowerCase().split(' ')[0])
          );
        });
        
        setSelectedPlayers(filteredPlayers);
        setSelectionMethod('positions');
      } else {
        // Fallback sample data if no players in database
        const samplePlayers: Player[] = [
          { id: '3', name: 'Jamie Wilson', position: 'Defender' },
          { id: '7', name: 'Jordan Thompson', position: 'Defender' },
          { id: '2', name: 'Casey Smith', position: 'Midfielder' },
          { id: '6', name: 'Riley Clark', position: 'Midfielder' },
          { id: '1', name: 'Alex Johnson', position: 'Forward' },
          { id: '5', name: 'Morgan Lee', position: 'Forward' },
          { id: '8', name: 'Parker Evans', position: 'Forward' },
          { id: '4', name: 'Taylor Roberts', position: 'Goalkeeper' },
        ];
        
        // Filter players by the selected positions
        const filteredPlayers = samplePlayers.filter(player => 
          positions.some(pos => player.position?.includes(pos.split(' ')[0]))
        );
        
        setSelectedPlayers(filteredPlayers);
        setSelectionMethod('positions');
      }
    } catch (error) {
      console.error('Error fetching players by position:', error);
      
      // Fallback to sample data on error
      const samplePlayers: Player[] = [
        { id: '3', name: 'Jamie Wilson', position: 'Defender' },
        { id: '7', name: 'Jordan Thompson', position: 'Defender' },
        { id: '2', name: 'Casey Smith', position: 'Midfielder' },
        { id: '6', name: 'Riley Clark', position: 'Midfielder' },
      ];
      
      setSelectedPlayers(samplePlayers);
      setSelectionMethod('positions');
    }
  };
  
  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <Tabs defaultValue="players" className="w-full md:w-2/3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="players">Select Players</TabsTrigger>
            <TabsTrigger value="positions">Select by Position</TabsTrigger>
          </TabsList>
          <TabsContent value="players" className="space-y-4 mt-4">
            <MultiPlayerSelector 
              onSelectionChange={handlePlayerSelectionChange}
              selectedPlayerIds={selectedPlayers.map(p => p.id)}
              clubId={clubId}
              teamId={teamId}
            />
          </TabsContent>
          <TabsContent value="positions" className="space-y-4 mt-4">
            <PositionGroupSelector onSelectionChange={handlePositionSelectionChange} />
          </TabsContent>
        </Tabs>
        
        {!isLiveMode && availableSessions.length > 0 && (
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
            For optimal performance when tracking multiple players as a group, consider using a 
            Bluetooth range booster device to extend signal reach and stability.
          </AlertDescription>
        </Alert>
      )}

      {selectedPlayers.length > 0 ? (
        <GroupAnalysisCard 
          title={
            selectionMethod === 'positions' 
              ? `Group Analysis: ${selectedPositions.join(', ')}` 
              : "Selected Players Analysis"
          }
          players={selectedPlayers}
          sessionId={selectedSessionId}
          isLiveMode={isLiveMode}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Group Analysis</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-72">
            <p className="text-muted-foreground">
              Select players or positions to view group analysis
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GroupSelectionTab;
