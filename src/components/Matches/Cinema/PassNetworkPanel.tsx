import { useState, useMemo } from 'react';
import type { PassNetwork, PassNetworkNode, PassNetworkEdge } from '@/types/video-analysis';

interface PassNetworkPanelProps {
  homePassNetwork?: PassNetwork | null;
  awayPassNetwork?: PassNetwork | null;
}

// ── Pitch markings SVG component ──────────────────────────────────────────────

function PitchMarkings() {
  return (
    <g className="pitch-markings" stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.25">
      {/* Outer boundary */}
      <rect x="2" y="2" width="96" height="96" />
      {/* Centre line */}
      <line x1="50" y1="2" x2="50" y2="98" />
      {/* Centre circle (radius ~9 units ≈ 9.15m on 100-unit pitch) */}
      <circle cx="50" cy="50" r="9" />
      <circle cx="50" cy="50" r="0.8" fill="#ffffff" opacity="0.4" />
      {/* Left penalty area */}
      <rect x="2" y="21" width="17" height="58" />
      {/* Left goal area */}
      <rect x="2" y="36" width="6" height="28" />
      {/* Right penalty area */}
      <rect x="81" y="21" width="17" height="58" />
      {/* Right goal area */}
      <rect x="92" y="36" width="6" height="28" />
      {/* Left goal */}
      <rect x="0" y="42" width="2" height="16" stroke="#ffffff" strokeWidth="1.5" />
      {/* Right goal */}
      <rect x="98" y="42" width="2" height="16" stroke="#ffffff" strokeWidth="1.5" />
    </g>
  );
}

// ── Edge direction colour ─────────────────────────────────────────────────────

const DIRECTION_COLOUR: Record<string, string> = {
  forward:  '#22c55e',  // green
  sideways: '#3b82f6',  // blue
  back:     '#f97316',  // orange
};

// ── Pass direction legend bar ─────────────────────────────────────────────────

