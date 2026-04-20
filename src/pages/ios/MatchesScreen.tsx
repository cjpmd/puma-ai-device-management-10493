import React, { useState } from 'react';
import { Glass, GlassIconBtn } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Avatar } from '@/components/ios/Avatar';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';

function BarStat({ label, valueA, valueB, maxVal, colorA, colorB }: {
  label: string; valueA: number; valueB: number; maxVal: number; colorA: string; colorB: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ ...tType('callout'), color: T.fg, fontWeight: 600 }}>{valueA}</span>
        <span style={{ ...tType('footnote'), color: T.fg2 }}>{label}</span>
        <span style={{ ...tType('callout'), color: T.fg, fontWeight: 600 }}>{valueB}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, height: 6 }}>
        <div style={{ flex: 1, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: `${(valueA / maxVal) * 100}%`, background: colorA, borderRadius: 3 }} />
        </div>
        <div style={{ flex: 1, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: `${(valueB / maxVal) * 100}%`, background: colorB, borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}

function LiveMatchScreen({ onBack, onTabChange }: { onBack: () => void; onTabChange?: (t: number) => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.dawn, overflow: 'hidden', fontFamily: T.font }}>
      {/* Pitch background */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 420,
        background: `
          linear-gradient(180deg, rgba(10,5,17,0) 60%, rgba(10,5,17,1) 100%),
          repeating-linear-gradient(180deg, oklch(0.30 0.14 295) 0 36px, oklch(0.26 0.14 295) 36px 72px)
        `,
      }} />
      {/* Pitch lines */}
      <div style={{ position: 'absolute', top: 110, left: '50%', transform: 'translateX(-50%)', width: 210, height: 260, border: '2px solid rgba(255,255,255,0.12)', borderTop: 'none', borderRadius: '0 0 24px 24px' }} />
      <div style={{ position: 'absolute', top: 110, left: '50%', transform: 'translateX(-50%) translateY(-1px)', width: 2, height: 300, background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'absolute', top: 240, left: '50%', transform: 'translate(-50%,-50%)', width: 70, height: 70, border: '2px solid rgba(255,255,255,0.12)', borderRadius: '50%' }} />

      <IOSStatusBar />
      <div style={{ height: 4 }} />

      {/* Floating nav */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px' }}>
        <GlassIconBtn>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" onClick={onBack}>
            <path d="M10 2L2 10l8 8" stroke={T.fg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </GlassIconBtn>
        <Glass r={16} style={{ padding: '6px 12px' }} tint="magenta">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: 4, background: T.red, boxShadow: `0 0 8px ${T.red}` }} />
            <div style={{ ...tType('footnote'), color: T.fg, fontWeight: 700, letterSpacing: 0.5 }}>LIVE · 67'</div>
          </div>
        </Glass>
        <GlassIconBtn>
          <svg width="22" height="6" viewBox="0 0 22 6"><circle cx="3" cy="3" r="2.5" fill={T.fg}/><circle cx="11" cy="3" r="2.5" fill={T.fg}/><circle cx="19" cy="3" r="2.5" fill={T.fg}/></svg>
        </GlassIconBtn>
      </div>

      {/* Scoreboard */}
      <div style={{ padding: '12px 16px 0', position: 'relative', zIndex: 5 }}>
        <Glass r={28} intensity={1.2}>
          <div style={{ padding: '18px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <Avatar initials="OR" size={48} hue={295} />
                <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, marginTop: 8 }}>Origin U15</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0 16px' }}>
                <div style={{ ...tType('largeTitle'), color: T.fg, letterSpacing: -1 }}>2 – 1</div>
                <Glass r={8} tint="purple" style={{ padding: '3px 10px', marginTop: 6, display: 'inline-block' }}>
                  <div style={{ ...tType('caption2'), color: T.purple[200], fontWeight: 700 }}>67 MIN</div>
                </Glass>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <Avatar initials="NR" size={48} hue={25} />
                <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, marginTop: 8 }}>Northrow FC</div>
              </div>
            </div>
          </div>
        </Glass>
      </div>

      {/* Lower content */}
      <div style={{ position: 'absolute', top: 360, left: 0, right: 0, bottom: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* xG */}
        <div style={{ padding: '0 16px 16px' }}>
          <Glass r={22}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ ...tType('footnote'), color: T.fg2 }}>Expected Goals (xG)</div>
                <div style={{ ...tType('caption1'), color: T.fg2 }}>2.1 vs 0.9</div>
              </div>
              <BarStat label="xG" valueA={2.1} valueB={0.9} maxVal={3} colorA={T.purple[400]} colorB={T.magenta} />
              <BarStat label="Shots" valueA={9} valueB={4} maxVal={12} colorA={T.purple[400]} colorB={T.magenta} />
              <BarStat label="Possession %" valueA={62} valueB={38} maxVal={100} colorA={T.purple[400]} colorB={T.magenta} />
            </div>
          </Glass>
        </div>

        {/* Timeline */}
        <SectionHeader title="Timeline" />
        <div style={{ padding: '4px 16px 100px' }}>
          <Glass r={22}>
            <div style={{ padding: 16 }}>
              {[
                { min: "9'",  icon: '⚽', text: 'Hall, T. — Goal', team: 'us' },
                { min: "23'", icon: '🟨', text: 'Brooks, M. — Yellow card', team: 'us' },
                { min: "34'", icon: '⚽', text: 'Richards — Goal', team: 'them' },
                { min: "51'", icon: '⚽', text: 'Khan, S. — Goal', team: 'us' },
                { min: "67'", icon: '🔄', text: 'Ives → Finch, A.', team: 'us' },
              ].map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 4 ? `0.5px solid ${T.hairline}` : 'none' }}>
                  <div style={{ ...tType('caption1'), color: T.fg3, width: 28, flexShrink: 0 }}>{ev.min}</div>
                  <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                    background: ev.team === 'us' ? `${T.purple[500]}40` : 'rgba(255,255,255,0.06)' }}>
                    {ev.icon}
                  </div>
                  <div style={{ ...tType('subhead'), color: T.fg }}>{ev.text}</div>
                </div>
              ))}
            </div>
          </Glass>
        </div>
      </div>

      <TabBar active={2} onChange={onTabChange} />
    </div>
  );
}

