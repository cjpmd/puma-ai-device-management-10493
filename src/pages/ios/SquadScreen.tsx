import React, { useState } from 'react';
import { Glass, GlassIconBtn } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Avatar } from '@/components/ios/Avatar';
import { Rings } from '@/components/ios/Rings';
import { Sparkline } from '@/components/ios/Sparkline';
import { Radar } from '@/components/ios/Radar';
import { BarChart } from '@/components/ios/BarChart';
import { Segmented } from '@/components/ios/Segmented';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';

const PLAYERS = [
  { g: 'GK',  l: 'Alvarez, D', n: 1,  form: 82, hue: 200 },
  { g: 'DEF', l: 'Brooks, M',  n: 3,  form: 71, hue: 220 },
  { g: 'DEF', l: 'Carter, J',  n: 4,  form: 88, hue: 240 },
  { g: 'DEF', l: 'Doyle, R',   n: 5,  form: 64, hue: 260 },
  { g: 'DEF', l: 'Eze, K',     n: 2,  form: 79, hue: 280 },
  { g: 'MID', l: 'Finch, A',   n: 6,  form: 91, hue: 295 },
  { g: 'MID', l: 'Grant, B',   n: 8,  form: 77, hue: 300 },
  { g: 'MID', l: 'Hall, T',    n: 10, form: 94, hue: 310 },
  { g: 'FWD', l: 'Ives, O',    n: 9,  form: 86, hue: 330 },
  { g: 'FWD', l: 'Jones, P',   n: 11, form: 73, hue: 340 },
  { g: 'FWD', l: 'Khan, S',    n: 7,  form: 68, hue: 350 },
];

const GROUP_LABELS: Record<string, string> = {
  GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards',
};

function LegendDot({ color, label, sub }: { color: string; label: string; sub: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 9, height: 9, borderRadius: 5, background: color }} />
        <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600 }}>{label}</div>
      </div>
      <div style={{ ...tType('caption1'), color: T.fg2, marginLeft: 15 }}>{sub}</div>
    </div>
  );
}