function PassDirectionBar({ edges }: { edges: PassNetworkEdge[] }) {
  const total = edges.length;
  if (total === 0) return null;

  const fwd  = edges.filter(e => e.direction === 'forward').length;
  const side = edges.filter(e => e.direction === 'sideways').length;
  const back = edges.filter(e => e.direction === 'back').length;

  const segments = [
    { label: 'Fwd',  count: fwd,  pct: fwd / total,  colour: DIRECTION_COLOUR.forward },
    { label: 'Side', count: side, pct: side / total, colour: DIRECTION_COLOUR.sideways },
    { label: 'Back', count: back, pct: back / total, colour: DIRECTION_COLOUR.back },
  ];

  return (
    <div className="mt-3">
      <p className="text-[10px] text-muted-foreground mb-1">Pass direction (by edge count)</p>
      <div className="flex h-3 rounded-full overflow-hidden w-full">
        {segments.map(s =>
          s.pct > 0 ? (
            <div
              key={s.label}
              style={{ width: `${s.pct * 100}%`, background: s.colour }}
              title={`${s.label}: ${Math.round(s.pct * 100)}%`}
            />
          ) : null
        )}
      </div>
      <div className="flex gap-3 mt-1">
        {segments.map(s => (
          <span key={s.label} className="text-[10px] flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.colour }} />
            {s.label} {Math.round(s.pct * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Single team network SVG ───────────────────────────────────────────────────

interface TeamNetworkProps {
  network: PassNetwork;
  highlighted: number | null;
  onNodeClick: (trackId: number) => void;
}

function TeamNetwork({ network, highlighted, onNodeClick }: TeamNetworkProps) {
  const { nodes, edges } = network;

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No pass network data
      </div>
    );
  }

  // Node size: proportional to pass count, clamped 2–6 units (viewBox 0–100)
  const maxPasses = Math.max(...nodes.map(n => n.pass_count), 1);
  const nodeRadius = (n: PassNetworkNode) =>
    2 + (n.pass_count / maxPasses) * 4;

  // Edge opacity: proportional to pass count
  const maxEdgeCount = Math.max(...edges.map(e => e.count), 1);
  const edgeOpacity = (e: PassNetworkEdge) =>
    0.3 + (e.count / maxEdgeCount) * 0.6;

  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      style={{ background: '#1a4731', borderRadius: '6px' }}
    >
      <PitchMarkings />

      {/* Edges */}
      {edges.map((e, i) => {
        const fromNode = nodes.find(n => n.track_id === e.from);
        const toNode   = nodes.find(n => n.track_id === e.to);
        if (!fromNode || !toNode) return null;

        const isHighlighted =
          highlighted === null ||
          e.from === highlighted ||
          e.to === highlighted;

        return (
          <line
            key={i}
            x1={fromNode.avg_x * 100}
            y1={fromNode.avg_y * 100}
            x2={toNode.avg_x * 100}
            y2={toNode.avg_y * 100}
            stroke={DIRECTION_COLOUR[e.direction] ?? '#94a3b8'}
            strokeWidth={Math.max(0.5, e.count / maxEdgeCount * 2.5)}
            opacity={isHighlighted ? edgeOpacity(e) : 0.08}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(n => {
        const r = nodeRadius(n);
        const isHighlighted = highlighted === null || highlighted === n.track_id;
        const isHovered = hovered === n.track_id;
        return (
          <g
            key={n.track_id}
            onClick={() => onNodeClick(n.track_id)}
            onMouseEnter={() => setHovered(n.track_id)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={n.avg_x * 100}
              cy={n.avg_y * 100}
              r={r + (isHovered ? 1.2 : 0)}
              fill={isHighlighted ? '#f8fafc' : '#64748b'}
              opacity={isHighlighted ? 1 : 0.3}
              stroke={isHovered ? '#fbbf24' : 'transparent'}
              strokeWidth="1"
            />
            {/* Jersey number label */}
            {n.jersey_number != null && (
              <text
                x={n.avg_x * 100}
                y={n.avg_y * 100 + 0.6}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={r < 3 ? '2.2' : '2.8'}
                fill={isHighlighted ? '#0f172a' : '#94a3b8'}
                fontWeight="700"
              >
                {n.jersey_number}
              </text>
            )}
            {/* Tooltip on hover */}
            {isHovered && (
              <title>
                {n.jersey_number != null ? `#${n.jersey_number} ` : ''}
                {n.player_name ?? `Player ${n.track_id}`}
                {'\n'}Passes: {n.pass_count}
              </title>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function PassNetworkPanel({ homePassNetwork, awayPassNetwork }: PassNetworkPanelProps) {
  const [team, setTeam] = useState<'home' | 'away'>('home');
  const [highlighted, setHighlighted] = useState<number | null>(null);

  const network = team === 'home' ? homePassNetwork : awayPassNetwork;

  const handleNodeClick = (trackId: number) => {
    setHighlighted(prev => (prev === trackId ? null : trackId));
  };

  const highlightedNode = useMemo(
    () => network?.nodes.find(n => n.track_id === highlighted) ?? null,
    [network, highlighted],
  );

  const highlightedEdges = useMemo(
    () =>
      highlighted == null
        ? []
        : (network?.edges ?? []).filter(
            e => e.from === highlighted || e.to === highlighted,
          ),
    [network, highlighted],
  );

  if (!homePassNetwork && !awayPassNetwork) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
        <span className="text-2xl">🕸</span>
        Pass network will appear after video analysis completes.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background p-4 gap-4 overflow-y-auto">
      {/* Team toggle */}
      <div className="flex gap-2">
        {(['home', 'away'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTeam(t); setHighlighted(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              team === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {t === 'home' ? 'Team A' : 'Team B'}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          Click a node to highlight connections
        </span>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Pitch SVG */}
        <div className="flex-1 min-h-0 aspect-[1.4] max-h-72">
          {network ? (
            <TeamNetwork
              network={network}
              highlighted={highlighted}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No data for this team
            </div>
          )}
        </div>

        {/* Side panel — highlighted player or legend */}
        <div className="w-44 shrink-0 flex flex-col gap-3">
          {highlighted != null && highlightedNode ? (
            <div className="bg-muted/40 rounded-xl p-3 text-sm">
              <p className="font-semibold text-foreground">
                {highlightedNode.jersey_number != null
                  ? `#${highlightedNode.jersey_number}`
                  : `Track ${highlighted}`}
                {highlightedNode.player_name && (
                  <span className="font-normal text-muted-foreground ml-1">
                    {highlightedNode.player_name}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                {highlightedNode.pass_count} passes made
              </p>
              {highlightedEdges.length > 0 && (
                <div className="mt-2 space-y-1">
                  {highlightedEdges.slice(0, 6).map((e, i) => {
                    const partner = e.from === highlighted ? e.to : e.from;
                    const partnerNode = network?.nodes.find(n => n.track_id === partner);
                    return (
                      <div key={i} className="flex items-center gap-1 text-xs">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: DIRECTION_COLOUR[e.direction] ?? '#94a3b8' }}
                        />
                        <span className="text-muted-foreground">
                          {partnerNode?.jersey_number != null
                            ? `#${partnerNode.jersey_number}`
                            : `T${partner}`}
                        </span>
                        <span className="ml-auto text-foreground">{e.count}×</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Legend</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />Forward pass
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />Sideways
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />Back pass
                </div>
              </div>
              <p className="mt-2">Node size = pass volume</p>
              <p>Edge width = frequency</p>
            </div>
          )}
        </div>
      </div>

      {/* Pass direction bar */}
      {network && <PassDirectionBar edges={network.edges} />}
    </div>
  );
}
