import React, { useState } from 'react';
import { Glass, GlassIconBtn } from '@/components/ios/Glass';
import { TabBar } from '@/components/ios/TabBar';
import { Segmented } from '@/components/ios/Segmented';
import { IOSStatusBar } from '@/components/ios/StatusBar';
import { T, tType, Wallpapers } from '@/lib/ios-tokens';

// ── Types ──────────────────────────────────────────────────────────────────
type KitKind = 'solid' | 'stripes' | 'halves' | 'amber' | 'orange';
type Cap = 'C' | 'V' | null;

interface Player {
  id: string;
  name: string;
  pos: 'GK' | 'DEF' | 'MID' | 'FWD';
  sub: string;
  kit: KitKind;
  cap: Cap;
  rating: number;
  bench?: boolean;
}

const INIT_PLAYERS: Player[] = [
  { id: 'p1',  name: 'Alvarez',    pos: 'GK',  sub: '4, WRL (H)', kit: 'amber',   cap: null, rating: 4.5 },
  { id: 'p2',  name: 'Korhonen',   pos: 'DEF', sub: '6, HRT (A)', kit: 'stripes', cap: null, rating: 5.0 },
  { id: 'p3',  name: 'Aldridge',   pos: 'DEF', sub: '5, MED (H)', kit: 'solid',   cap: null, rating: 6.0 },
  { id: 'p4',  name: 'Senesi',     pos: 'DEF', sub: '2, AST (H)', kit: 'stripes', cap: null, rating: 4.5 },
  { id: 'p5',  name: 'Semenyo',    pos: 'MID', sub: '7, AST (H)', kit: 'solid',   cap: 'V',  rating: 7.0 },
  { id: 'p6',  name: 'Fernandes',  pos: 'MID', sub: '6, NWS',     kit: 'halves',  cap: null, rating: 6.5 },
  { id: 'p7',  name: 'Palmer',     pos: 'MID', sub: '3, BRH (A)', kit: 'solid',   cap: null, rating: 5.5 },
  { id: 'p8',  name: 'Tavernier',  pos: 'MID', sub: '7, LCE (H)', kit: 'stripes', cap: null, rating: 6.0 },
  { id: 'p9',  name: 'Haaland',    pos: 'FWD', sub: '5, AST (H)', kit: 'solid',   cap: 'C',  rating: 8.0 },
  { id: 'p10', name: 'Calvert-L.', pos: 'FWD', sub: '6, HRT (A)', kit: 'stripes', cap: null, rating: 6.5 },
  { id: 'p11', name: 'João Pedro', pos: 'FWD', sub: '0, BRH (A)', kit: 'solid',   cap: null, rating: 3.0 },
  { id: 'b1',  name: 'Verburg',    pos: 'GK',  sub: '2, CHS (H)', kit: 'orange',  cap: null, rating: 3.0, bench: true },
  { id: 'b2',  name: 'Hill',       pos: 'DEF', sub: '4, LCE (H)', kit: 'solid',   cap: null, rating: 4.5, bench: true },
  { id: 'b3',  name: 'Hinshaw',    pos: 'MID', sub: '2, CHS (H)', kit: 'stripes', cap: null, rating: 4.0, bench: true },
  { id: 'b4',  name: 'Van Hecke',  pos: 'DEF', sub: '6, CHS (H)', kit: 'stripes', cap: null, rating: 5.5, bench: true },
];

// ── Kit SVG ────────────────────────────────────────────────────────────────
const KIT_PALETTE: Record<KitKind, { body: string; trim: string }> = {
  solid:   { body: 'oklch(0.55 0.18 270)', trim: 'oklch(0.85 0.02 270)' },
  stripes: { body: 'oklch(0.90 0.02 270)', trim: 'oklch(0.28 0.14 300)' },
  halves:  { body: 'oklch(0.55 0.20 25)',  trim: 'oklch(0.90 0.02 270)' },
  amber:   { body: 'oklch(0.75 0.16 80)',  trim: 'oklch(0.30 0.10 80)' },
  orange:  { body: 'oklch(0.70 0.20 50)',  trim: 'oklch(0.28 0.10 50)' },
};

