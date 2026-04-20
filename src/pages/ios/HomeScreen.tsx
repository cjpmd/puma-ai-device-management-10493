import React, { useEffect, useState } from 'react';
import { Glass } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Avatar } from '@/components/ios/Avatar';
import { Rings } from '@/components/ios/Rings';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { supabase } from '@/integrations/supabase/client';

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

interface NextEvent {
  title: string;
  date: string;
  start_time: string | null;
  is_home: boolean | null;
  opponent: string | null;
  event_type: string;
}

interface PlayerRow {
  id: string;
  name: string;
  availability: string | null;
  expected_return_date: string | null;
}

interface PastFixture {
  id: string;
  date: string;
  opponent: string | null;
  is_home: boolean | null;
  event_type: string;
  match_id: string | null;
  home_score: number | null;
  away_score: number | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const initialsOf = (name: string) =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export function HomeScreen({ onTabChange }: HomeScreenProps) {
  const { activeTeam, teams, setActiveTeam, loading } = useActiveTeam();
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);
  const [userInitials, setUserInitials] = useState('OS');
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [pastFixtures, setPastFixtures] = useState<PastFixture[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const parts = user.email.split('@')[0];
        setUserInitials(parts.slice(0, 2).toUpperCase());
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeTeam) {
      setNextEvent(null);
      setPlayers([]);
      setPastFixtures([]);
      return;
    }
    const today = new Date().toISOString().split('T')[0];

