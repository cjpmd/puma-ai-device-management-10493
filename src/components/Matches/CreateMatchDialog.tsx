import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

interface CreateMatchDialogProps {
  onCreated: () => void;
}

export function CreateMatchDialog({ onCreated }: CreateMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [location, setLocation] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeColor, setHomeColor] = useState('#10b981');
  const [awayColor, setAwayColor] = useState('#3b82f6');
  const [matchType, setMatchType] = useState('Friendly');
  const [isHome, setIsHome] = useState<'home' | 'away'>('home');
  const [ageGroup, setAgeGroup] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.from('matches').insert({
        user_id: user.id,
        title: title || `${homeTeam || 'Home'} vs ${awayTeam || 'Away'}`,
        match_date: matchDate || null,
        location: location || null,
        status: 'draft',
        home_team: homeTeam || null,
        away_team: awayTeam || null,
        home_color: homeColor,
        away_color: awayColor,
        match_type: matchType,
        is_home: isHome === 'home',
        age_group: ageGroup || null,
      }).select().single();

      if (error) throw error;

      toast({ title: 'Match created' });
      setOpen(false);
      setTitle(''); setMatchDate(''); setLocation('');
      setHomeTeam(''); setAwayTeam(''); setAgeGroup('');
      onCreated();
      if (data) navigate(`/matches/${data.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> New Match
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Match</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="home_team">Home Team</Label>
              <Input id="home_team" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="Lions FC" />
            </div>
            <div>
              <Label htmlFor="away_team">Away Team</Label>
              <Input id="away_team" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="Eagles United" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="home_color">Home Color</Label>
              <Input id="home_color" type="color" value={homeColor} onChange={(e) => setHomeColor(e.target.value)} className="h-10" />
            </div>
            <div>
              <Label htmlFor="away_color">Away Color</Label>
              <Input id="away_color" type="color" value={awayColor} onChange={(e) => setAwayColor(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={matchType} onValueChange={setMatchType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Friendly">Friendly</SelectItem>
                  <SelectItem value="League">League</SelectItem>
                  <SelectItem value="Cup">Cup</SelectItem>
                  <SelectItem value="Tournament">Tournament</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Side</Label>
              <Select value={isHome} onValueChange={(v) => setIsHome(v as 'home' | 'away')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="away">Away</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="age_group">Age Group</Label>
              <Input id="age_group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} placeholder="U9" />
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title (optional)</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Auto-generated from teams" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main Stadium" />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? 'Creating...' : 'Create Match'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
