import React from 'react';
import { Glass } from './Glass';
import { T, tType } from '@/lib/ios-tokens';

type TabName = 'home' | 'squad' | 'matches' | 'training' | 'profile';

interface TabBarProps {
  active: number;
  onChange?: (index: number) => void;
}

const TABS: { label: string; icon: TabName }[] = [
  { label: 'Home',     icon: 'home' },
  { label: 'Squad',    icon: 'squad' },
  { label: 'Matches',  icon: 'matches' },
  { label: 'Training', icon: 'training' },
  { label: 'Profile',  icon: 'profile' },
];

function TabIcon({ name, active }: { name: TabName; active: boolean }) {
  const c = active ? T.fg : T.fg2;
  const sw = active ? 2.4 : 2.0;
  switch (name) {
    case 'home':
      return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-3v-6H10v6H5a2 2 0 01-2-2v-9z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill={active ? c : 'none'} fillOpacity={active ? 0.15 : 0}/></svg>;
    case 'squad':
      return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.5" stroke={c} strokeWidth={sw} fill={active ? c : 'none'} fillOpacity={active ? 0.2 : 0}/><circle cx="17" cy="9" r="2.8" stroke={c} strokeWidth={sw}/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" stroke={c} strokeWidth={sw} strokeLinecap="round"/><path d="M14.5 20c.5-2.3 2.3-4 4.5-4s3.5 1.2 3.5 3" stroke={c} strokeWidth={sw} strokeLinecap="round"/></svg>;
    case 'matches':
      return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} fill={active ? c : 'none'} fillOpacity={active ? 0.15 : 0}/><path d="M12 3l2 4-2 3-2-3 2-4zM3.5 10l4-1 2 3-1.5 3.5-4-1-.5-4.5zM20.5 10l-4-1-2 3 1.5 3.5 4-1 .5-4.5zM8 20l1.5-3.5h5L16 20l-4 1-4-1z" stroke={c} strokeWidth={1.4} strokeLinejoin="round"/></svg>;
    case 'training':
      return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill={active ? c : 'none'} fillOpacity={active ? 0.2 : 0}/></svg>;
    case 'profile':
      return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth={sw} fill={active ? c : 'none'} fillOpacity={active ? 0.2 : 0}/><path d="M3 21c1-4.5 4.7-7 9-7s8 2.5 9 7" stroke={c} strokeWidth={sw} strokeLinecap="round"/></svg>;
  }
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div style={{ position: 'absolute', bottom: 28, left: 12, right: 12, zIndex: 40 }}>
      <Glass style={{ height: 64 }} r={32} intensity={1.2}>
        <div style={{ display: 'flex', height: 64, alignItems: 'center', justifyContent: 'space-around', padding: '0 8px' }}>
          {TABS.map((tab, i) => (
            <button key={i} onClick={() => onChange?.(i)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, padding: '6px 8px', borderRadius: 18,
              background: i === active ? 'rgba(255,255,255,0.12)' : 'transparent',
              border: 'none', cursor: 'pointer', minWidth: 52,
            }}>
              <TabIcon name={tab.icon as TabName} active={i === active} />
              <span style={{ ...tType('caption2'), color: i === active ? T.fg : T.fg2, fontWeight: i === active ? 600 : 500 }}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </Glass>
    </div>
  );
}