    (async () => {
      // Next event
      const { data: nextData } = await supabase
        .from('team_events')
        .select('title, date, start_time, is_home, opponent, event_type')
        .eq('team_id', activeTeam.id)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1);
      setNextEvent(nextData?.[0] || null);

      // Squad
      const { data: playersData } = await supabase
        .from('players')
        .select('id, name, availability, expected_return_date')
        .eq('team_id', activeTeam.id);
      setPlayers(playersData || []);

      // Past fixtures
      const { data: pastEvents } = await supabase
        .from('team_events')
        .select('id, date, opponent, is_home, event_type, match_id')
        .eq('team_id', activeTeam.id)
        .lt('date', today)
        .in('event_type', ['match', 'friendly', 'fixture', 'Match', 'Friendly', 'Fixture'])
        .order('date', { ascending: false })
        .limit(5);

      const matchIds = (pastEvents || []).map(e => e.match_id).filter(Boolean) as string[];
      let scoreMap: Record<string, { home: number | null; away: number | null }> = {};
      if (matchIds.length) {
        const { data: matches } = await supabase
          .from('matches')
          .select('id, home_score, away_score')
          .in('id', matchIds);
        (matches || []).forEach(m => {
          scoreMap[m.id] = { home: m.home_score, away: m.away_score };
        });
      }

      setPastFixtures((pastEvents || []).map(e => ({
        id: e.id,
        date: e.date,
        opponent: e.opponent,
        is_home: e.is_home,
        event_type: e.event_type,
        match_id: e.match_id,
        home_score: e.match_id ? scoreMap[e.match_id]?.home ?? null : null,
        away_score: e.match_id ? scoreMap[e.match_id]?.away ?? null : null,
      })));
    })();
  }, [activeTeam]);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const teamName = activeTeam?.name || (loading ? '…' : 'No team linked');
  const teamInitials = (activeTeam?.name || 'OS').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const daysUntil = nextEvent ? Math.max(0, Math.ceil((new Date(nextEvent.date).getTime() - Date.now()) / 86400000)) : null;
  const opponentInitials = nextEvent?.opponent
    ? nextEvent.opponent.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const totalCount = players.length;
  const availableCount = players.filter(p => p.availability === 'green').length;
  const injuredPlayers = players.filter(p => p.availability === 'red' || p.availability === 'amber');

  const fixtureResult = (f: PastFixture): { label: string; bg: string; outcome: 'W' | 'D' | 'L' | '—' } => {
    if (f.home_score == null || f.away_score == null) {
      return { label: '—', bg: 'rgba(255,255,255,0.10)', outcome: '—' };
    }
    const ourScore = f.is_home ? f.home_score : f.away_score;
    const theirScore = f.is_home ? f.away_score : f.home_score;
    const outcome: 'W' | 'D' | 'L' = ourScore > theirScore ? 'W' : ourScore === theirScore ? 'D' : 'L';
    const bg = outcome === 'W' ? T.purple[500] : outcome === 'D' ? 'rgba(255,255,255,0.16)' : `${T.red}99`;
    return { label: `${ourScore}–${theirScore} ${outcome}`, bg, outcome };
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.dawn, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />

      {/* Header */}
      <div style={{ padding: '8px 20px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...tType('footnote'), color: T.fg2, marginBottom: 2 }}>{today}</div>
          {teams.length > 1 ? (
            <button
              onClick={() => setShowTeamPicker(true)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '0.5px solid rgba(255,255,255,0.16)',
                borderRadius: 14,
                padding: '6px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: T.fg,
                ...tType('title2'),
                maxWidth: '100%',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamName}</span>
              <span style={{ fontSize: 14, opacity: 0.6 }}>▾</span>
            </button>
          ) : (
            <div style={{ ...tType('largeTitle'), color: T.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamName}</div>
          )}
        </div>
        <div onClick={() => onTabChange?.(4)} style={{ cursor: 'pointer', marginLeft: 12 }}>
          <Avatar initials={userInitials} size={38} hue={310} />
        </div>
      </div>

      <div style={{ height: 'calc(100% - 44px - 12px - 72px - 100px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {/* Hero: next match */}
        <div style={{ padding: '8px 16px 20px' }}>
          <Glass r={28} tint="purple" intensity={1.1} style={{ height: 196 }}>
            <div style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ ...tType('caption1'), color: T.purple[200], letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                    {nextEvent ? `Next ${nextEvent.event_type}` : 'No upcoming events'}
                  </div>
                  <div style={{ ...tType('title2'), color: T.fg }}>
                    {nextEvent?.title || teamName}
                  </div>
                </div>
                {daysUntil != null && (
                  <Glass r={10} style={{ padding: '4px 10px' }}>
                    <div style={{ ...tType('caption1'), color: T.fg, fontWeight: 600 }}>
                      {daysUntil === 0 ? 'TODAY' : `${daysUntil} DAY${daysUntil > 1 ? 'S' : ''}`}
                    </div>
                  </Glass>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <Avatar initials={teamInitials} size={52} hue={295} />
                  <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, marginTop: 8 }}>{teamName}</div>
                  <div style={{ ...tType('caption1'), color: T.fg2 }}>
                    {nextEvent?.is_home ? 'Home' : 'Away'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...tType('title1'), color: T.fg, fontWeight: 300 }}>vs</div>
                  <div style={{ ...tType('caption1'), color: T.fg2, fontWeight: 600 }}>
                    {nextEvent?.start_time?.slice(0, 5) || '—'}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <Avatar initials={opponentInitials} size={52} hue={25} />
                  <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, marginTop: 8 }}>
                    {nextEvent?.opponent || 'TBC'}
                  </div>
                  <div style={{ ...tType('caption1'), color: T.fg2 }}>
                    {nextEvent?.is_home ? 'Away' : 'Home'}
                  </div>
                </div>
              </div>
            </div>
          </Glass>
        </div>

        {/* Squad summary */}
        <SectionHeader title="Squad" action="View all" />
        <div style={{ padding: '4px 16px 20px' }}>
          <Glass r={22} onClick={() => onTabChange?.(1)}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: injuredPlayers.length ? 14 : 0 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
                  <div style={{ ...tType('title2'), color: T.fg }}>{totalCount}</div>
                  <div style={{ ...tType('caption2'), color: T.fg2, marginTop: 2 }}>Total</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: 'rgba(52,211,153,0.12)', borderRadius: 12 }}>
                  <div style={{ ...tType('title2'), color: T.green }}>{availableCount}</div>
                  <div style={{ ...tType('caption2'), color: T.fg2, marginTop: 2 }}>Available</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: 'rgba(248,113,113,0.12)', borderRadius: 12 }}>
                  <div style={{ ...tType('title2'), color: T.red }}>{injuredPlayers.length}</div>
                  <div style={{ ...tType('caption2'), color: T.fg2, marginTop: 2 }}>Injured</div>
                </div>
              </div>

              {injuredPlayers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {injuredPlayers.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar initials={initialsOf(p.name)} size={32} hue={p.availability === 'red' ? 0 : 30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        {p.expected_return_date && (
                          <div style={{ ...tType('caption2'), color: T.fg2 }}>
                            Back ~{fmtDate(p.expected_return_date)}
                          </div>
                        )}
                      </div>
                      <div style={{
                        ...tType('caption2'),
                        color: T.fg,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: p.availability === 'red' ? `${T.red}99` : 'rgba(251,191,36,0.4)',
                        textTransform: 'uppercase',
                      }}>
                        {p.availability}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {totalCount === 0 && (
                <div style={{ ...tType('footnote'), color: T.fg2, textAlign: 'center', padding: '8px 0' }}>
                  No players for this team yet
                </div>
              )}
            </div>
          </Glass>
        </div>

        {/* Activity rings (mock) */}
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

        {/* Previous fixtures */}
        <SectionHeader title="Previous Fixtures" action={pastFixtures.length ? `Last ${pastFixtures.length}` : undefined} />
        <div style={{ padding: '4px 16px 20px' }}>
          <Glass r={22}>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pastFixtures.length === 0 && (
                <div style={{ ...tType('footnote'), color: T.fg2, textAlign: 'center', padding: '12px 0' }}>
                  No previous fixtures
                </div>
              )}
              {pastFixtures.map(f => {
                const r = fixtureResult(f);
                return (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 8px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 10,
                  }}>
                    <div style={{ width: 44, textAlign: 'center' }}>
                      <div style={{ ...tType('caption2'), color: T.fg2, textTransform: 'uppercase' }}>
                        {new Date(f.date).toLocaleDateString('en-GB', { month: 'short' })}
                      </div>
                      <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 700 }}>
                        {new Date(f.date).getDate()}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.opponent || 'TBC'}
                      </div>
                      <div style={{ ...tType('caption2'), color: T.fg2 }}>
                        {f.is_home ? 'Home' : 'Away'} · {f.event_type}
                      </div>
                    </div>
                    <div style={{
                      ...tType('caption1'),
                      color: T.fg,
                      fontWeight: 700,
                      padding: '5px 10px',
                      borderRadius: 8,
                      background: r.bg,
                      minWidth: 56,
                      textAlign: 'center',
                    }}>
                      {r.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </Glass>
        </div>

        {/* Quick actions */}
        <SectionHeader title="Quick Actions" />
        <div style={{ padding: '4px 16px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { t: 'Match Day', s: 'Setup recording', hue: 295, action: () => onTabChange?.(2) },
            { t: 'Squad', s: 'View players', hue: 340, action: () => onTabChange?.(1) },
            { t: 'Ultra', s: 'Live metrics', hue: 270, action: () => onTabChange?.(3) },
            { t: 'Profile', s: 'Teams & devices', hue: 220, action: () => onTabChange?.(4) },
          ].map((a, i) => (
            <Glass key={i} r={20} onClick={a.action}>
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

      {/* Team picker sheet */}
      {showTeamPicker && (
        <div
          onClick={() => setShowTeamPicker(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-end',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', padding: 16 }}>
            <Glass r={24}>
              <div style={{ padding: 16 }}>
                <div style={{ ...tType('caption1'), color: T.fg2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, textAlign: 'center' }}>
                  Switch team
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {teams.map(t => {
                    const isActive = t.id === activeTeam?.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setActiveTeam(t.id); setShowTeamPicker(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 12px', borderRadius: 12,
                          background: isActive ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.04)',
                          border: '0.5px solid ' + (isActive ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.08)'),
                          cursor: 'pointer', textAlign: 'left',
                          color: T.fg,
                        }}
                      >
                        <Avatar initials={initialsOf(t.name)} size={36} hue={295} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                          <div style={{ ...tType('caption2'), color: T.fg2 }}>
                            {t.age_group || ''}{t.age_group && t.role ? ' · ' : ''}{t.role}
                          </div>
                        </div>
                        {isActive && <div style={{ color: T.purple[300], fontSize: 18 }}>✓</div>}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowTeamPicker(false)}
                  style={{
                    width: '100%', marginTop: 12, padding: '12px',
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none', borderRadius: 12,
                    color: T.fg, ...tType('headline'), cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </Glass>
          </div>
        </div>
      )}
    </div>
  );
}
