import React, { useState } from 'react';
import { Glass } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Segmented } from '@/components/ios/Segmented';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { BarChart } from '@/components/ios/BarChart';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';

function CalendarScreen({ onTabChange }: { onTabChange?: (t: number) => void }) {
  const days = ['M','T','W','T','F','S','S'];
  const today = 19;
  const monthDays = Array.from({ length: 30 }, (_, i) => i + 1);
  const events = [
    { date: 19, label: 'Training Session', time: '16:00', type: 'training' },
    { date: 21, label: 'Availability check due', time: '10:00', type: 'admin' },
    { date: 26, label: 'vs City Juniors', time: '11:00', type: 'match' },
    { date: 28, label: 'Recovery session', time: '15:30', type: 'training' },
  ];
  const typeColor = (t: string) => t === 'match' ? T.purple[500] : t === 'training' ? T.cyan : T.magenta;

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.aurora, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ ...tType('footnote'), color: T.fg2, marginBottom: 2 }}>April 2026</div>
        <div style={{ ...tType('largeTitle'), color: T.fg }}>Calendar</div>
      </div>

      <div style={{ height: 'calc(100% - 44px - 12px - 72px - 100px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Mini calendar */}
        <div style={{ padding: '0 16px 16px' }}>
          <Glass r={22}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
                {days.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', ...tType('caption1'), color: T.fg3, fontWeight: 600 }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {/* Apr 2026 starts on Wednesday (offset 2) */}
                {Array.from({ length: 2 }).map((_, i) => <div key={`e${i}`} />)}
                {monthDays.map(day => {
                  const isToday = day === today;
                  const hasEvent = events.some(e => e.date === day);
                  return (
                    <div key={day} style={{ textAlign: 'center', position: 'relative' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 16, margin: '0 auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isToday ? T.purple[500] : 'transparent',
                        ...tType('subhead'), color: isToday ? '#fff' : T.fg, fontWeight: isToday ? 700 : 400,
                      }}>{day}</div>
                      {hasEvent && !isToday && (
                        <div style={{ width: 4, height: 4, borderRadius: 2, background: T.purple[400], margin: '2px auto 0' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Glass>
        </div>

        {/* Upcoming agenda */}
        <SectionHeader title="Upcoming" />
        <div style={{ padding: '4px 16px 40px' }}>
          <Glass r={22}>
            {events.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i < events.length - 1 ? `0.5px solid ${T.hairline}` : 'none' }}>
                <div style={{ width: 4, borderRadius: 2, alignSelf: 'stretch', background: typeColor(ev.type) }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...tType('headline'), color: T.fg }}>{ev.label}</div>
                  <div style={{ ...tType('footnote'), color: T.fg2, marginTop: 2 }}>Apr {ev.date} · {ev.time}</div>
                </div>
                <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.fg3} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ))}
          </Glass>
        </div>
      </div>
      <TabBar active={3} onChange={onTabChange} />
    </div>
  );
}

interface TrainingScreenProps {
  onTabChange?: (tab: number) => void;
}

export function TrainingScreen({ onTabChange }: TrainingScreenProps) {
  const [tab, setTab] = useState(0);

  if (tab === 1) return <CalendarScreen onTabChange={onTabChange} />;

  const weekLoad = [420, 380, 510, 460, 490, 395, 430];
  const weekLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const sessions = [
    { label: 'Tactical shape — 4-3-3', time: 'Tomorrow · 16:00', intensity: 'Medium', tag: 'TACTIC' },
    { label: 'High-intensity intervals', time: 'Wed · 16:00', intensity: 'High', tag: 'FITNESS' },
    { label: 'Set piece rehearsal', time: 'Fri · 15:30', intensity: 'Low', tag: 'SET PIECE' },
  ];
  const intensityColor = (i: string) => i === 'High' ? T.red : i === 'Medium' ? T.magenta : T.green;

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.aurora, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />
      <div style={{ padding: '8px 20px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...tType('footnote'), color: T.fg2, marginBottom: 2 }}>Week 16 of 38</div>
          <div style={{ ...tType('largeTitle'), color: T.fg }}>Training</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab(1)} style={{
            ...tType('subhead'), color: T.purple[300], fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
          }}>Calendar</button>
        </div>
      </div>

      <div style={{ height: 'calc(100% - 44px - 12px - 72px - 100px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Weekly load */}
        <SectionHeader title="Weekly Load" action="A:C Ratio" />
        <div style={{ padding: '4px 16px 16px' }}>
          <Glass r={22}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                <div>
                  <div style={{ ...tType('footnote'), color: T.fg2 }}>Total minutes this week</div>
                  <div style={{ ...tType('title1'), color: T.fg }}>430<span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> min</span></div>
                </div>
                <Glass r={10} style={{ padding: '4px 10px' }} tint="purple">
                  <div style={{ ...tType('caption2'), color: T.purple[200], fontWeight: 700 }}>A:C 1.12</div>
                </Glass>
              </div>
              <BarChart data={weekLoad} labels={weekLabels} color={T.cyan} />
              <div style={{ marginTop: 12, padding: '10px 0 2px', borderTop: `0.5px solid ${T.hairline}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ ...tType('title3'), color: T.fg }}>430</div>
                    <div style={{ ...tType('caption1'), color: T.fg2 }}>Acute</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ ...tType('title3'), color: T.fg }}>383</div>
                    <div style={{ ...tType('caption1'), color: T.fg2 }}>Chronic</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ ...tType('title3'), color: T.green }}>Low</div>
                    <div style={{ ...tType('caption1'), color: T.fg2 }}>Injury risk</div>
                  </div>
                </div>
              </div>
            </div>
          </Glass>
        </div>

        {/* Today's session */}
        <SectionHeader title="Today's Session" />
        <div style={{ padding: '4px 16px 16px' }}>
          <Glass r={22} tint="purple">
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ ...tType('caption1'), color: T.purple[200], letterSpacing: 0.8, textTransform: 'uppercase' }}>Today · 16:00</div>
                  <div style={{ ...tType('title3'), color: T.fg, marginTop: 4 }}>Possession + Press</div>
                </div>
                <Glass r={10} style={{ padding: '4px 10px' }}>
                  <div style={{ ...tType('caption2'), color: T.magenta, fontWeight: 700 }}>HIGH</div>
                </Glass>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['75 min', 'Full squad', 'Pitch A', 'Tactical'].map((tag, i) => (
                  <Glass key={i} r={8} style={{ padding: '3px 10px' }}>
                    <div style={{ ...tType('caption1'), color: T.fg2 }}>{tag}</div>
                  </Glass>
                ))}
              </div>
            </div>
          </Glass>
        </div>

        {/* Upcoming sessions */}
        <SectionHeader title="Upcoming Sessions" />
        <div style={{ padding: '4px 16px 40px' }}>
          <Glass r={22}>
            {sessions.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < sessions.length - 1 ? `0.5px solid ${T.hairline}` : 'none' }}>
                <div style={{
                  padding: '3px 8px', borderRadius: 6,
                  background: `${intensityColor(s.intensity)}20`,
                  border: `0.5px solid ${intensityColor(s.intensity)}60`,
                }}>
                  <div style={{ ...tType('caption2'), color: intensityColor(s.intensity), fontWeight: 700 }}>{s.tag}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...tType('subhead'), color: T.fg }}>{s.label}</div>
                  <div style={{ ...tType('footnote'), color: T.fg2 }}>{s.time}</div>
                </div>
                <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.fg3} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ))}
          </Glass>
        </div>
      </div>

      <TabBar active={3} onChange={onTabChange} />
    </div>
  );
}
