import React from 'react';

/**
 * iOS status bar — kept as a no-op spacer so the safe-area inset is respected
 * on real devices, but no fake time/signal/battery icons are rendered (the
 * native OS draws those above our webview).
 */
export function IOSStatusBar() {
  return (
    <div
      style={{
        width: '100%',
        height: 'env(safe-area-inset-top, 0px)',
        minHeight: 0,
        position: 'relative',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    />
  );
}