function PostMatchScreen({ onBack, onTabChange }: { onBack: () => void; onTabChange?: (t: number) => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.twilight, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 4px', position: 'relative', zIndex: 5 }}>
        <GlassIconBtn>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" onClick={onBack}>
            <path d="M10 2L2 10l8 8" stroke={T.fg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </GlassIconBtn>
        <div style={{ ...tType('headline'), color: T.fg }}>Post-match Insights</div>
        <GlassIconBtn>
          <svg width="22" height="6" viewBox="0 0 22 6"><circle cx="3" cy="3" r="2.5" fill={T.fg}/><circle cx="11" cy="3" r="2.5" fill={T.fg}/><circle cx="19" cy="3" r="2.5" fill={T.fg}/></svg>
        </GlassIconBtn>
      </div>

      <div style={{ height: 'calc(100% - 44px - 52px - 52px - 100px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {/* Result hero */}
        <div style={{ padding: '8px 16px 16px' }}>
          <Glass r={28} tint="purple" intensity={1.1}>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ ...tType('caption1'), color: T.purple[200], letterSpacing: 1, textTransform: 'uppercase' }}>Full Time · League Cup Semi</div>
              <div style={{ ...tType('largeTitle'), color: T.fg, marginTop: 8, letterSpacing: -1 }}>2 – 1</div>
              <div style={{ ...tType('title3'), color: T.fg2, marginTop: 4 }}>Origin U15 vs Northrow FC</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                <Glass r={12} style={{ padding: '6px 16px' }} tint="purple">
                  <div style={{ ...tType('footnote'), color: T.green, fontWeight: 700 }}>WIN</div>
                </Glass>
                <Glass r={12} style={{ padding: '6px 16px' }}>
                  <div style={{ ...tType('footnote'), color: T.fg2 }}>Cup Semi-final</div>
                </Glass>
              </div>
            </div>
          </Glass>
        </div>

        {/* Stats comparison */}
        <SectionHeader title="Match Stats" />
        <div style={{ padding: '4px 16px 16px' }}>
          <Glass r={22}>
            <div style={{ padding: 16 }}>
              {[
                { label: 'Shots', a: 13, b: 7 },
                { label: 'On target', a: 5, b: 3 },
                { label: 'Passes', a: 284, b: 198 },
                { label: 'Corners', a: 6, b: 2 },
                { label: 'Fouls', a: 8, b: 11 },
              ].map((s, i) => (
                <BarStat key={i} label={s.label} valueA={s.a} valueB={s.b} maxVal={Math.max(s.a, s.b) * 1.2} colorA={T.purple[400]} colorB={T.magenta} />
              ))}
            </div>
          </Glass>
        </div>

        {/* Player of the match */}
        <SectionHeader title="Player of the Match" />
        <div style={{ padding: '4px 16px 16px' }}>
          <Glass r={22} tint="purple">
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar initials="TH" size={56} hue={310} ring={T.purple[400]} />
              <div style={{ flex: 1 }}>
                <div style={{ ...tType('title3'), color: T.fg }}>Taylor Hall</div>
                <div style={{ ...tType('subhead'), color: T.fg2 }}>#10 · Midfielder</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {['1 Goal', '2 Assists', '87% Pass'].map((tag, i) => (
                    <Glass key={i} r={8} style={{ padding: '3px 8px' }}>
                      <div style={{ ...tType('caption2'), color: T.purple[200], fontWeight: 600 }}>{tag}</div>
                    </Glass>
                  ))}
                </div>
              </div>
            </div>
          </Glass>
        </div>

        {/* AI insight */}
        <SectionHeader title="AI Coach Insights" />
        <div style={{ padding: '4px 16px 40px' }}>
          <Glass r={22}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${T.purple[500]}, ${T.magenta})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚡</div>
                <div style={{ ...tType('headline'), color: T.fg }}>Key Takeaways</div>
              </div>
              {[
                'High press in first 15 min created 3 chances — continue this approach.',
                'Left flank exploited 7 times. Reinforce defensive shape next match.',
                'Set piece delivery improved by 40% vs last game.',
              ].map((insight, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i > 0 ? `0.5px solid ${T.hairline}` : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: T.purple[400], marginTop: 6, flexShrink: 0 }} />
                  <div style={{ ...tType('subhead'), color: T.fg2, lineHeight: 1.5 }}>{insight}</div>
                </div>
              ))}
            </div>
          </Glass>
        </div>
      </div>

      <TabBar active={2} onChange={onTabChange} />
    </div>
  );
}

