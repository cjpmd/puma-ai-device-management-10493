import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glass } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Avatar } from '@/components/ios/Avatar';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { supabase } from '@/integrations/supabase/client';
import { syncAll } from '@/hooks/useUserTeams';
import { useToast } from '@/hooks/use-toast';

const LAST_SYNC_KEY = 'origin.lastSyncedAt';
const fmtAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

interface ProfileScreenProps {
  onTabChange?: (tab: number) => void;
}

export function ProfileScreen({ onTabChange }: ProfileScreenProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { teams, activeTeam, setActiveTeam, refresh } = useActiveTeam();
  const [email, setEmail] = useState<string>('');
  const [deviceCount, setDeviceCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    try { return localStorage.getItem(LAST_SYNC_KEY); } catch { return null; }
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setEmail(user.email);

      const [{ count: dCount }, { count: mCount }] = await Promise.all([
        supabase.from('devices').select('id', { count: 'exact', head: true }),
        supabase.from('matches').select('id', { count: 'exact', head: true }),
      ]);
      setDeviceCount(dCount || 0);
      setMatchCount(mCount || 0);
    })();
  }, []);

  useEffect(() => {
    if (!activeTeam) return;
    (async () => {
      const { count } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', activeTeam.id);
      setPlayerCount(count || 0);
    })();
  }, [activeTeam]);

  const initials = email ? email.slice(0, 2).toUpperCase() : 'OS';

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    toast({ title: 'Syncing…', description: 'Pulling teams, players, photos & attributes' });
    const result = await syncAll();
    setSyncing(false);
    if (result?.success) {
      const now = new Date().toISOString();
      setLastSynced(now);
      try { localStorage.setItem(LAST_SYNC_KEY, now); } catch {}
      const counts = (result.data && (result.data as any).results) || {};
      const summary = Object.entries(counts)
        .map(([k, v]: [string, any]) => typeof v === 'number' ? `${k}: ${v}` : null)
        .filter(Boolean)
        .join(' · ');
      toast({ title: 'Synced from Origin Sports', description: summary || 'All entities updated' });
      refresh();
    } else {
      toast({
        title: 'Sync failed',
        description: result?.error || 'Could not reach Origin Sports',
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.twilight, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ ...tType('largeTitle'), color: T.fg }}>Profile</div>
      </div>
      <div style={{ height: 'calc(100% - 44px - 12px - 100px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* User hero */}
        <div style={{ padding: '8px 20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar initials={initials} size={72} hue={310} ring={T.purple[400]} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...tType('title2'), color: T.fg, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email || 'Signed-in user'}</div>
            <div style={{ ...tType('subhead'), color: T.fg2 }}>
              {activeTeam ? `${activeTeam.role} · ${activeTeam.name}` : 'No team linked'}
            </div>
            <Glass r={10} style={{ display: 'inline-block', marginTop: 8, padding: '4px 12px' }} tint="purple">
              <div style={{ ...tType('caption1'), color: T.purple[200], fontWeight: 600 }}>Origin Sports Performance</div>
            </Glass>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ padding: '0 16px 20px' }}>
          <Glass r={22}>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {[
                { v: String(playerCount), label: 'Players' },
                { v: String(matchCount), label: 'Matches' },
                { v: String(deviceCount), label: 'Devices' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ ...tType('title1'), color: T.fg }}>{s.v}</div>
                  <div style={{ ...tType('caption1'), color: T.fg2, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Glass>
        </div>

        {/* Sync from Origin Sports */}
        <div style={{ padding: '0 16px 16px' }}>
          <Glass r={18} tint={syncing ? 'neutral' : 'purple'} onClick={!syncing ? handleSync : undefined}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${T.purple[400]}, ${T.magenta})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d={syncing
                    ? 'M12 4v4m0 8v4m8-8h-4M8 12H4'
                    : 'M21 12a9 9 0 11-3-6.7L21 8m0-4v4h-4'}
                    stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...tType('headline'), color: T.fg }}>
                  {syncing ? 'Syncing from Origin Sports…' : 'Sync from Origin Sports'}
                </div>
                <div style={{ ...tType('caption1'), color: T.fg2, marginTop: 2 }}>
                  {syncing
                    ? 'Pulling teams · players · photos · attributes'
                    : lastSynced ? `Last synced ${fmtAgo(lastSynced)}` : 'Tap to pull latest squad & photos'}
                </div>
              </div>
              {!syncing && (
                <svg width="10" height="16" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.fg} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </div>
          </Glass>
        </div>

        {/* Team switcher */}
        <SectionHeader title="My Teams" />
        <div style={{ padding: '0 16px 20px' }}>
          <Glass r={20}>
            {teams.length === 0 && (
              <div style={{ padding: 18, ...tType('subhead'), color: T.fg2, textAlign: 'center' }}>
                No teams yet. Tap Sync to pull from Origin Sports.
              </div>
            )}
            {teams.map((t, i) => (
              <div key={t.id} onClick={() => setActiveTeam(t.id)} style={{
                display: 'flex', alignItems: 'center', padding: '12px 16px',
                borderBottom: i < teams.length - 1 ? `0.5px solid ${T.hairline}` : 'none',
                gap: 12, cursor: 'pointer',
              }}>
                <Avatar initials={t.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} size={36} hue={295} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...tType('headline'), color: T.fg }}>{t.name}</div>
                  <div style={{ ...tType('footnote'), color: T.fg2 }}>
                    {t.age_group || 'Senior'} · {t.role}
                  </div>
                </div>
                {activeTeam?.id === t.id && (
                  <div style={{ ...tType('caption1'), color: T.purple[300], fontWeight: 600 }}>ACTIVE</div>
                )}
              </div>
            ))}
          </Glass>
        </div>

        <SectionHeader title="Settings" />
        <div style={{ padding: '0 16px 20px' }}>
          <Glass r={20}>
            {[
              { label: 'Wearable Devices', detail: `${deviceCount} connected`, action: () => navigate('/devices') },
              { label: 'Pitch Calibration', detail: '', action: () => navigate('/pitch-calibration') },
              { label: 'ML Training', detail: '', action: () => navigate('/ml-training') },
            ].map((item, i, arr) => (
              <div key={i} onClick={item.action} style={{
                display: 'flex', alignItems: 'center', padding: '14px 16px',
                borderBottom: i < arr.length - 1 ? `0.5px solid ${T.hairline}` : 'none',
                gap: 12, cursor: 'pointer',
              }}>
                <div style={{ flex: 1, ...tType('body'), color: T.fg }}>{item.label}</div>
                {item.detail && <div style={{ ...tType('subhead'), color: T.fg2 }}>{item.detail}</div>}
                <svg width="8" height="14" viewBox="0 0 8 14">
                  <path d="M1 1l6 6-6 6" stroke={T.fg3} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ))}
          </Glass>
        </div>

        {/* Sign out */}
        <div style={{ padding: '0 16px 40px' }}>
          <Glass r={20} onClick={handleSignOut}>
            <div style={{ padding: 14, textAlign: 'center', ...tType('headline'), color: T.red }}>
              Sign out
            </div>
          </Glass>
        </div>
      </div>
      <TabBar active={4} onChange={onTabChange} />
    </div>
  );
}
