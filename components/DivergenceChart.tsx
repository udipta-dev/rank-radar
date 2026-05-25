"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

type Point = {
  symbol: string;
  name: string | null;
  rankDelta7d: number;
  trendingHits7d: number;
};

/**
 * Quadrant scatter: rank momentum on X, trending attention on Y.
 *   top-right = climbing + trending (real momentum)
 *   top-left = trending + falling rank (hype not converting)
 *   bottom-right = climbing + quiet (accumulator)
 *   bottom-left = dead
 */
export default function DivergenceChart({
  points,
  height = 480,
}: {
  points: Point[];
  height?: number;
}) {
  // color by quadrant for at-a-glance pattern
  const colored = points.map((p) => {
    let color = "#94a3b8"; // neutral
    if (p.rankDelta7d > 0 && p.trendingHits7d > 0) color = "#67e8a3"; // real momentum
    else if (p.rankDelta7d < 0 && p.trendingHits7d > 0) color = "#f7c668"; // hype not converting
    else if (p.rankDelta7d > 0 && p.trendingHits7d === 0) color = "#7eb8ff"; // quiet accumulator
    else if (p.rankDelta7d < 0 && p.trendingHits7d === 0) color = "#64748b"; // dead
    return { ...p, color };
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid stroke="#232a32" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="rankDelta7d"
            name="7d rank Δ"
            stroke="#ffffff"
            fontSize={11}
            label={{ value: "7d rank Δ (right = climbing)", position: "insideBottom", offset: -10, fill: "#ffffff", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="trendingHits7d"
            name="7d trending hits"
            stroke="#ffffff"
            fontSize={11}
            label={{ value: "7d trending hits (up = more attention)", angle: -90, position: "insideLeft", fill: "#ffffff", fontSize: 11 }}
          />
          <ZAxis type="category" dataKey="symbol" />
          <ReferenceLine x={0} stroke="#ffffff" strokeOpacity={0.3} />
          <ReferenceLine y={0} stroke="#ffffff" strokeOpacity={0.3} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "#ffffff", strokeOpacity: 0.3 }}
            contentStyle={{
              background: "#14181d",
              border: "1px solid #232a32",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [value, name]}
            labelFormatter={() => ""}
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="bg-black/90 border border-[var(--border)] rounded px-2 py-1.5 text-xs">
                  <div className="font-mono font-bold text-[var(--accent)]">{p.symbol}</div>
                  <div className="text-[var(--fg-dim)]">{p.name}</div>
                  <div className="font-mono mt-1">7d rank Δ: {p.rankDelta7d > 0 ? "+" : ""}{p.rankDelta7d}</div>
                  <div className="font-mono">trending hits: {p.trendingHits7d}</div>
                </div>
              );
            }}
          />
          <Scatter data={colored}>
            {colored.map((p, i) => (
              <Cell key={i} fill={p.color} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#67e8a3" }} /> climbing + trending (real momentum)</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#f7c668" }} /> trending + falling (hype not converting)</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#7eb8ff" }} /> climbing + quiet (accumulator)</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#64748b" }} /> dead zone</div>
      </div>
    </div>
  );
}