function Kit({ kind, compact }: { kind: KitKind; compact?: boolean }) {
  const w = compact ? 42 : 46;
  const c = KIT_PALETTE[kind] || KIT_PALETTE.solid;
  return (
    <svg width={w} height={w} viewBox="0 0 60 60">
      <defs>
        <linearGradient id={`kg-${kind}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={c.body} stopOpacity="1"/>
          <stop offset="100%" stopColor={c.body} stopOpacity="0.78"/>
        </linearGradient>
      </defs>
      <path d="M12 12 L22 8 Q30 14 38 8 L48 12 L52 22 L44 24 L44 50 Q44 52 42 52 L18 52 Q16 52 16 50 L16 24 L8 22 Z"
        fill={`url(#kg-${kind})`} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6"/>
      {kind === 'stripes' && (
        <g fill={c.trim}>
          <rect x="22" y="8" width="4" height="44"/>
          <rect x="30" y="8" width="4" height="44"/>
          <rect x="38" y="8" width="4" height="44"/>
        </g>
      )}
      {kind === 'halves' && (
        <path d="M30 10 L30 52 L42 52 Q44 52 44 50 L44 24 L52 22 L48 12 L38 8 Q34 10 30 10 Z" fill={c.trim}/>
      )}
      <path d="M26 10 Q30 14 34 10 L30 16 Z" fill="rgba(0,0,0,0.35)"/>
      <path d="M12 12 L22 8 Q30 14 38 8 L48 12 L52 22 L44 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
    </svg>
  );
}

// ── Rating colour ──────────────────────────────────────────────────────────
function ratingColor(r: number) {
  if (r >= 7)   return 'oklch(0.55 0.18 155)';
  if (r >= 5.5) return T.purple[500];
  if (r >= 4)   return T.magenta;
  return T.red;
}

// ── Player Chip (pitch) ────────────────────────────────────────────────────
function PlayerChip({
  p, compact, selected, highlight, onClick,
  onDragStart, onDragEnter, onDrop,
}: {
  p: Player; compact?: boolean; selected: boolean; highlight: boolean;
  onClick: () => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDrop: (id: string) => void;
}) {
  const w = compact ? 70 : 76;
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(p.id); }}
      onDragOver={e => e.preventDefault()}
      onDragEnter={() => onDragEnter(p.id)}
      onDrop={() => onDrop(p.id)}
      onClick={onClick}
      style={{
        width: w, display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: 'grab', userSelect: 'none',
        transform: selected ? 'translateY(-2px) scale(1.04)' : 'none',
        transition: 'transform 140ms, opacity 140ms',
      }}
    >
      <div style={{ position: 'relative' }}>
        <Kit kind={p.kit} compact={compact} />
        {p.cap && (
          <div style={{
            position: 'absolute', top: -4, left: -4, width: 18, height: 18, borderRadius: 9,
            background: p.cap === 'C' ? T.purple[500] : T.magenta,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...tType('caption2'), color: '#fff', fontWeight: 800,
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}>{p.cap}</div>
        )}
        <div style={{
          position: 'absolute', bottom: -4, right: -4, borderRadius: 9, padding: '1px 5px',
          background: ratingColor(p.rating),
          display: 'flex', alignItems: 'center', gap: 2,
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        }}>
          <svg width="7" height="7" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2l2.5 6 6.5.5-5 4.5 1.5 6.5L12 16l-5.5 3.5L8 13 3 8.5 9.5 8 12 2z"/>
          </svg>
          <span style={{ ...tType('caption2'), color: '#fff', fontWeight: 800, lineHeight: 1 }}>{p.rating}</span>
        </div>
        {highlight && (
          <div style={{
            position: 'absolute', inset: -6, borderRadius: 16,
            border: `2px dashed ${T.purple[200]}`, pointerEvents: 'none',
          }} />
        )}
      </div>
      <div style={{
        marginTop: 4, width: '100%',
        background: 'rgba(12,6,22,0.78)', backdropFilter: 'blur(8px)',
        border: '0.5px solid rgba(255,255,255,0.10)',
        borderRadius: 8, padding: '3px 2px', textAlign: 'center',
      }}>
        <div style={{ ...tType('caption1'), color: T.fg, fontWeight: 700, lineHeight: 1.1 }}>{p.name}</div>
        <div style={{ ...tType('caption2'), color: T.fg2, lineHeight: 1.2, marginTop: 1 }}>{p.sub}</div>
      </div>
    </div>
  );
}

