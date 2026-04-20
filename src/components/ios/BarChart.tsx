import React from 'react';
import { T, tType } from '@/lib/ios-tokens';

interface BarChartProps {
  data: number[];
  labels?: string[];
  color?: string;
  highlightLast?: boolean;
}

export function BarChart({ data, labels, color, highlightLast = true }: BarChartProps) {
  const max = Math.max(...data);
  const c = color || T.purple[300];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 96 }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '100%', height: `${(v / max) * 84}px`, borderRadius: 6,
              background: `linear-gradient(180deg, ${c}, ${T.purple[600]})`,
              opacity: (highlightLast && i === data.length - 1) ? 1 : 0.75,
            }}/>
          </div>
        ))}
      </div>
      {labels && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {labels.map((l, i) => (
            <div key={i} style={{ flex: 1, ...tType('caption2'), color: T.fg2, textAlign: 'center' }}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
