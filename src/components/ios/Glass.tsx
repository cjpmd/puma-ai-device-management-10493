import React from 'react';
import { T } from '@/lib/ios-tokens';

interface GlassProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  intensity?: number;
  r?: number;
  onClick?: () => void;
  tint?: 'neutral' | 'purple' | 'magenta';
  className?: string;
}

export function Glass({ children, style = {}, intensity = 1, r = T.r.xl, onClick, tint = 'neutral', className }: GlassProps) {
  const tintBg =
    tint === 'purple'  ? `oklch(0.45 0.18 295 / ${0.35 * intensity})` :
    tint === 'magenta' ? `oklch(0.55 0.20 340 / ${0.35 * intensity})` :
                         `rgba(255,255,255,${0.06 * intensity})`;
  return (
    <div onClick={onClick} className={className} style={{ position: 'relative', borderRadius: r, overflow: 'hidden', cursor: onClick ? 'pointer' : undefined, ...style }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: r,
        backdropFilter: `blur(${24 * intensity}px) saturate(180%)`,
        WebkitBackdropFilter: `blur(${24 * intensity}px) saturate(180%)`,
        background: tintBg,
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: r, pointerEvents: 'none',
        boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.12), inset -1px -1px 0 rgba(255,255,255,0.04)',
        border: '0.5px solid rgba(255,255,255,0.12)',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

export function GlassIconBtn({ children, size = 40 }: { children: React.ReactNode; size?: number }) {
  return (
    <Glass r={size / 2} style={{ width: size, height: size, flexShrink: 0 }}>
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.fg }}>
        {children}
      </div>
    </Glass>
  );
}
