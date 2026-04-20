import React, { useEffect, useState } from 'react';
import { Glass, GlassIconBtn } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Avatar } from '@/components/ios/Avatar';
import { Rings } from '@/components/ios/Rings';
import { Sparkline } from '@/components/ios/Sparkline';
import { Segmented } from '@/components/ios/Segmented';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { AttributeBar } from '@/components/ios/AttributeBar';
import { Radar } from '@/components/ios/Radar';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { supabase } from '@/integrations/supabase/client';

const ATTR_GROUPS: { key: 'technical' | 'mental' | 'physical' | 'goalkeeping'; label: string; fields: { col: string; label: string }[] }[] = [
  {
    key: 'technical', label: 'Technical',
    fields: [
      { col: 'corners', label: 'Corners' }, { col: 'crossing', label: 'Crossing' },
      { col: 'dribbling', label: 'Dribbling' }, { col: 'finishing', label: 'Finishing' },
      { col: 'first_touch', label: 'First Touch' }, { col: 'free_kicks', label: 'Free Kicks' },
      { col: 'heading', label: 'Heading' }, { col: 'long_shots', label: 'Long Shots' },
      { col: 'long_throws', label: 'Long Throws' }, { col: 'marking', label: 'Marking' },
      { col: 'passing', label: 'Passing' }, { col: 'penalties', label: 'Penalties' },
      { col: 'tackling', label: 'Tackling' }, { col: 'technique', label: 'Technique' },
    ],
  },
  {
    key: 'mental', label: 'Mental',
    fields: [
      { col: 'aggression', label: 'Aggression' }, { col: 'anticipation', label: 'Anticipation' },
      { col: 'bravery', label: 'Bravery' }, { col: 'composure', label: 'Composure' },
      { col: 'concentration', label: 'Concentration' }, { col: 'decisions', label: 'Decisions' },
      { col: 'determination', label: 'Determination' }, { col: 'flair', label: 'Flair' },
      { col: 'leadership', label: 'Leadership' }, { col: 'off_the_ball', label: 'Off the Ball' },
      { col: 'positioning', label: 'Positioning' }, { col: 'teamwork', label: 'Teamwork' },
      { col: 'vision', label: 'Vision' }, { col: 'work_rate', label: 'Work Rate' },
    ],
  },
  {
    key: 'physical', label: 'Physical',
    fields: [
      { col: 'acceleration', label: 'Acceleration' }, { col: 'agility', label: 'Agility' },
      { col: 'balance', label: 'Balance' }, { col: 'jumping', label: 'Jumping' },
      { col: 'natural_fitness', label: 'Natural Fitness' }, { col: 'pace', label: 'Pace' },
      { col: 'stamina', label: 'Stamina' }, { col: 'strength', label: 'Strength' },
    ],
  },
  {
    key: 'goalkeeping', label: 'Goalkeeping',
    fields: [
      { col: 'aerial_reach', label: 'Aerial Reach' }, { col: 'command_of_area', label: 'Command of Area' },
      { col: 'communication', label: 'Communication' }, { col: 'cross_handling', label: 'Cross Handling' },
      { col: 'distribution', label: 'Distribution' }, { col: 'eccentricity', label: 'Eccentricity' },
      { col: 'footwork', label: 'Footwork' }, { col: 'handling', label: 'Handling' },
      { col: 'kicking', label: 'Kicking' }, { col: 'one_on_one', label: 'One-on-One' },
      { col: 'punching', label: 'Punching' }, { col: 'reflexes', label: 'Reflexes' },
      { col: 'rushing_out', label: 'Rushing Out' }, { col: 'shot_stopping', label: 'Shot Stopping' },
      { col: 'throwing', label: 'Throwing' },
    ],
  },
];

function groupAvg(attrs: Record<string, number | null> | null, fields: { col: string }[]): number | null {
  if (!attrs) return null;
  const vals = fields.map(f => attrs[f.col]).filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}


interface Player {
  id: string;
  name: string;
  position: string | null;
  squad_number: number | null;
  availability: string | null;
  photo_url: string | null;
  date_of_birth: string | null;
}

const POSITION_GROUP = (pos: string | null): 'GK' | 'DEF' | 'MID' | 'FWD' => {
  const p = (pos || '').toLowerCase();
  if (p.includes('keeper') || p.includes('gk')) return 'GK';
  if (p.includes('back') || p.includes('def')) return 'DEF';
  if (p.includes('mid') || p.includes('cm') || p.includes('dm') || p.includes('am')) return 'MID';
  if (p.includes('forward') || p.includes('strik') || p.includes('wing') || p.includes('fwd')) return 'FWD';
  return 'MID';
};

const GROUP_LABELS: Record<string, string> = {
  GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards',
};

const HUE_FOR_GROUP = (g: string) => g === 'GK' ? 200 : g === 'DEF' ? 240 : g === 'MID' ? 295 : 340;

