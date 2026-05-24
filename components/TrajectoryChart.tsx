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
  const allSymbols = series.map((s) => s.symbol);
  // Multi-coin charts start EMPTY so user builds up the comparison from a
  // clean slate. Single-coin charts (e.g. on /coin/[symbol]) stay visible.
  const [hidden, setHidden] = useState<Set<string>>(() =>
    allSymbols.length > 1 ? new Set(allSymbols) : new Set(),
  );
  const visibleCount = allSymbols.length - hidden.size;

  const toggle = (sym: string, e?: React.MouseEvent) => {
    // alt/option-click = solo (show only this one)
    if (e?.altKey) {
      const others = allSymbols.filter((s) => s !== sym);
      setHidden(new Set(others));
      return;
    }
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  };

  const hideAll = () => setHidden(new Set(allSymbols));
  const showAll = () => setHidden(new Set());

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
            stroke="#ffffff"
            fontSize={11}
            tickFormatter={(d) => d.slice(2, 7)}
            minTickGap={30}
          />
          <YAxis
            stroke="#ffffff"
            fontSize={11}
            reversed
            domain={[1, yMax]}
            label={{
              value: "CMC rank (up = better)",
              angle: -90,
              position: "insideLeft",
              fill: "#ffffff",
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
      {/* Bulk controls */}
      <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-[var(--border)] pt-3">
        <span className="text-xs text-[var(--fg-dim)] mr-2">
          {visibleCount === 0
            ? `Pick coins to compare ↓  (${allSymbols.length} available)`
            : `${visibleCount} of ${allSymbols.length} visible`}
        </span>
        <button
          onClick={showAll}
          disabled={hidden.size === 0}
          className="px-2 py-0.5 text-xs rounded border border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Show all
        </button>
        <button
          onClick={hideAll}
          disabled={hidden.size === allSymbols.length}
          className="px-2 py-0.5 text-xs rounded border border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <span className="text-xs text-[var(--fg-dim)] ml-2">
          tip: alt-click a coin to isolate it
        </span>
      </div>

      {/* Coin pills: click to toggle, alt-click to solo */}
      <div className="mt-2 flex flex-wrap gap-2">
        {series.map((s, i) => {
          const isHidden = hidden.has(s.symbol);
          return (
            <button
              key={s.symbol}
              onClick={(e) => toggle(s.symbol, e)}
              className={`px-2 py-0.5 text-xs rounded border flex items-center gap-1.5 transition-opacity ${
                isHidden ? "opacity-40 hover:opacity-70" : ""
              }`}
              style={{
                borderColor: COLORS[i % COLORS.length],
                color: COLORS[i % COLORS.length],
              }}
              title={isHidden ? "Click to show. Alt-click to isolate." : "Click to hide. Alt-click to isolate."}
            >
              <span
                className="inline-block w-3 h-0.5"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="font-mono">{s.symbol}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
