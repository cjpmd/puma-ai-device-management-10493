import React from 'react';
import { T } from '@/lib/ios-tokens';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  showDots?: boolean;
}

export function Sparkline({ data, width = 140, height = 44, color, fill = true, showDots = false }: SparklineProps) {
  const c = color || T.purple[400];
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y] as [number, number];
  });
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${d} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${c.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {fill && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="0.45"/>
            <stop offset="1" stopColor={c} stopOpacity="0"/>
          </linearGradient>
        </defs>
      )}
      {fill && <path d={area} fill={`url(#${gradId})`}/>}
      <path d={d} fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      {showDots && pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3.5 : 0} fill={c} stroke={T.bg} strokeWidth="1.5"/>
      ))}
    </svg>
  );
}
