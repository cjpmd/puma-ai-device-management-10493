import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glass } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Sparkline } from '@/components/ios/Sparkline';
import { Rings } from '@/components/ios/Rings';
import { SectionHeader } from '@/components/ios/SectionHeader';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { supabase } from '@/integrations/supabase/client';

interface UltraScreenProps {
  onTabChange?: (tab: number) => void;
}

export function UltraScreen({ onTabChange }: UltraScreenProps) {
  const { activeTeam } = useActiveTeam();
  const navigate = useNavigate();
  const [deviceCount, setDeviceCount] = useState(0);
  const [recentSpeed, setRecentSpeed] = useState<number | null>(null);
  const [recentDistance, setRecentDistance] = useState<number | null>(null);
  const [recentHr, setRecentHr] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'connected');
      setDeviceCount(count || 0);

      const { data: bio } = await supabase
        .from('biometric_readings')
        .select('speed, distance, heart_rate, timestamp')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (bio && bio.length) {
        const speeds = bio.map(r => Number(r.speed) || 0);
        const dists = bio.map(r => Number(r.distance) || 0);
        const hrs = bio.map(r => Number(r.heart_rate) || 0).filter(h => h > 0);
        setRecentSpeed(Math.max(...speeds));
        setRecentDistance(dists.reduce((a, b) => a + b, 0));
        setRecentHr(hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null);
      }
    })();
  }, []);

  const sparkSpeed = [4.2, 5.1, 6.8, 5.5, 7.2, 6.3, 8.1, 7.4, 6.9, 7.8];

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.aurora, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />
      <div style={{ padding: '8px 20px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...tType('footnote'), color: T.fg2, marginBottom: 2 }}>
            {activeTeam?.name || 'Live performance'} · {deviceCount} wearable{deviceCount === 1 ? '' : 's'}
          </div>
          <div style={{ ...tType('largeTitle'), color: T.fg }}>Ultra</div>
        </div>
      </div>

      <div style={{ height: 'calc(100% - 44px - 12px - 72px - 100px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Live session hero */}
        <div style={{ padding: '8px 16px 20px' }}>
          <Glass r={28} tint="purple" intensity={1.1} style={{ height: 196 }}>
            <div style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ ...tType('caption1'), color: T.purple[200], letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  Live Session
                </div>
                <div style={{ ...tType('title2'), color: T.fg }}>
                  {deviceCount > 0 ? 'Tracking active' : 'No active session'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Rings size={88} stroke={9} rings={[
                  { value: 0.78, color: T.purple[400] },
                  { value: 0.64, color: T.magenta },
                  { value: 0.92, color: T.cyan },
                ]} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <div style={{ ...tType('caption1'), color: T.fg2 }}>Top speed</div>
                    <div style={{ ...tType('title3'), color: T.fg }}>
                      {recentSpeed != null ? recentSpeed.toFixed(1) : '—'}
                      <span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> m/s</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...tType('caption1'), color: T.fg2 }}>Distance</div>
                    <div style={{ ...tType('title3'), color: T.fg }}>
                      {recentDistance != null ? (recentDistance / 1000).toFixed(2) : '—'}
                      <span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> km</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Glass>
        </div>

        <SectionHeader title="Live Metrics" />
        <div style={{ padding: '4px 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Glass r={20}>
            <div style={{ padding: 14 }}>
              <div style={{ ...tType('footnote'), color: T.fg2 }}>Avg heart rate</div>
              <div style={{ ...tType('title1'), color: T.fg, marginTop: 4 }}>
                {recentHr ?? '—'}<span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> bpm</span>
              </div>
              <Sparkline data={[140,148,152,158,150,162,155]} width={140} height={28} color={T.magenta} fill={false} />
            </div>
          </Glass>
          <Glass r={20}>
            <div style={{ padding: 14 }}>
              <div style={{ ...tType('footnote'), color: T.fg2 }}>Sprint trend</div>
              <div style={{ ...tType('title1'), color: T.fg, marginTop: 4 }}>
                {recentSpeed != null ? recentSpeed.toFixed(1) : '—'}<span style={{ ...tType('subhead'), color: T.fg2, fontWeight: 500 }}> m/s</span>
              </div>
              <Sparkline data={sparkSpeed} width={140} height={28} color={T.cyan} fill={false} />
            </div>
          </Glass>
        </div>

        {/* CTA — open full Ultra analysis */}
        <div style={{ padding: '4px 16px 40px' }}>
          <Glass r={22} tint="purple" onClick={() => navigate('/analysis')}>
            <div style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `linear-gradient(135deg, ${T.purple[400]}, ${T.magenta})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" fill="rgba(255,255,255,0.2)"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...tType('headline'), color: T.fg }}>Open full Ultra analysis</div>
                <div style={{ ...tType('footnote'), color: T.fg2, marginTop: 2 }}>Heatmaps · biometrics · sprint detection</div>
              </div>
              <svg width="10" height="16" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.fg} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </Glass>
        </div>
      </div>

      <TabBar active={3} onChange={onTabChange} />
    </div>
  );
}
