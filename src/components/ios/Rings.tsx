import React from 'react';

interface Ring {
  value: number;
  color: string;
}

interface RingsProps {
  size?: number;
  stroke?: number;
  rings: Ring[];
}

export function Rings({ size = 130, stroke = 12, rings }: RingsProps) {
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size}>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + 3);
        const c = 2 * Math.PI * radius;
        return (
          <g key={i} transform={`rotate(-90 ${cx} ${cy})`}>
            <circle cx={cx} cy={cy} r={radius} stroke={r.color} strokeOpacity="0.18" strokeWidth={stroke} fill="none"/>
            <circle cx={cx} cy={cy} r={radius} stroke={r.color} strokeWidth={stroke} fill="none"
              strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(r.value, 1))} strokeLinecap="round"/>
          </g>
        );
      })}
    </svg>
  );
}
