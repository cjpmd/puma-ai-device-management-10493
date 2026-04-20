import React from 'react';
import { T, tType } from '@/lib/ios-tokens';

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 20px', marginBottom: 10 }}>
      <div style={{ ...tType('title2'), color: T.fg }}>{title}</div>
      {action && (
        <div onClick={onAction} style={{ ...tType('subhead'), color: T.purple[300], fontWeight: 600, cursor: 'pointer' }}>
          {action}
        </div>
      )}
    </div>
  );
}
