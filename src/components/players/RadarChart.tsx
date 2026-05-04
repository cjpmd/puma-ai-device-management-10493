import React from 'react';

interface RadarDatum {
  label: string;
  value: number;
  max: number;
}

interface RadarChartProps {
  data: RadarDatum[];
  size?: number;
  color?: string;
}

export function RadarChart({ data, size = 220, color = '#7c3aed' }: RadarChartProps) {
  if (!data.length) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.36;
  const lr = r + 24;
  const n  = data.length;

  const angle = (i: number) => (i * 2 * Math.PI) / n - Math.PI / 2;
  const pt    = (i: number, radius: number) => ({
    x: cx + radius * Math.cos(angle(i)),
    y: cy + radius * Math.sin(angle(i)),
  });

  const dataPath = data
    .map((d, i) => {
      const p = pt(i, (d.value / d.max) * r);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ') + 'Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings at 25 / 50 / 75 / 100% */}
      {[0.25, 0.5, 0.75, 1.0].map(lvl => (
        <polygon
          key={lvl}
          points={data.map((_, i) => { const p = pt(i, r * lvl); return `${p.x},${p.y}`; }).join(' ')}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
        />
      ))}
      {/* Spokes */}
      {data.map((_, i) => {
        const p = pt(i, r);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      {/* Data polygon */}
      <path d={dataPath} fill={color + '28'} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {/* Labels */}
      {data.map((d, i) => {
        const p = pt(i, lr);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fill="#64748b"
            fontFamily="system-ui,sans-serif"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
