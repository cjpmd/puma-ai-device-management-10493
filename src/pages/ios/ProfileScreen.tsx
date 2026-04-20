import React from 'react';
import { Glass } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Avatar } from '@/components/ios/Avatar';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';

interface ProfileScreenProps {
  onTabChange?: (tab: number) => void;
}

export function ProfileScreen({ onTabChange }: ProfileScreenProps) {
  const items = [
    { label: 'Account & Team', detail: 'Origin U15' },
    { label: 'Notifications', detail: 'On' },
    { label: 'Wearable Devices', detail: '2 connected' },
    { label: 'Export data', detail: '' },
    { label: 'Privacy', detail: '' },
  ];

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
          <Avatar initials="CJ" size={72} hue={310} ring={T.purple[400]} />
          <div>
            <div style={{ ...tType('title2'), color: T.fg }}>Coach Johnson</div>
            <div style={{ ...tType('subhead'), color: T.fg2 }}>Head Coach · Origin U15</div>
            <Glass r={10} style={{ display: 'inline-block', marginTop: 8, padding: '4px 12px' }} tint="purple">
              <div style={{ ...tType('caption1'), color: T.purple[200], fontWeight: 600 }}>Pro Plan</div>
            </Glass>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ padding: '0 16px 20px' }}>
          <Glass r={22}>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {[
                { v: '22', label: 'Players' },
                { v: '14', label: 'Matches' },
                { v: '9W', label: 'Record' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ ...tType('title1'), color: T.fg }}>{s.v}</div>
                  <div style={{ ...tType('caption1'), color: T.fg2, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Glass>
        </div>

        <SectionHeader title="Settings" />
        <div style={{ padding: '0 16px 40px' }}>
          <Glass r={20}>
            {items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', padding: '14px 16px',
                borderBottom: i < items.length - 1 ? `0.5px solid ${T.hairline}` : 'none',
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
      </div>
      <TabBar active={4} onChange={onTabChange} />
    </div>
  );
}