function PlayerDetailScreen({ player, onBack, onTabChange }: { player: Player; onBack: () => void; onTabChange?: (t: number) => void }) {
  const [physical, setPhysical] = useState<any>(null);
  const [bio, setBio] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [{ data: phys }, { data: bioData }, { data: mov }] = await Promise.all([
        supabase.from('player_physical_data').select('*').eq('player_id', player.id).maybeSingle(),
        supabase.from('biometric_readings').select('*').eq('player_id', player.id).order('timestamp', { ascending: false }).limit(20),
        supabase.from('movement_analytics').select('*').eq('player_id', player.id).order('timestamp', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setPhysical(phys);
      setBio(bioData || []);
      setAnalytics(mov);
    })();
  }, [player.id]);

  const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const group = POSITION_GROUP(player.position);
  const hue = HUE_FOR_GROUP(group);

  const avgHr = bio.length ? Math.round(bio.reduce((a, r) => a + (Number(r.heart_rate) || 0), 0) / bio.length) : null;
  const topSpeed = bio.length ? Math.max(...bio.map(r => Number(r.speed) || 0)) : null;
  const totalDistance = bio.length ? bio.reduce((a, r) => a + (Number(r.distance) || 0), 0) : null;
  const sparkHr = bio.slice(0, 12).reverse().map(r => Number(r.heart_rate) || 140);

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.aurora, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 4px', position: 'relative', zIndex: 5 }}>
        <div onClick={onBack}><GlassIconBtn>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
            <path d="M10 2L2 10l8 8" stroke={T.fg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </GlassIconBtn></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <GlassIconBtn>
            <svg width="22" height="6" viewBox="0 0 22 6"><circle cx="3" cy="3" r="2.5" fill={T.fg}/><circle cx="11" cy="3" r="2.5" fill={T.fg}/><circle cx="19" cy="3" r="2.5" fill={T.fg}/></svg>
          </GlassIconBtn>
        </div>
      </div>

      <div style={{ height: 'calc(100% - 44px - 12px - 52px - 100px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {/* Hero */}
        <div style={{ padding: '8px 20px 20px', textAlign: 'center' }}>
          <Avatar initials={initials} size={100} hue={hue} ring={T.purple[400]} />
          <div style={{ ...tType('title1'), color: T.fg, marginTop: 12 }}>{player.name}</div>
          <div style={{ ...tType('subhead'), color: T.fg2 }}>
            {player.squad_number != null ? `#${player.squad_number} · ` : ''}{player.position || 'Player'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
            <Glass r={14} style={{ padding: '6px 14px' }}>
              <div style={{ ...tType('footnote'), color: T.fg, fontWeight: 600 }}>
                {player.availability || 'Available'}
              </div>
            </Glass>
          </div>
        </div>

        {/* Physical attributes from Origin Sports */}
        <SectionHeader title="Physical Attributes" />
        <div style={{ padding: '4px 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { l: 'Height', v: physical?.height ? `${physical.height}` : '—', u: 'cm' },
            { l: 'Weight', v: physical?.weight ? `${physical.weight}` : '—', u: 'kg' },
            { l: 'Resting HR', v: physical?.resting_heart_rate ? `${physical.resting_heart_rate}` : '—', u: 'bpm' },
            { l: 'Max HR', v: physical?.max_heart_rate ? `${physical.max_heart_rate}` : '—', u: 'bpm' },
          ].map((s, i) => (
            <Glass key={i} r={18}>
              <div style={{ padding: 14 }}>
                <div style={{ ...tType('footnote'), color: T.fg2 }}>{s.l}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                  <div style={{ ...tType('title1'), color: T.fg }}>{s.v}</div>
                  <div style={{ ...tType('subhead'), color: T.fg2 }}>{s.u}</div>
                </div>
              </div>
            </Glass>
          ))}
        </div>

        {/* Biometrics from Ultra */}
        <SectionHeader title="Recent Performance" action="Last session" />
        <div style={{ padding: '4px 16px 16px' }}>
          <Glass r={26}>
            <div style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
              <Rings size={110} stroke={10} rings={[
                { value: Math.min(1, (totalDistance || 0) / 10000), color: T.purple[400] },
                { value: Math.min(1, (topSpeed || 0) / 10), color: T.magenta },
                { value: Math.min(1, (analytics?.sprint_count || 0) / 30), color: T.cyan },
              ]} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ ...tType('footnote'), color: T.fg2 }}>Distance</div>
                  <div style={{ ...tType('title3'), color: T.fg }}>
                    {totalDistance != null ? (totalDistance / 1000).toFixed(2) : '—'}
                    <span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> km</span>
                  </div>
                </div>
                <div>
                  <div style={{ ...tType('footnote'), color: T.fg2 }}>Top speed</div>
                  <div style={{ ...tType('title3'), color: T.fg }}>
                    {topSpeed != null ? topSpeed.toFixed(1) : '—'}
                    <span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> m/s</span>
                  </div>
                </div>
                <div>
                  <div style={{ ...tType('footnote'), color: T.fg2 }}>Sprints</div>
                  <div style={{ ...tType('title3'), color: T.fg }}>
                    {analytics?.sprint_count ?? '—'}
                  </div>
                </div>
              </div>
            </div>
          </Glass>
        </div>

        {/* HR sparkline */}
        <div style={{ padding: '0 16px 40px' }}>
          <Glass r={22}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ ...tType('footnote'), color: T.fg2 }}>Average heart rate</div>
                <div style={{ ...tType('title2'), color: T.fg }}>
                  {avgHr ?? '—'}<span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> bpm</span>
                </div>
              </div>
              {sparkHr.length > 1 && (
                <div style={{ marginTop: 10 }}>
                  <Sparkline data={sparkHr} width={340} height={56} color={T.magenta} />
                </div>
              )}
              {sparkHr.length <= 1 && (
                <div style={{ ...tType('footnote'), color: T.fg3, marginTop: 8 }}>No biometric readings yet</div>
              )}
            </div>
          </Glass>
        </div>
      </div>
      <TabBar active={1} onChange={onTabChange} />
    </div>
  );
}