interface MatchesScreenProps {
  onTabChange?: (tab: number) => void;
}

export function MatchesScreen({ onTabChange }: MatchesScreenProps) {
  const [view, setView] = useState<'list' | 'live' | 'post'>('list');

  if (view === 'live') return <LiveMatchScreen onBack={() => setView('list')} onTabChange={onTabChange} />;
  if (view === 'post') return <PostMatchScreen onBack={() => setView('list')} onTabChange={onTabChange} />;

  const matches = [
    { date: 'Sat, 19 Apr', home: 'Origin U15', away: 'Northrow FC', time: '14:00', status: 'live' as const, score: '2-1' },
    { date: 'Sat, 12 Apr', home: 'Origin U15', away: 'Westfield', time: 'FT', status: 'result' as const, score: '3-0' },
    { date: 'Sat, 26 Apr', home: 'Origin U15', away: 'City Juniors', time: '11:00', status: 'upcoming' as const },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.dawn, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ ...tType('footnote'), color: T.fg2, marginBottom: 2 }}>Origin U15 · Season 2025/26</div>
        <div style={{ ...tType('largeTitle'), color: T.fg }}>Matches</div>
      </div>

      <div style={{ height: 'calc(100% - 44px - 12px - 72px - 100px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {matches.map((m, i) => (
          <div key={i} style={{ padding: '0 16px 12px' }}>
            <Glass r={22} onClick={() => m.status === 'live' ? setView('live') : m.status === 'result' ? setView('post') : undefined}
              tint={m.status === 'live' ? 'purple' : 'neutral'}>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ ...tType('caption1'), color: T.fg2 }}>{m.date}</div>
                  {m.status === 'live' ? (
                    <Glass r={8} tint="magenta" style={{ padding: '3px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: T.red }} />
                        <div style={{ ...tType('caption2'), color: T.fg, fontWeight: 700 }}>LIVE</div>
                      </div>
                    </Glass>
                  ) : m.status === 'result' ? (
                    <div style={{ ...tType('caption1'), color: T.green, fontWeight: 600 }}>WIN</div>
                  ) : (
                    <div style={{ ...tType('caption1'), color: T.fg2 }}>{m.time}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...tType('headline'), color: T.fg }}>{m.home}</div>
                    <div style={{ ...tType('footnote'), color: T.fg2 }}>Home</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0 16px' }}>
                    <div style={{ ...tType('title2'), color: T.fg }}>{m.score || 'vs'}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ ...tType('headline'), color: T.fg }}>{m.away}</div>
                    <div style={{ ...tType('footnote'), color: T.fg2 }}>Away</div>
                  </div>
                </div>
              </div>
            </Glass>
          </div>
        ))}
      </div>

      <TabBar active={2} onChange={onTabChange} />
    </div>
  );
}
