import React from 'react';
import { T } from '@/lib/ios-tokens';

interface AvatarProps {
  initials?: string;
  size?: number;
  hue?: number;
  ring?: string;
}

export function Avatar({ initials = '––', size = 44, hue = 295, ring }: AvatarProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      position: 'relative', flexShrink: 0,
      background: `repeating-linear-gradient(135deg, oklch(0.55 0.18 ${hue}) 0 6px, oklch(0.42 0.18 ${hue}) 6px 12px)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: ring
        ? `0 0 0 2.5px ${ring}, 0 0 0 4px ${T.bg}`
        : 'inset 0 0 0 0.5px rgba(255,255,255,0.2)',
      fontFamily: T.font, fontSize: size * 0.36, fontWeight: 600, color: T.fg, letterSpacing: 0.5,
    }}>
      {initials}
    </div>
  );
}
