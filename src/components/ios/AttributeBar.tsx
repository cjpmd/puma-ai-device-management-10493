import React from 'react';
import { T, tType } from '@/lib/ios-tokens';

interface AttributeBarProps {
  label: string;
  value: number | null | undefined;
  max?: number;
}

function colorFor(v: number): string {
  if (v <= 7) return T.red;
  if (v <= 11) return T.amber || '#F5A623';
  if (v <= 15) return T.fg;
  return T.purple[400];
}

export function AttributeBar({ label, value, max = 20 }: AttributeBarProps) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(1, value / max));
  const c = colorFor(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <div style={{ flex: 1, ...tType('subhead'), color: T.fg }}>{label}</div>
      <div style={{ width: 120, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: c, borderRadius: 3 }} />
      </div>
      <div style={{ ...tType('footnote'), color: T.fg, fontWeight: 600, width: 22, textAlign: 'right' }}>{value}</div>
    </div>
  );
}
