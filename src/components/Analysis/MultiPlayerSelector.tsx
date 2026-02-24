
import { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Player {
  id: string;
  name: string;
  position?: string;
  player_type?: string;
}

interface MultiPlayerSelectorProps {
  onSelectionChange: (players: Player[]) => void;
  selectedPlayerIds?: string[];
  clubId?: string;
  teamId?: string;
}

const MultiPlayerSelector = ({ 
  onSelectionChange, 
  selectedPlayerIds = [],
  clubId,
  teamId,
}: MultiPlayerSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('players')
          .select('id, name, player_type')
          .order('name');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        } else if (clubId) {
          query = query.eq('club_id', clubId);
        }
          
        const { data, error } = await query;
          
        if (error) throw error;
        
        // If no data in the players table, use sample data for demo
        if (!data || data.length === 0) {
          setPlayers([
            { id: '1', name: 'Alex Johnson', position: 'Forward' },
            { id: '2', name: 'Casey Smith', position: 'Midfielder' },
            { id: '3', name: 'Jamie Wilson', position: 'Defender' },
            { id: '4', name: 'Taylor Roberts', position: 'Goalkeeper' },
            { id: '5', name: 'Morgan Lee', position: 'Forward' },
            { id: '6', name: 'Riley Clark', position: 'Midfielder' },
            { id: '7', name: 'Jordan Thompson', position: 'Defender' },
            { id: '8', name: 'Parker Evans', position: 'Forward' },
          ]);
        } else {
          // Map player_type to position for display purposes
          const mappedPlayers = data.map(player => ({
            id: player.id,
            name: player.name,
            position: player.player_type === 'GOALKEEPER' ? 'Goalkeeper' : 
                     player.player_type === 'OUTFIELD' ? 'Outfield' : player.player_type
          }));
          setPlayers(mappedPlayers);
        }
      } catch (error) {
        console.error('Error fetching players:', error);
        // Use sample data as fallback
        setPlayers([
          { id: '1', name: 'Alex Johnson', position: 'Forward' },
          { id: '2', name: 'Casey Smith', position: 'Midfielder' },
          { id: '3', name: 'Jamie Wilson', position: 'Defender' },
          { id: '4', name: 'Taylor Roberts', position: 'Goalkeeper' },
          { id: '5', name: 'Morgan Lee', position: 'Forward' },
          { id: '6', name: 'Riley Clark', position: 'Midfielder' },
          { id: '7', name: 'Jordan Thompson', position: 'Defender' },
          { id: '8', name: 'Parker Evans', position: 'Forward' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [clubId, teamId]);

  const selectedPlayers = players.filter(player => 
    selectedPlayerIds.includes(player.id)
  );

  const handleSelect = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const newSelection = selectedPlayerIds.includes(playerId)
      ? selectedPlayers.filter(p => p.id !== playerId)
      : [...selectedPlayers, player];
      
    onSelectionChange(newSelection);
  };

  const removePlayer = (playerId: string) => {
    const newSelection = selectedPlayers.filter(p => p.id !== playerId);
    onSelectionChange(newSelection);
  };

  return (
    <div className="space-y-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={loading}
          >
            {selectedPlayers.length > 0 
              ? `${selectedPlayers.length} player${selectedPlayers.length > 1 ? 's' : ''} selected`
              : "Select players..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search players..." />
            <CommandList>
              <CommandEmpty>No player found.</CommandEmpty>
              <CommandGroup>
                {players.map((player) => (
                  <CommandItem
                    key={player.id}
                    value={player.name}
                    onSelect={() => handleSelect(player.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedPlayerIds.includes(player.id) 
                          ? "opacity-100" 
                          : "opacity-0"
                      )}
                    />
                    <span>{player.name}</span>
                    {player.position && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {player.position}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedPlayers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedPlayers.map(player => (
            <Badge 
              key={player.id} 
              variant="secondary"
              className="py-1 px-2"
            >
              {player.name}
              <button 
                className="ml-1 text-muted-foreground hover:text-foreground"
                onClick={() => removePlayer(player.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiPlayerSelector;
