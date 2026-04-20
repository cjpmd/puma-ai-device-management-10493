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
import { syncUserAccess } from '@/hooks/useUserTeams';
import { useToast } from '@/hooks/use-toast';

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
    setSyncing(true);
    const result = await syncUserAccess();
    setSyncing(false);
    if (result?.success) {
      toast({ title: 'Synced', description: 'Team access updated from Origin Sports' });
      refresh();
    } else {
      toast({ title: 'Sync failed', description: 'Could not reach Origin Sports', variant: 'destructive' });
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

        {/* Team switcher */}
        <SectionHeader title="My Teams" action={syncing ? 'Syncing…' : 'Sync'} />
        <div style={{ padding: '0 16px 20px' }} onClick={!syncing ? handleSync : undefined}>
          <Glass r={20}>
            {teams.length === 0 && (
              <div style={{ padding: 18, ...tType('subhead'), color: T.fg2, textAlign: 'center' }}>
                No teams yet. Tap Sync to pull from Origin Sports.
              </div>
            )}
            {teams.map((t, i) => (
              <div key={t.id} onClick={(e) => { e.stopPropagation(); setActiveTeam(t.id); }} style={{
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
