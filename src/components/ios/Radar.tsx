import React from 'react';
import { T } from '@/lib/ios-tokens';

interface RadarSeries {
  values: number[];
  color: string;
}

interface RadarProps {
  size?: number;
  axes: string[];
  series: RadarSeries[];
}

export function Radar({ size = 200, axes, series }: RadarProps) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 26;
  const n = axes.length;
  const pt = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v];
  };
  return (
    <svg width={size} height={size}>
      {[0.25, 0.5, 0.75, 1].map((s, i) => (
        <polygon key={i}
          points={axes.map((_, j) => pt(j, s).join(',')).join(' ')}
          fill={i === 3 ? 'rgba(255,255,255,0.03)' : 'none'}
          stroke="rgba(255,255,255,0.10)" strokeWidth="1"/>
      ))}
      {axes.map((_, j) => {
        const [x2, y2] = pt(j, 1);
        return <line key={j} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>;
      })}
      {series.map((s, si) => (
        <g key={si}>
          <polygon points={s.values.map((v, j) => pt(j, v).join(',')).join(' ')}
            fill={s.color} fillOpacity="0.22" stroke={s.color} strokeWidth="2" strokeLinejoin="round"/>
          {s.values.map((v, j) => {
            const [x, y] = pt(j, v);
            return <circle key={j} cx={x} cy={y} r="3" fill={s.color} stroke={T.bg} strokeWidth="1.5"/>;
          })}
        </g>
      ))}
      {axes.map((label, j) => {
        const [x, y] = pt(j, 1.18);
        return (
          <text key={j} x={x} y={y}
            textAnchor="middle" dominantBaseline="middle"
            fill={T.fg2} fontSize="11" fontWeight="500" fontFamily={T.font}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}
