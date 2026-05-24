"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export default function CoverageChart({
  rows,
  height = 320,
}: {
  rows: { date: string; coins: number; totalMcap: number }[];
  height?: number;
}) {
  const data = rows.map((r) => ({
    date: r.date,
    coins: r.coins,
    mcapTrillion: +(r.totalMcap / 1e12).toFixed(3),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232a32" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          stroke="#8a93a0"
          fontSize={11}
          tickFormatter={(d) => d.slice(2, 7)}
          minTickGap={30}
        />
        <YAxis yAxisId="left" stroke="#67e8a3" fontSize={11} domain={["dataMin - 5", "dataMax + 5"]} />
        <YAxis yAxisId="right" orientation="right" stroke="#c084fc" fontSize={11} />
        <Tooltip
          contentStyle={{
            background: "#14181d",
            border: "1px solid #232a32",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#e6e8eb" }}
          formatter={(v: number, name: string) =>
            name === "mcapTrillion" ? [`$${v.toFixed(2)}T`, "Top-200 MCAP"] : [v, "Coins/snapshot"]
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          yAxisId="left"
          dataKey="coins"
          name="Coins per snapshot"
          stroke="#67e8a3"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="right"
          dataKey="mcapTrillion"
          name="Top-200 mcap ($T)"
          stroke="#c084fc"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