// ── Pitch lines SVG ────────────────────────────────────────────────────────
function PitchLines() {
  return (
    <svg viewBox="0 0 378 480" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }}>
      <g fill="none" stroke="#fff" strokeWidth="1.2">
        <rect x="4" y="4" width="370" height="472" rx="4"/>
        <line x1="4" y1="240" x2="374" y2="240"/>
        <circle cx="189" cy="240" r="42"/>
        <circle cx="189" cy="240" r="2" fill="#fff"/>
        <rect x="70" y="4" width="238" height="62"/>
        <rect x="130" y="4" width="118" height="22"/>
        <path d="M130 66 a60 60 0 0 0 118 0"/>
        <rect x="70" y="414" width="238" height="62"/>
        <rect x="130" y="454" width="118" height="22"/>
        <path d="M130 414 a60 60 0 0 1 118 0"/>
      </g>
    </svg>
  );
}

// ── List row ───────────────────────────────────────────────────────────────
function ListRow({ p, last, over, onDragStart, onDragEnter, onDrop }: {
  p: Player; last: boolean; over: boolean;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDrop: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(p.id)}
      onDragOver={e => e.preventDefault()}
      onDragEnter={() => onDragEnter(p.id)}
      onDrop={() => onDrop(p.id)}
      style={{
        display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 12,
        cursor: 'grab', borderBottom: last ? 'none' : `0.5px solid ${T.hairline}`,
        background: over ? 'rgba(166,131,255,0.10)' : 'transparent',
      }}
    >
      <Kit kind={p.kit} compact />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ ...tType('callout'), color: T.fg, fontWeight: 600 }}>{p.name}</div>
          {p.cap && (
            <div style={{
              width: 16, height: 16, borderRadius: 8,
              background: p.cap === 'C' ? T.purple[500] : T.magenta,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...tType('caption2'), color: '#fff', fontWeight: 800,
            }}>{p.cap}</div>
          )}
        </div>
        <div style={{ ...tType('footnote'), color: T.fg2 }}>{p.pos} · {p.sub}</div>
      </div>
      <div style={{ padding: '2px 8px', borderRadius: 8, background: ratingColor(p.rating), ...tType('caption1'), color: '#fff', fontWeight: 700 }}>
        {p.rating}
      </div>
      {/* drag handle */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.45 }}>
        <circle cx="9"  cy="6"  r="1.5" fill={T.fg}/><circle cx="15" cy="6"  r="1.5" fill={T.fg}/>
        <circle cx="9"  cy="12" r="1.5" fill={T.fg}/><circle cx="15" cy="12" r="1.5" fill={T.fg}/>
        <circle cx="9"  cy="18" r="1.5" fill={T.fg}/><circle cx="15" cy="18" r="1.5" fill={T.fg}/>
      </svg>
    </div>
  );
}

