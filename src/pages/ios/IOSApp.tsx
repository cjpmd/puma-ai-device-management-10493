import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HomeScreen } from './HomeScreen';
import { SquadScreen } from './SquadScreen';
import { MatchesScreen } from './MatchesScreen';
import { UltraScreen } from './UltraScreen';
import { ProfileScreen } from './ProfileScreen';
import { T } from '@/lib/ios-tokens';
import { syncUserAccess } from '@/hooks/useUserTeams';

export function IOSApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const initial = (location.state as any)?.initialTab;
  const [activeTab, setActiveTab] = useState<number>(typeof initial === 'number' ? initial : 0);

  // If a different page navigated here with state.initialTab, honour it
  useEffect(() => {
    const t = (location.state as any)?.initialTab;
    if (typeof t === 'number' && t !== activeTab) {
      setActiveTab(t);
      // Clear the state so subsequent renders don't keep forcing it
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // The Ultra tab opens the dedicated /analysis page rather than a shell screen.
  useEffect(() => {
    if (activeTab === 3) {
      navigate('/analysis');
    }
  }, [activeTab, navigate]);

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
