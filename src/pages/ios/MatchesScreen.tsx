import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glass } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { supabase } from '@/integrations/supabase/client';

interface MatchRow {
  id: string;
  title: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  match_date: string | null;
  status: string;
  is_home: boolean | null;
}

interface MatchesScreenProps {
  onTabChange?: (tab: number) => void;
}

export function MatchesScreen({ onTabChange }: MatchesScreenProps) {
  const navigate = useNavigate();
  const { activeTeam } = useActiveTeam();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from('matches')
        .select('id, title, home_team, away_team, home_score, away_score, match_date, status, is_home')
        .order('match_date', { ascending: false, nullsFirst: false })
        .limit(20);
      if (activeTeam) q = q.eq('team_id', activeTeam.id);
      const { data } = await q;
      setMatches(data || []);
      setLoading(false);
    })();
  }, [activeTeam]);

  const formatDate = (d: string | null) => {
    if (!d) return 'TBC';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.dawn, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ ...tType('footnote'), color: T.fg2, marginBottom: 2 }}>
          {activeTeam?.name || 'All teams'} · {matches.length} match{matches.length === 1 ? '' : 'es'}
        </div>
        <div style={{ ...tType('largeTitle'), color: T.fg }}>Matches</div>
      </div>

      <div style={{ height: 'calc(100% - 44px - 12px - 72px - 100px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Match Day Setup banner */}
        <div style={{ padding: '0 16px 16px' }}>
          <Glass r={22} tint="purple" onClick={() => navigate('/matches')}>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `linear-gradient(135deg, ${T.purple[400]}, ${T.magenta})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.2"/>
                  <circle cx="12" cy="12" r="3.5" fill="#fff"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...tType('headline'), color: T.fg }}>Match Day Setup</div>
                <div style={{ ...tType('footnote'), color: T.fg2, marginTop: 2 }}>Cameras · GPS · live tracking</div>
              </div>
              <svg width="10" height="16" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.fg} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </Glass>
        </div>

        <SectionHeader title="Recent & Upcoming" />

        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center', ...tType('subhead'), color: T.fg2 }}>Loading…</div>
        )}
        {!loading && matches.length === 0 && (
          <div style={{ padding: '20px 16px' }}>
            <Glass r={20}>
              <div style={{ padding: 20, textAlign: 'center', ...tType('subhead'), color: T.fg2 }}>
                No matches yet — tap Match Day Setup to create one.
              </div>
            </Glass>
          </div>
        )}

        {matches.map((m) => {
          const isLive = m.status === 'live' || m.status === 'recording';
          const isFinished = m.status === 'completed' || (m.home_score != null && m.away_score != null);
          const score = isFinished ? `${m.home_score ?? 0}-${m.away_score ?? 0}` : 'vs';
          const ourScore = m.is_home ? m.home_score : m.away_score;
          const theirScore = m.is_home ? m.away_score : m.home_score;
          const win = isFinished && ourScore != null && theirScore != null && ourScore > theirScore;
          const draw = isFinished && ourScore != null && theirScore != null && ourScore === theirScore;

          return (
            <div key={m.id} style={{ padding: '0 16px 12px' }}>
              <Glass r={22} tint={isLive ? 'magenta' : 'neutral'} onClick={() => navigate(`/matches/${m.id}`)}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ ...tType('caption1'), color: T.fg2 }}>{formatDate(m.match_date)}</div>
                    {isLive ? (
                      <Glass r={8} tint="magenta" style={{ padding: '3px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: 3, background: T.red }} />
                          <div style={{ ...tType('caption2'), color: T.fg, fontWeight: 700 }}>LIVE</div>
                        </div>
                      </Glass>
                    ) : isFinished ? (
                      <div style={{ ...tType('caption1'), color: win ? T.green : draw ? T.fg2 : T.red, fontWeight: 700 }}>
                        {win ? 'WIN' : draw ? 'DRAW' : 'LOSS'}
                      </div>
                    ) : (
                      <div style={{ ...tType('caption1'), color: T.fg2, textTransform: 'uppercase' }}>{m.status}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...tType('headline'), color: T.fg }}>{m.home_team || activeTeam?.name || 'Home'}</div>
                      <div style={{ ...tType('footnote'), color: T.fg2 }}>Home</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0 16px' }}>
                      <div style={{ ...tType('title2'), color: T.fg }}>{score}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ ...tType('headline'), color: T.fg }}>{m.away_team || 'Opponent'}</div>
                      <div style={{ ...tType('footnote'), color: T.fg2 }}>Away</div>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${T.hairline}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ ...tType('caption1'), color: T.purple[300], fontWeight: 600 }}>Setup recording</div>
                    <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.purple[300]} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </Glass>
            </div>
          );
        })}
        <div style={{ height: 24 }} />
      </div>

      <TabBar active={2} onChange={onTabChange} />
    </div>
  );
}
