import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TabBar } from './TabBar';
import { T } from '@/lib/ios-tokens';

interface MobileNavShellProps {
  children: React.ReactNode;
  /** Force a specific tab to appear active. If omitted we infer from the route. */
  activeTab?: number;
  /** Background — defaults to dark to match iOS shell. */
  background?: string;
}

/**
 * Wraps legacy/full-page screens so they keep the iOS bottom TabBar.
 * Tabs map to the iOS shell:
 *  0 Home → /     1 Squad → /     2 Match Day → /matches
 *  3 Ultra → /analysis            4 Profile → /
 *
 * The shell screens (Home/Squad/Profile) all live behind `/` and are
 * controlled by IOSApp's local activeTab state. We pass the desired tab
 * through navigation state so IOSApp can pick it up.
 */
export function MobileNavShell({ children, activeTab, background }: MobileNavShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const inferredTab = (() => {
    const p = location.pathname;
    if (p.startsWith('/analysis')) return 3;
    if (p.startsWith('/matches')) return 2;
    if (p.startsWith('/devices')) return 4;
    if (p.startsWith('/ml-training')) return 4;
    if (p.startsWith('/pitch-calibration')) return 4;
    return 0;
  })();

  const active = activeTab ?? inferredTab;

  const handleTabChange = (index: number) => {
    switch (index) {
      case 0: navigate('/', { state: { initialTab: 0 } }); break;
      case 1: navigate('/', { state: { initialTab: 1 } }); break;
      case 2: navigate('/matches'); break;
      case 3: navigate('/analysis'); break;
      case 4: navigate('/', { state: { initialTab: 4 } }); break;
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: background || T.bg }}>
      <div style={{ paddingBottom: 110 }}>
        {children}
      </div>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100, pointerEvents: 'none' }}>
        <div style={{ position: 'relative', height: 100, pointerEvents: 'auto' }}>
          <TabBar active={active} onChange={handleTabChange} />
        </div>
      </div>
    </div>
  );
}
