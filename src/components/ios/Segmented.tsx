import React from 'react';
import { Glass } from './Glass';
import { T, tType } from '@/lib/ios-tokens';

interface SegmentedProps {
  options: string[];
  active?: number;
  onChange?: (index: number) => void;
}

export function Segmented({ options, active = 0, onChange }: SegmentedProps) {
  return (
    <Glass r={12} style={{ padding: 3 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {options.map((o, i) => (
          <div key={i} onClick={() => onChange?.(i)} style={{
            flex: 1, textAlign: 'center', padding: '7px 12px', borderRadius: 10,
            ...tType('footnote'), fontWeight: 600,
            color: i === active ? T.fg : T.fg2,
            background: i === active ? 'rgba(255,255,255,0.14)' : 'transparent',
            cursor: 'pointer', transition: 'all .15s',
          }}>{o}</div>
        ))}
      </div>
    </Glass>
  );
}
