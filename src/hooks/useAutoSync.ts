import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { syncAll, syncEvents } from './useUserTeams';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function useAutoSync(onSyncComplete?: () => void) {
  const isSyncing = useRef(false);
  const [syncing, setSyncing] = useState(false);
  // Use a ref so the stable runSync callback always calls the latest onSyncComplete
  const onSyncCompleteRef = useRef(onSyncComplete);
  onSyncCompleteRef.current = onSyncComplete;

  const runSync = useCallback(async (full = false) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      if (full) {
        await syncAll();
      } else {
        await syncEvents();
      }
      onSyncCompleteRef.current?.();
    } catch (e) {
      console.error('Auto-sync error:', e);
    } finally {
      isSyncing.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    // Full sync on mount, then lightweight event-only poll every 5 min
    runSync(true);
    const interval = setInterval(() => runSync(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [runSync]);

  return { syncing, runSync };
}