interface SquadScreenProps {
  onTabChange?: (tab: number) => void;
}

export function SquadScreen({ onTabChange }: SquadScreenProps) {
  const { activeTeam } = useActiveTeam();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Player | null>(null);
  const [filter, setFilter] = useState(0);

  useEffect(() => {
    if (!activeTeam) { setPlayers([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, position, squad_number, availability, photo_url, date_of_birth')
        .eq('team_id', activeTeam.id)
        .order('squad_number', { ascending: true, nullsFirst: false });
      setPlayers(data || []);
      setLoading(false);
    })();
  }, [activeTeam]);

  if (selected) {
    return <PlayerDetailScreen player={selected} onBack={() => setSelected(null)} onTabChange={onTabChange} />;
  }

  const filtered = players.filter(p => {
    if (filter === 1) return (p.availability || 'available').toLowerCase() === 'available';
    if (filter === 2) return ['injured', 'unavailable'].includes((p.availability || '').toLowerCase());
    return true;
  });

  const grouped: Record<string, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  filtered.forEach(p => grouped[POSITION_GROUP(p.position)].push(p));

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.twilight, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ ...tType('footnote'), color: T.fg2, marginBottom: 2 }}>
          {activeTeam?.name || 'Select a team'} · {players.length} player{players.length === 1 ? '' : 's'}
        </div>
        <div style={{ ...tType('largeTitle'), color: T.fg }}>Squad</div>
      </div>

      <div style={{ padding: '6px 16px 14px' }}>
        <Glass r={14} style={{ height: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: 36, gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={T.fg2} strokeWidth="2"/><path d="M16 16l5 5" stroke={T.fg2} strokeWidth="2" strokeLinecap="round"/></svg>
            <div style={{ ...tType('subhead'), color: T.fg2 }}>Search players</div>
          </div>
        </Glass>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <Segmented options={['All', 'Available', 'Injured']} active={filter} onChange={setFilter} />
      </div>

      <div style={{ height: 'calc(100% - 44px - 12px - 72px - 54px - 52px - 100px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center', ...tType('subhead'), color: T.fg2 }}>Loading squad…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', ...tType('subhead'), color: T.fg2 }}>
            {activeTeam ? 'No players synced for this team yet.' : 'No team linked to your account.'}
          </div>
        )}
        {Object.entries(grouped).map(([grp, list]) => list.length > 0 && (
          <div key={grp} style={{ marginBottom: 18 }}>
            <div style={{ padding: '0 32px 6px', ...tType('footnote'), color: T.fg2, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
              {GROUP_LABELS[grp]}
            </div>
            <div style={{ margin: '0 16px' }}>
              <Glass r={20}>
                {list.map((p, i) => {
                  const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={p.id} onClick={() => setSelected(p)} style={{
                      display: 'flex', alignItems: 'center', padding: '10px 14px',
                      borderBottom: i < list.length - 1 ? `0.5px solid ${T.hairline}` : 'none',
                      gap: 12, cursor: 'pointer',
                    }}>
                      <Avatar initials={initials} size={40} hue={HUE_FOR_GROUP(grp)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ ...tType('headline'), color: T.fg }}>{p.name}</div>
                        <div style={{ ...tType('footnote'), color: T.fg2 }}>
                          {p.squad_number != null ? `#${p.squad_number} · ` : ''}{p.position || '—'}
                        </div>
                      </div>
                      <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.fg3} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  );
                })}
              </Glass>
            </div>
          </div>
        ))}
      </div>
      <TabBar active={1} onChange={onTabChange} />
    </div>
  );
}
