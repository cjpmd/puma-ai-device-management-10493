import React, { useState } from 'react';
import { T } from '@/lib/ios-tokens';

interface AvatarProps {
  initials?: string;
  size?: number;
  hue?: number;
  ring?: string;
  src?: string | null;
}

export function Avatar({ initials = '––', size = 44, hue = 295, ring, src }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImg = !!src && !errored;

  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      position: 'relative', flexShrink: 0, overflow: 'hidden',
      background: showImg
        ? '#1a1024'
        : `repeating-linear-gradient(135deg, oklch(0.55 0.18 ${hue}) 0 6px, oklch(0.42 0.18 ${hue}) 6px 12px)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: ring
        ? `0 0 0 2.5px ${ring}, 0 0 0 4px ${T.bg}`
        : 'inset 0 0 0 0.5px rgba(255,255,255,0.2)',
      fontFamily: T.font, fontSize: size * 0.36, fontWeight: 600, color: T.fg, letterSpacing: 0.5,
    }}>
      {showImg ? (
        <img
          src={src!}
          alt={initials}
          onError={() => setErrored(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : initials}
    </div>
  );
}
