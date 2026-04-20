import React, { useState, useEffect } from 'react';
import { HomeScreen } from './HomeScreen';
import { SquadScreen } from './SquadScreen';
import { MatchesScreen } from './MatchesScreen';
import { UltraScreen } from './UltraScreen';
import { ProfileScreen } from './ProfileScreen';
import { T } from '@/lib/ios-tokens';
import { syncUserAccess } from '@/hooks/useUserTeams';

export function IOSApp() {
  const [activeTab, setActiveTab] = useState(0);

  // One-shot sync of team/club access on mount.
  useEffect(() => {
    syncUserAccess();
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: T.bg,
      fontFamily: T.font,
      WebkitFontSmoothing: 'antialiased' as React.CSSProperties['WebkitFontSmoothing'],
      overflow: 'hidden',
      position: 'relative',
    }}>
      {activeTab === 0 && <HomeScreen    onTabChange={setActiveTab} />}
      {activeTab === 1 && <SquadScreen   onTabChange={setActiveTab} />}
      {activeTab === 2 && <MatchesScreen onTabChange={setActiveTab} />}
      {activeTab === 3 && <UltraScreen   onTabChange={setActiveTab} />}
      {activeTab === 4 && <ProfileScreen onTabChange={setActiveTab} />}
    </div>
  );
}
