"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CurrentMetrics, Momentum } from "@/lib/types";
import { fmtMcap, fmtPct, fmtDelta } from "@/lib/format";

type Row = {
  symbol: string;
  name: string;
  rank: number;
  mcap: number | null;
  fdv: number | null;
  mcFdv: number | null;
  isCapped: boolean;
  d1: number | null;
  d7: number | null;
  d30: number | null;
};

type SortKey = "rank" | "mcap" | "fdv" | "mcFdv" | "d1" | "d7" | "d30";

function deltaCell(v: number | null) {
  if (v == null) return <span className="text-[var(--fg-dim)]">—</span>;
  const cls = v > 0 ? "text-[var(--accent)]" : v < 0 ? "text-[var(--danger)]" : "text-[var(--fg-dim)]";
  return <span className={`font-mono ${cls}`}>{fmtDelta(v)}</span>;
}

function floatCell(v: number | null, capped: boolean) {
  if (v == null || !capped) return <span className="text-[var(--fg-dim)]">—</span>;
  const cls = v < 0.3 ? "text-[var(--danger)]" : v < 0.6 ? "text-[var(--warn)]" : "text-[var(--accent)]";
  return <span className={`font-mono ${cls}`}>{fmtPct(v)}</span>;
}

export default function MarketTable({
  nameMap,
  currentMetrics,
  momentum,
  limit = 200,
}: {
  nameMap: Record<string, string>;
  currentMetrics: Record<string, CurrentMetrics>;
  momentum: Record<string, Momentum>;
  limit?: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");

  const rows: Row[] = useMemo(() => {
    return Object.entries(momentum)
      .map(([symbol, m]) => {
        const cm = currentMetrics[symbol];
        return {
          symbol,
          name: nameMap[symbol] ?? symbol,
          rank: m.currentRank,
          mcap: cm?.mcap ?? null,
          fdv: cm?.fdv ?? null,
          mcFdv: cm?.mcFdv ?? null,
          isCapped: cm?.isCapped ?? false,
          d1: m.d1,
          d7: m.d7,
          d30: m.d30,
        };
      })
      .filter((r) => r.rank != null);
  }, [nameMap, currentMetrics, momentum]);

  const sortedFiltered = useMemo(() => {
    const filtered = filter
      ? rows.filter(
          (r) =>
            r.symbol.toLowerCase().includes(filter.toLowerCase()) ||
            r.name.toLowerCase().includes(filter.toLowerCase()),
        )
      : rows;
    return [...filtered]
      .sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (va == null) return 1;
        if (vb == null) return -1;
        return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
      })
      .slice(0, filter ? rows.length : limit);
  }, [rows, sortKey, sortDir, filter, limit]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      // sensible default direction per column
      setSortDir(k === "rank" ? "asc" : "desc");
    }
  }

  const cols: { k: SortKey | "symbol" | "name"; label: string; numeric?: boolean; tooltip?: string }[] = [
    { k: "rank", label: "#", numeric: true },
    { k: "symbol", label: "Symbol" },
    { k: "name", label: "Name" },
    { k: "mcap", label: "MCAP", numeric: true },
    { k: "fdv", label: "FDV", numeric: true },
    { k: "mcFdv", label: "Float %", numeric: true, tooltip: "MCAP / FDV. Low = unlocks ahead." },
    { k: "d1", label: "1d Δ", numeric: true, tooltip: "Rank change vs ~1 day ago" },
    { k: "d7", label: "7d Δ", numeric: true, tooltip: "Rank change vs ~7 days ago" },
    { k: "d30", label: "30d Δ", numeric: true, tooltip: "Rank change vs ~30 days ago" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Filter top 200 by symbol or name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-elev)] border border-[var(--border)] rounded text-sm w-full max-w-xs focus:outline-none focus:border-[var(--accent)]"
        />
        <div className="text-xs text-[var(--fg-dim)]">
          Showing {sortedFiltered.length} of {rows.length} coins. Δ positive = rank improved.
        </div>
      </div>
      <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-elev)] border-b border-[var(--border)]">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.k}
                  title={c.tooltip}
                  onClick={() =>
                    c.k !== "symbol" && c.k !== "name" ? toggleSort(c.k as SortKey) : undefined
                  }
                  className={`px-3 py-2 select-none whitespace-nowrap text-[var(--fg-dim)] ${
                    c.numeric ? "text-right" : "text-left"
                  } ${c.k !== "symbol" && c.k !== "name" ? "cursor-pointer hover:text-[var(--fg)]" : ""}`}
                >
                  {c.label}
                  {sortKey === c.k && (
                    <span className="ml-1 text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map((r) => (
              <tr key={r.symbol} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elev)]">
                <td className="px-3 py-1.5 text-right font-mono text-[var(--fg-dim)]">{r.rank}</td>
                <td className="px-3 py-1.5">
                  <Link
                    href={`/coin/${encodeURIComponent(r.symbol)}`}
                    className="font-mono font-semibold hover:text-[var(--accent)]"
                  >
                    {r.symbol}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-[var(--fg-dim)] truncate max-w-xs">{r.name}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmtMcap(r.mcap)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmtMcap(r.fdv)}</td>
                <td className="px-3 py-1.5 text-right">{floatCell(r.mcFdv, r.isCapped)}</td>
                <td className="px-3 py-1.5 text-right">{deltaCell(r.d1)}</td>
                <td className="px-3 py-1.5 text-right">{deltaCell(r.d7)}</td>
                <td className="px-3 py-1.5 text-right">{deltaCell(r.d30)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
