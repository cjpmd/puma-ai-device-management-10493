import React from 'react';
import { Glass, GlassIconBtn } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Avatar } from '@/components/ios/Avatar';
import { Rings } from '@/components/ios/Rings';
import { Sparkline } from '@/components/ios/Sparkline';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';

function RingStat({ color, label, value, unit }: { color: string; label: string; value: string; unit: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: color }}/>
        <div style={{ ...tType('footnote'), color: T.fg2 }}>{label}</div>
      </div>
      <div style={{ ...tType('title3'), color: T.fg, marginTop: 2 }}>
        {value} <span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}>{unit}</span>
      </div>
    </div>
  );
}

interface HomeScreenProps {
  onTabChange?: (tab: number) => void;
}

export function HomeScreen({ onTabChange }: HomeScreenProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.dawn, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      {/* Dynamic Island spacer */}
      <div style={{ height: 4 }} />

      {/* Header */}
      <div style={{ padding: '8px 20px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...tType('footnote'), color: T.fg2, marginBottom: 2 }}>Sunday, 19 April</div>
          <div style={{ ...tType('largeTitle'), color: T.fg }}>Home</div>
        </div>
        <Avatar initials="CJ" size={38} hue={310} />
      </div>

      {/* Scrollable content */}
      <div style={{ height: 'calc(100% - 44px - 12px - 72px - 100px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {/* Hero: next match */}
        <div style={{ padding: '8px 16px 20px' }}>
          <Glass r={28} tint="purple" intensity={1.1} style={{ height: 196 }}>
            <div style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ ...tType('caption1'), color: T.purple[200], letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Next Match · Saturday</div>
                  <div style={{ ...tType('title2'), color: T.fg }}>League Cup · Semi</div>
                </div>
                <Glass r={10} style={{ padding: '4px 10px' }}>
                  <div style={{ ...tType('caption1'), color: T.fg, fontWeight: 600 }}>3 DAYS</div>
                </Glass>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <Avatar initials="OR" size={52} hue={295} />
                  <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, marginTop: 8 }}>Origin U15</div>
                  <div style={{ ...tType('caption1'), color: T.fg2 }}>Home · 6W 1D</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...tType('title1'), color: T.fg, fontWeight: 300 }}>vs</div>
                  <div style={{ ...tType('caption1'), color: T.fg2, fontWeight: 600 }}>14:00</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <Avatar initials="NR" size={52} hue={25} />
                  <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, marginTop: 8 }}>Northrow FC</div>
                  <div style={{ ...tType('caption1'), color: T.fg2 }}>Away · 5W 2D</div>
                </div>
              </div>
            </div>
          </Glass>
        </div>

        {/* Activity rings */}
        <SectionHeader title="Today" action="Details" />
        <div style={{ padding: '4px 16px 20px' }}>
          <Glass r={26}>
            <div style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
              <Rings size={120} stroke={11} rings={[
                { value: 0.78, color: T.purple[400] },
                { value: 0.64, color: T.magenta },
                { value: 0.92, color: T.cyan },
              ]} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <RingStat color={T.purple[400]} label="Minutes" value="58" unit="/ 75" />
                <RingStat color={T.magenta} label="Distance" value="6.4" unit="km / 10" />
                <RingStat color={T.cyan} label="Sprint load" value="92" unit="/ 100" />
              </div>
            </div>
          </Glass>
        </div>

        {/* Team form */}
        <SectionHeader title="Team Form" action="Season" />
        <div style={{ padding: '4px 16px 20px' }}>
          <Glass r={22}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                  <div style={{ ...tType('footnote'), color: T.fg2 }}>Goals per match · last 10</div>
                  <div style={{ ...tType('title1'), color: T.fg, marginTop: 2 }}>2.4<span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> avg</span></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...tType('footnote'), color: T.green, fontWeight: 600 }}>↑ 18%</div>
                  <div style={{ ...tType('caption2'), color: T.fg2 }}>vs last month</div>
                </div>
              </div>
              <Sparkline data={[1, 2, 1, 3, 2, 2, 3, 1, 4, 3]} width={340} height={56} color={T.purple[300]} />
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                {['W','W','D','W','L','W','W','D','W','W'].map((r, i) => (
                  <div key={i} style={{
                    flex: 1, height: 22, borderRadius: 5,
                    background: r === 'W' ? T.purple[500] : r === 'D' ? 'rgba(255,255,255,0.16)' : `${T.red}99`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...tType('caption2'), color: T.fg, fontWeight: 700,
                  }}>{r}</div>
                ))}
              </div>
            </div>
          </Glass>
        </div>

        {/* Quick actions */}
        <SectionHeader title="Quick Actions" />
        <div style={{ padding: '4px 16px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { t: 'Log training', s: 'Minutes + drills', hue: 295 },
            { t: 'Availability', s: '2 pending', hue: 340 },
            { t: 'Squad plan', s: 'Sat · vs NR', hue: 270 },
            { t: 'Messages', s: '3 new', hue: 220 },
          ].map((a, i) => (
            <Glass key={i} r={20}>
              <div style={{ padding: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, marginBottom: 14,
                  background: `linear-gradient(135deg, oklch(0.6 0.18 ${a.hue}), oklch(0.42 0.18 ${a.hue}))`,
                }} />
                <div style={{ ...tType('headline'), color: T.fg }}>{a.t}</div>
                <div style={{ ...tType('footnote'), color: T.fg2, marginTop: 2 }}>{a.s}</div>
              </div>
            </Glass>
          ))}
        </div>
      </div>

      <TabBar active={0} onChange={onTabChange} />
    </div>
  );
}
