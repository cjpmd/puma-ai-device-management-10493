import { useMemo } from 'react';

interface HeatmapData {
  grid_w: number;
  grid_h: number;
  cells: [number, number, number][]; // [gx, gy, count]
}

interface HeatmapOverlayProps {
  data: HeatmapData | null;
  className?: string;
}

/**
 * Renders a player heatmap on a stylised pitch SVG.
 * Cell intensity is normalised against the max count in the heatmap.
 */
export function HeatmapOverlay({ data, className }: HeatmapOverlayProps) {
  const { gridW, gridH, max, cellMap } = useMemo(() => {
    if (!data || !data.cells?.length) {
      return { gridW: 20, gridH: 12, max: 1, cellMap: new Map<string, number>() };
    }
    const m = new Map<string, number>();
    let mx = 1;
    for (const [gx, gy, c] of data.cells) {
      m.set(`${gx},${gy}`, c);
      if (c > mx) mx = c;
    }
    return { gridW: data.grid_w, gridH: data.grid_h, max: mx, cellMap: m };
  }, [data]);

  const aspectClass = 'aspect-[16/9]';

  return (
    <div className={`relative w-full ${aspectClass} bg-emerald-700 rounded-md overflow-hidden ${className || ''}`}>
      {/* Pitch markings */}
      <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <rect x="2" y="2" width="96" height="52" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.3" />
        <line x1="50" y1="2" x2="50" y2="54" stroke="white" strokeOpacity="0.6" strokeWidth="0.3" />
        <circle cx="50" cy="28" r="6" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.3" />
        <rect x="2" y="18" width="10" height="20" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.3" />
        <rect x="88" y="18" width="10" height="20" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.3" />
      </svg>

      {/* Heatmap cells */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${gridW}, 1fr)`,
          gridTemplateRows: `repeat(${gridH}, 1fr)`,
        }}
      >
        {Array.from({ length: gridW * gridH }).map((_, i) => {
          const gx = i % gridW;
          const gy = Math.floor(i / gridW);
          const c = cellMap.get(`${gx},${gy}`) || 0;
          const intensity = c / max;
          if (intensity === 0) return <div key={i} />;
          return (
            <div
              key={i}
              style={{
                backgroundColor: `hsla(${20 + (1 - intensity) * 40}, 95%, 55%, ${0.15 + intensity * 0.65})`,
              }}
            />
          );
        })}
      </div>

      {!data && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
          No heatmap data
        </div>
      )}
    </div>
  );
}
