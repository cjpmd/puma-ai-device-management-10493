import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Team {
  id: string;
  name: string;
  club_id: string;
}

interface TeamSelectorProps {
  onTeamSelect: (team: Team | null) => void;
  selectedTeamId?: string;
  clubId?: string;
}

const TeamSelector = ({ onTeamSelect, selectedTeamId, clubId }: TeamSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('teams')
          .select('id, name, club_id')
          .order('name');
          
        // Filter by club if specified
        if (clubId) {
          query = query.eq('club_id', clubId);
        }
          
        const { data, error } = await query;
          
        if (error) throw error;
        
        setTeams(data || []);
      } catch (error) {
        console.error('Error fetching teams:', error);
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [clubId]);

  const selectedTeam = teams.find(team => team.id === selectedTeamId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading}
        >
          {selectedTeam ? selectedTeam.name : "Select team..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search team..." />
          <CommandList>
            <CommandEmpty>No team found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-teams"
                onSelect={() => {
                  onTeamSelect(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !selectedTeamId ? "opacity-100" : "opacity-0"
                  )}
                />
                <span>All Teams</span>
              </CommandItem>
              {teams.map((team) => (
                <CommandItem
                  key={team.id}
                  value={team.name}
                  onSelect={() => {
                    onTeamSelect(team);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedTeamId === team.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{team.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default TeamSelector;
