import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
        title: title || 'Untitled Match',
        match_date: matchDate || null,
        location: location || null,
        status: 'draft',
      }).select().single();

      if (error) throw error;

      toast({ title: 'Match created' });
      setOpen(false);
      setTitle('');
      setMatchDate('');
      setLocation('');
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Match</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. League Match vs Team B" />
          </div>
          <div>
            <Label htmlFor="date">Match Date</Label>
            <Input id="date" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Main Stadium" />
          </div>
          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? 'Creating...' : 'Create Match'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
