import React from 'react';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  gradient?: boolean;
};

export function KpiSparkline({ data, width = 72, height = 28, color = '#22c55e', gradient = true }: Props) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;

  let path = '';
  let areaPath = '';
  if (data.length > 0) {
    const parts = data.map((v, i) => {
      const x = ((i) / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    path = `M${parts.join(' L')}`;
    areaPath = `${path} L${width},${height + 2} L0,${height + 2} Z`;
  }

  const gradId = `spark-${color.replace('#', '')}`;

  return (
    <svg
      className="hls-spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {gradient && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {gradient && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 2) - 1}
        r="2.5"
        fill={color}
        className="hls-spark__dot"
      />
    </svg>
  );
}
