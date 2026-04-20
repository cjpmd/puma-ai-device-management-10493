import { useState } from 'react';
import { RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { syncAll, syncCore } from '@/hooks/useUserTeams';

interface SyncStatusIndicatorProps {
  entity?: 'clubs' | 'teams' | 'players' | 'all';
  showDetails?: boolean;
}

const SyncStatusIndicator = ({ entity = 'all', showDetails = false }: SyncStatusIndicatorProps) => {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  const handleSync = async () => {
    try {
      setSyncing(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to sync data",
          variant: "destructive",
        });
        return;
      }

      const result = entity === 'all' ? await syncAll() : await syncCore(entity);
      if (!result.success) throw new Error(result.error);

      setLastSync(new Date());
      
      toast({
        title: "Sync completed",
        description: `Successfully synced ${entity === 'all' ? 'all data' : entity}`,
      });

      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync data",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (!showDetails) {
    return (
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Sync Data'}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Sync Status
        </CardTitle>
        <CardDescription>
          Sync clubs, teams, and players from the external database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastSync && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last synced: {lastSync.toLocaleString()}
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleSync()}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync All
          </Button>
          
          <Button
            onClick={() => handleSync()}
            disabled={syncing}
            variant="outline"
            className="gap-2"
          >
            Sync {entity === 'all' ? 'Players' : entity}
          </Button>
        </div>

        <div className="rounded-lg bg-muted p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">About syncing:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Syncing fetches the latest data from the external database</li>
                <li>Existing records will be updated with new information</li>
                <li>The page will refresh after a successful sync</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SyncStatusIndicator;
