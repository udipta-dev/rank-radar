"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
  Legend,
} from "recharts";
import type { TrajectoryPoint } from "@/lib/types";

const COLORS = [
  "#67e8a3", "#f7c668", "#7eb8ff", "#f97373", "#c084fc",
  "#67d3e8", "#fb923c", "#a3e635", "#f472b6", "#94a3b8",
  "#fcd34d", "#22d3ee", "#fb7185", "#a78bfa", "#34d399",
  "#fbbf24", "#60a5fa", "#f87171", "#e879f9", "#4ade80",
];

export default function TrajectoryChart({
  series,
  bearWindow,
  height = 460,
}: {
  series: { symbol: string; data: TrajectoryPoint[] }[];
  bearWindow?: { peak: string; trough: string };
  height?: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggle = (sym: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  };

  const { rows, yMax } = useMemo(() => {
    const dateSet = new Set<string>();
    for (const s of series) for (const p of s.data) dateSet.add(p.date);
    const dates = Array.from(dateSet).sort();
    const rows = dates.map((d) => {
      const row: Record<string, string | number | null> = { date: d };
      for (const s of series) {
        const pt = s.data.find((p) => p.date === d);
        row[s.symbol] = pt ? pt.rank : null;
      }
      return row;
    });
    const allRanks = series.flatMap((s) => s.data.map((p) => p.rank));
    const yMax = Math.min(220, Math.max(...allRanks) + 10);
    return { rows, yMax };
  }, [series]);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#232a32" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            stroke="#8a93a0"
            fontSize={11}
            tickFormatter={(d) => d.slice(2, 7)}
            minTickGap={30}
          />
          <YAxis
            stroke="#8a93a0"
            fontSize={11}
            reversed
            domain={[1, yMax]}
            label={{
              value: "CMC rank (up = better)",
              angle: -90,
              position: "insideLeft",
              fill: "#8a93a0",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#14181d",
              border: "1px solid #232a32",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e6e8eb" }}
            itemSorter={(a) => -(a.value as number)}
          />
          {bearWindow && (
            <ReferenceArea
              x1={bearWindow.peak.slice(0, 10)}
              x2={bearWindow.trough.slice(0, 10)}
              stroke="none"
              fill="#f97373"
              fillOpacity={0.08}
              label={{ value: "bear window", fill: "#f97373", fontSize: 10, position: "insideTop" }}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s.symbol}
              type="monotone"
              dataKey={s.symbol}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.8}
              dot={false}
              connectNulls
              isAnimationActive={false}
              hide={hidden.has(s.symbol)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* Custom legend: click to toggle lines */}
      <div className="mt-3 flex flex-wrap gap-2">
        {series.map((s, i) => {
          const isHidden = hidden.has(s.symbol);
          return (
            <button
              key={s.symbol}
              onClick={() => toggle(s.symbol)}
              className={`px-2 py-0.5 text-xs rounded border flex items-center gap-1.5 transition-opacity ${
                isHidden ? "opacity-40" : ""
              }`}
              style={{
                borderColor: COLORS[i % COLORS.length],
                color: COLORS[i % COLORS.length],
              }}
              title={isHidden ? "Click to show" : "Click to hide"}
            >
              <span
                className="inline-block w-3 h-0.5"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="font-mono">{s.symbol}</span>
            </button>
          );
        })}
        {hidden.size > 0 && (
          <button
            onClick={() => setHidden(new Set())}
            className="px-2 py-0.5 text-xs rounded border border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
