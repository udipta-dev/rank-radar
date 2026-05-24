"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";
import type { ClimberRow } from "@/lib/types";

export default function RankHistogram({
  rows,
  binWidth = 10,
  height = 360,
}: {
  rows: ClimberRow[];
  binWidth?: number;
  height?: number;
}) {
  const { bins, totalCoins } = useMemo(() => {
    const deltas = rows.map((r) => r.rank_delta);
    if (deltas.length === 0) return { bins: [], totalCoins: 0 };
    const min = Math.floor(Math.min(...deltas) / binWidth) * binWidth;
    const max = Math.ceil(Math.max(...deltas) / binWidth) * binWidth;
    const buckets = new Map<number, { center: number; count: number; symbols: string[] }>();
    for (let b = min; b <= max; b += binWidth) {
      buckets.set(b, { center: b + binWidth / 2, count: 0, symbols: [] });
    }
    for (const r of rows) {
      const b = Math.floor(r.rank_delta / binWidth) * binWidth;
      const bucket = buckets.get(b);
      if (bucket) {
        bucket.count += 1;
        if (bucket.symbols.length < 10) bucket.symbols.push(r.symbol);
      }
    }
    return { bins: Array.from(buckets.values()), totalCoins: rows.length };
  }, [rows, binWidth]);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={bins} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#232a32" strokeDasharray="3 3" />
          <XAxis dataKey="center" stroke="#8a93a0" fontSize={11} />
          <YAxis stroke="#8a93a0" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: "#14181d",
              border: "1px solid #232a32",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e6e8eb" }}
            formatter={(v: number) => [`${v} coins`, "count"]}
            labelFormatter={(c: number) => {
              const b = bins.find((x) => x.center === c);
              const sample = b?.symbols.join(", ") ?? "";
              return `Δ rank ~${c > 0 ? "+" : ""}${c}${sample ? "  •  " + sample : ""}`;
            }}
          />
          <ReferenceLine x={0} stroke="#f97373" strokeDasharray="4 4" />
          <Bar dataKey="count">
            {bins.map((b, i) => (
              <Cell key={i} fill={b.center > 0 ? "#67e8a3" : b.center < 0 ? "#f97373" : "#8a93a0"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="text-xs text-[var(--fg-dim)] mt-2">
        {totalCoins} coins. Bin width: {binWidth} ranks. Hover bar to see sample symbols.
      </div>
    </div>
  );
}
