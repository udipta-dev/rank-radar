type Props = {
  values: number[];
  width?: number;
  height?: number;
  max?: number;
  color?: string;
};

/**
 * Tiny inline sparkline rendered as a single SVG path of bars.
 * Used for per-coin trending appearance frequency over last 30 days.
 */
export default function Sparkline({
  values,
  width = 180,
  height = 28,
  max,
  color = "var(--accent)",
}: Props) {
  const n = values.length;
  if (n === 0) return null;
  const m = max ?? Math.max(1, ...values);
  const barW = width / n;
  return (
    <svg width={width} height={height} className="block">
      {values.map((v, i) => {
        const h = m > 0 ? (v / m) * (height - 2) : 0;
        return (
          <rect
            key={i}
            x={i * barW + 0.5}
            y={height - h - 1}
            width={Math.max(1, barW - 1)}
            height={h}
            fill={v === 0 ? "var(--border)" : color}
            opacity={v === 0 ? 0.5 : 1}
          />
        );
      })}
    </svg>
  );
}