// ── KPI helpers ────────────────────────────────────────────────────────────
function Kpi({ v, label }: { v: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: T.font, fontSize: 24, fontWeight: 700, color: T.fg, lineHeight: 1 }}>{v}</div>
      <div style={{ ...tType('caption1'), color: T.fg2, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function HeroKpi({ v, label, chipTxt }: { v: string; label: string; chipTxt: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <Glass r={16} tint="purple" intensity={1.1} style={{ padding: '8px 16px 4px', minWidth: 96 }}>
        <div style={{ fontFamily: T.font, fontSize: 32, fontWeight: 700, color: T.fg, lineHeight: 1 }}>{v}</div>
        <div style={{ ...tType('caption1'), color: T.purple[100], marginTop: 2 }}>{label}</div>
        <div style={{ marginTop: 6, marginInline: -6, padding: '3px 8px', borderRadius: 8, background: T.purple[500], ...tType('caption2'), color: '#fff', fontWeight: 700, letterSpacing: 0.4 }}>
          {chipTxt}
        </div>
      </Glass>
    </div>
  );
}

// ── Main formation screen ──────────────────────────────────────────────────
interface FormationScreenProps {
  onTabChange?: (tab: number) => void;
}

export function FormationScreen({ onTabChange }: FormationScreenProps) {
  const [view, setView] = useState<'pitch' | 'list'>('pitch');
  const [selected, setSelected] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>(INIT_PLAYERS);

  const onDragStart = (id: string) => setDragIdx(id);
  const onDragEnter = (id: string) => setOverIdx(id);
  const onDrop = (targetId: string) => {
    if (!dragIdx || dragIdx === targetId) { setDragIdx(null); setOverIdx(null); return; }
    setPlayers(prev => {
      const a = prev.find(p => p.id === dragIdx);
      const b = prev.find(p => p.id === targetId);
      if (!a || !b || a.pos !== b.pos) return prev;
      return prev.map(p => {
        if (p.id === a.id) return { ...b, id: a.id };
        if (p.id === b.id) return { ...a, id: b.id };
        return p;
      });
    });
    setDragIdx(null); setOverIdx(null);
  };

  const gk    = players.filter(p => !p.bench && p.pos === 'GK');
  const def   = players.filter(p => !p.bench && p.pos === 'DEF');
  const mid   = players.filter(p => !p.bench && p.pos === 'MID');
  const fwd   = players.filter(p => !p.bench && p.pos === 'FWD');
  const bench = players.filter(p => p.bench);

  const rows = [gk, def, mid, fwd];
  const chipProps = { selected: false, highlight: false, onDragStart, onDragEnter, onDrop };

  return (
    <div style={{ position: 'absolute', inset: 0, background: Wallpapers.aurora, overflow: 'hidden', fontFamily: T.font }}>
      <IOSStatusBar />
      <div style={{ height: 4 }} />

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', position: 'relative', zIndex: 10 }}>
        <GlassIconBtn>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
            <path d="M10 2L2 10l8 8" stroke={T.fg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </GlassIconBtn>
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...tType('caption1'), color: T.fg2, letterSpacing: 0.5 }}>TEAM SELECTION</div>
          <div style={{ ...tType('headline'), color: T.fg }}>Origin U15</div>
        </div>
        <GlassIconBtn>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M12 5v14" stroke={T.fg} strokeWidth="2.4" strokeLinecap="round"/>
          </svg>
        </GlassIconBtn>
      </div>

      {/* Matchday chip */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px 4px', position: 'relative', zIndex: 5 }}>
        <Glass r={14} style={{ padding: '6px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button style={{ width: 26, height: 26, borderRadius: 13, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="10" height="14" viewBox="0 0 12 20" fill="none"><path d="M10 2L2 10l8 8" stroke={T.fg2} strokeWidth="2.2" strokeLinecap="round"/></svg>
            </button>
            <div style={{ ...tType('subhead'), color: T.fg, fontWeight: 600, padding: '0 10px' }}>Matchday 14 · Sat</div>
            <button style={{ width: 26, height: 26, borderRadius: 13, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="10" height="14" viewBox="0 0 12 20" fill="none"><path d="M2 2l8 8-8 8" stroke={T.fg2} strokeWidth="2.2" strokeLinecap="round"/></svg>
            </button>
          </div>
        </Glass>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', padding: '10px 16px 8px', position: 'relative', zIndex: 5 }}>
        <Kpi v="15" label="Avg last 5" />
        <HeroKpi v="36" label="Projected pts" chipTxt="Formation 3-4-3" />
        <Kpi v="93" label="Season best" />
      </div>

      {/* Toggle */}
      <div style={{ padding: '0 64px 10px', position: 'relative', zIndex: 5 }}>
        <Segmented options={['Pitch', 'List']} active={view === 'pitch' ? 0 : 1} onChange={i => setView(i === 0 ? 'pitch' : 'list')} />
      </div>

      {/* Body */}
      <div style={{ position: 'absolute', top: 280, left: 0, right: 0, bottom: 86, overflow: 'hidden' }}>
        {view === 'pitch' ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Pitch */}
            <div style={{
              position: 'relative', flex: 1, margin: '0 12px', borderRadius: 22, overflow: 'hidden',
              background: `
                radial-gradient(120% 80% at 50% 0%, oklch(0.55 0.20 295 / 0.55), transparent 60%),
                repeating-linear-gradient(180deg, oklch(0.30 0.14 295) 0 28px, oklch(0.25 0.13 295) 28px 56px)
              `,
              boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.12), inset 0 20px 60px rgba(0,0,0,0.35)',
            }}>
              <PitchLines />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '14px 8px' }}>
                {rows.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 6 }}>
                    {row.map(p => (
                      <PlayerChip
                        key={p.id} p={p}
                        selected={selected === p.id}
                        highlight={overIdx === p.id}
                        onClick={() => setSelected(p.id === selected ? null : p.id)}
                        onDragStart={onDragStart} onDragEnter={onDragEnter} onDrop={onDrop}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Bench */}
            <div style={{ padding: '10px 12px 0' }}>
              <Glass r={18} intensity={0.9}>
                <div style={{ padding: '10px 10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px 8px' }}>
                    <div style={{ ...tType('caption1'), color: T.fg2, letterSpacing: 0.8 }}>BENCH · 4</div>
                    <div style={{ ...tType('caption1'), color: T.purple[200] }}>drag to swap</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', gap: 6 }}>
                    {bench.map(p => (
                      <PlayerChip
                        key={p.id} p={p} compact
                        selected={selected === p.id}
                        highlight={overIdx === p.id}
                        onClick={() => setSelected(p.id === selected ? null : p.id)}
                        onDragStart={onDragStart} onDragEnter={onDragEnter} onDrop={onDrop}
                      />
                    ))}
                  </div>
                </div>
              </Glass>
            </div>
          </div>
        ) : (
          // List view
          <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '0 16px 20px' }}>
            {(['GK','DEF','MID','FWD'] as const).map(pos => {
              const items = players.filter(p => p.pos === pos && !p.bench);
              const label = { GK: 'Goalkeeper', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' }[pos];
              return (
                <div key={pos} style={{ marginBottom: 12 }}>
                  <div style={{ ...tType('caption1'), color: T.fg2, letterSpacing: 0.6, padding: '6px 4px' }}>
                    {label.toUpperCase()} · {items.length}
                  </div>
                  <Glass r={18}>
                    {items.map((p, i) => (
                      <ListRow key={p.id} p={p} last={i === items.length - 1} over={overIdx === p.id}
                        onDragStart={onDragStart} onDragEnter={onDragEnter} onDrop={onDrop} />
                    ))}
                  </Glass>
                </div>
              );
            })}
            <div style={{ ...tType('caption1'), color: T.fg2, letterSpacing: 0.6, padding: '6px 4px' }}>BENCH · 4</div>
            <Glass r={18}>
              {bench.map((p, i) => (
                <ListRow key={p.id} p={p} last={i === bench.length - 1} over={overIdx === p.id}
                  onDragStart={onDragStart} onDragEnter={onDragEnter} onDrop={onDrop} />
              ))}
            </Glass>
          </div>
        )}
      </div>

      <TabBar active={1} onChange={onTabChange} />
    </div>
  );
}
