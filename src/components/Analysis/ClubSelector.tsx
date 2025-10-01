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

interface Club {
  id: string;
  name: string;
}

interface ClubSelectorProps {
  onClubSelect: (club: Club | null) => void;
  selectedClubId?: string;
}

const ClubSelector = ({ onClubSelect, selectedClubId }: ClubSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('clubs')
          .select('id, name')
          .order('name');
          
        if (error) throw error;
        
        setClubs(data || []);
      } catch (error) {
        console.error('Error fetching clubs:', error);
        setClubs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClubs();
  }, []);

  const selectedClub = clubs.find(club => club.id === selectedClubId);

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
          {selectedClub ? selectedClub.name : "Select club..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search club..." />
          <CommandList>
            <CommandEmpty>No club found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-clubs"
                onSelect={() => {
                  onClubSelect(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !selectedClubId ? "opacity-100" : "opacity-0"
                  )}
                />
                <span>All Clubs</span>
              </CommandItem>
              {clubs.map((club) => (
                <CommandItem
                  key={club.id}
                  value={club.name}
                  onSelect={() => {
                    onClubSelect(club);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedClubId === club.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{club.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ClubSelector;