function KPICard({ label, value, unit, delta, spark, color }: { label: string; value: string; unit?: string; delta: string; spark: number[]; color?: string }) {
  const c = color || T.purple[300];
  return (
    <Glass r={18}>
      <div style={{ padding: 14 }}>
        <div style={{ ...tType('footnote'), color: T.fg2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
          <div style={{ ...tType('title1'), color: T.fg }}>{value}</div>
          {unit && <div style={{ ...tType('subhead'), color: T.fg2 }}>{unit}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ ...tType('caption1'), color: T.green, fontWeight: 600 }}>{delta}</div>
          <Sparkline data={spark} width={70} height={22} color={c} fill={false} />
        </div>
      </div>
    </Glass>
  );
}

function PlayerDetailScreen({ player, onBack, onTabChange }: { player: typeof PLAYERS[0]; onBack: () => void; onTabChange?: (t: number) => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.aurora, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 4px', position: 'relative', zIndex: 5 }}>
        <GlassIconBtn>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" onClick={onBack}>
            <path d="M10 2L2 10l8 8" stroke={T.fg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </GlassIconBtn>
        <div style={{ display: 'flex', gap: 8 }}>
          <GlassIconBtn>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 21s-8-5-8-11a5 5 0 018-4 5 5 0 018 4c0 6-8 11-8 11z" stroke={T.fg} strokeWidth="2" strokeLinejoin="round"/></svg>
          </GlassIconBtn>
          <GlassIconBtn>
            <svg width="22" height="6" viewBox="0 0 22 6"><circle cx="3" cy="3" r="2.5" fill={T.fg}/><circle cx="11" cy="3" r="2.5" fill={T.fg}/><circle cx="19" cy="3" r="2.5" fill={T.fg}/></svg>
          </GlassIconBtn>
        </div>
      </div>

      <div style={{ height: 'calc(100% - 44px - 52px - 52px - 100px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {/* Hero */}
        <div style={{ padding: '8px 20px 20px', textAlign: 'center' }}>
          <Avatar initials={player.l.substring(0, 2).toUpperCase()} size={100} hue={player.hue} ring={T.purple[400]} />
          <div style={{ ...tType('title1'), color: T.fg, marginTop: 12 }}>{player.l}</div>
          <div style={{ ...tType('subhead'), color: T.fg2 }}>#{player.n} · Midfielder · 14 y/o</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
            <Glass r={14} style={{ padding: '6px 14px' }}>
              <div style={{ ...tType('footnote'), color: T.fg, fontWeight: 600 }}>Captain</div>
            </Glass>
            <Glass r={14} style={{ padding: '6px 14px' }} tint="purple">
              <div style={{ ...tType('footnote'), color: T.fg, fontWeight: 600 }}>Form {player.form}</div>
            </Glass>
          </div>
        </div>

        {/* Rings */}
        <div style={{ padding: '0 16px 16px' }}>
          <Glass r={26}>
            <div style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
              <Rings size={120} stroke={11} rings={[
                { value: 0.92, color: T.purple[400] },
                { value: 0.81, color: T.magenta },
                { value: 0.74, color: T.cyan },
              ]} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { color: T.purple[400], label: 'Minutes', value: '1,284', unit: '/ 1,400' },
                  { color: T.magenta, label: 'Goals + Assists', value: '19', unit: '/ season' },
                  { color: T.cyan, label: 'Pass accuracy', value: '87%', unit: 'avg' },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: s.color }} />
                      <div style={{ ...tType('footnote'), color: T.fg2 }}>{s.label}</div>
                    </div>
                    <div style={{ ...tType('title3'), color: T.fg, marginTop: 2 }}>
                      {s.value} <span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}>{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Glass>
        </div>

        {/* KPI grid */}
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KPICard label="Goals" value="11" delta="+3" spark={[1,0,2,1,3,2,2]} />
          <KPICard label="Assists" value="8" delta="+2" spark={[0,1,1,2,1,2,1]} />
          <KPICard label="Tackles won" value="48" delta="+6" spark={[3,5,4,6,5,7,8]} color={T.cyan} />
          <KPICard label="Distance" value="9.4" unit="km" delta="+0.3" spark={[7,8,8,9,9,10,9]} color={T.magenta} />
        </div>

        {/* Bar chart */}
        <SectionHeader title="Minutes" action="12 weeks" />
        <div style={{ padding: '4px 16px 16px' }}>
          <Glass r={22}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                <div>
                  <div style={{ ...tType('footnote'), color: T.fg2 }}>Avg per match</div>
                  <div style={{ ...tType('title1'), color: T.fg }}>74<span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> min</span></div>
                </div>
                <Segmented options={['7D','1M','3M','S']} active={2} />
              </div>
              <BarChart data={[62,70,75,68,80,72,78,85,70,82,74,80]} labels={['W14','','W16','','W18','','W20','','W22','','W24','']} />
            </div>
          </Glass>
        </div>

        {/* Radar compare */}
        <SectionHeader title="Compare" action="vs. Squad avg" />
        <div style={{ padding: '4px 16px 16px' }}>
          <Glass r={22}>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <Radar size={190} axes={['Pace','Finish','Pass','Tackle','Vision','Stamina']}
                series={[
                  { values: [0.82, 0.75, 0.92, 0.65, 0.88, 0.80], color: T.purple[300] },
                  { values: [0.66, 0.60, 0.70, 0.62, 0.64, 0.72], color: T.magenta },
                ]} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <LegendDot color={T.purple[300]} label={player.l.split(',')[0]} sub="This season" />
                <LegendDot color={T.magenta} label="Squad avg" sub="Midfielders" />
                <div style={{ ...tType('caption1'), color: T.fg2, lineHeight: 1.4, maxWidth: 110 }}>Passing + vision top decile</div>
              </div>
            </div>
          </Glass>
        </div>
        <div style={{ height: 24 }} />
      </div>
      <TabBar active={1} onChange={onTabChange} />
    </div>
  );
}

interface SquadScreenProps {
  onTabChange?: (tab: number) => void;
}

export function SquadScreen({ onTabChange }: SquadScreenProps) {
  const [selected, setSelected] = useState<typeof PLAYERS[0] | null>(null);

  if (selected) {
    return <PlayerDetailScreen player={selected} onBack={() => setSelected(null)} onTabChange={onTabChange} />;
  }

  const grouped: Record<string, typeof PLAYERS> = { GK: [], DEF: [], MID: [], FWD: [] };
  PLAYERS.forEach(p => grouped[p.g].push(p));

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.twilight, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ ...tType('footnote'), color: T.fg2, marginBottom: 2 }}>Origin U15 · 22 players</div>
        <div style={{ ...tType('largeTitle'), color: T.fg }}>Squad</div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '6px 16px 14px' }}>
        <Glass r={14} style={{ height: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: 36, gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={T.fg2} strokeWidth="2"/><path d="M16 16l5 5" stroke={T.fg2} strokeWidth="2" strokeLinecap="round"/></svg>
            <div style={{ ...tType('subhead'), color: T.fg2 }}>Search players</div>
          </div>
        </Glass>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <Segmented options={['All', 'Available', 'Injured']} active={0} />
      </div>

      <div style={{ height: 'calc(100% - 44px - 12px - 72px - 54px - 52px - 100px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {Object.entries(grouped).map(([grp, list]) => (
          <div key={grp} style={{ marginBottom: 18 }}>
            <div style={{ padding: '0 32px 6px', ...tType('footnote'), color: T.fg2, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
              {GROUP_LABELS[grp]}
            </div>
            <div style={{ margin: '0 16px' }}>
              <Glass r={20}>
                {list.map((p, i) => (
                  <div key={i} onClick={() => setSelected(p)} style={{
                    display: 'flex', alignItems: 'center', padding: '10px 14px',
                    borderBottom: i < list.length - 1 ? `0.5px solid ${T.hairline}` : 'none',
                    gap: 12, cursor: 'pointer',
                  }}>
                    <Avatar initials={p.l.split(',')[0].slice(0,2).toUpperCase()} size={40} hue={p.hue} />
                    <div style={{ flex: 1 }}>
                      <div style={{ ...tType('headline'), color: T.fg }}>{p.l}</div>
                      <div style={{ ...tType('footnote'), color: T.fg2 }}>#{p.n} · Form {p.form}</div>
                    </div>
                    <div style={{ width: 60 }}>
                      <Sparkline data={[40,60,55,70,65,80,p.form]} width={60} height={22} color={T.purple[300]} fill={false} />
                    </div>
                    <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.fg3} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                ))}
              </Glass>
            </div>
          </div>
        ))}
      </div>
      <TabBar active={1} onChange={onTabChange} />
    </div>
  );
}
