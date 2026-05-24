"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClimberRow } from "@/lib/types";
import { fmtMcap, fmtDelta, fmtDate, fmtPct, fmtMultiple } from "@/lib/format";

type FormatType = "mcap" | "delta" | "date" | "pct" | "multiple" | "number" | "string";

export type Column = {
  key: keyof ClimberRow;
  label: string;
  numeric?: boolean;
  formatType?: FormatType;
};

const defaultColumns: Column[] = [
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "snapshots", label: "Weeks", numeric: true },
  { key: "start_rank", label: "Start rank", numeric: true },
  { key: "end_rank", label: "End rank", numeric: true },
  { key: "best_rank", label: "Best", numeric: true },
  { key: "worst_rank", label: "Worst", numeric: true },
  { key: "rank_delta", label: "Δ rank", numeric: true, formatType: "delta" },
  { key: "current_mcap_usd", label: "MCAP", numeric: true, formatType: "mcap" },
  { key: "current_fdv_usd", label: "FDV", numeric: true, formatType: "mcap" },
  { key: "current_mc_fdv", label: "Float %", numeric: true, formatType: "pct" },
];

function formatValue(v: unknown, type?: FormatType): string {
  if (v == null) return "—";
  switch (type) {
    case "mcap": return fmtMcap(v as number);
    case "delta": return fmtDelta(v as number);
    case "date": return fmtDate(v as string);
    case "pct": return fmtPct(v as number);
    case "multiple": return fmtMultiple(v as number);
    default: return String(v);
  }
}

export default function RankTable({
  rows,
  columns = defaultColumns,
  defaultSort = "rank_delta",
  defaultDir = "desc",
}: {
  rows: ClimberRow[];
  columns?: Column[];
  defaultSort?: keyof ClimberRow;
  defaultDir?: "asc" | "desc";
}) {
  const [sortKey, setSortKey] = useState<keyof ClimberRow>(defaultSort);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultDir);
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    const filtered = filter
      ? rows.filter(
          (r) =>
            r.symbol.toLowerCase().includes(filter.toLowerCase()) ||
            r.name.toLowerCase().includes(filter.toLowerCase()),
        )
      : rows;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [rows, sortKey, sortDir, filter]);

  function toggleSort(k: keyof ClimberRow) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Filter by symbol or name..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-3 px-3 py-2 bg-[var(--bg-elev)] border border-[var(--border)] rounded text-sm w-full max-w-xs focus:outline-none focus:border-[var(--accent)]"
      />
      <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-elev)] border-b border-[var(--border)]">
            <tr>
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  onClick={() => toggleSort(c.key)}
                  className={`px-3 py-2.5 cursor-pointer select-none whitespace-nowrap text-[var(--fg-dim)] hover:text-[var(--fg)] ${
                    c.numeric ? "text-right" : "text-left"
                  }`}
                >
                  {c.label}
                  {sortKey === c.key && (
                    <span className="ml-1 text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.symbol} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elev)]">
                {columns.map((c) => {
                  const v = r[c.key];
                  const display = formatValue(v, c.formatType);
                  const isSymbol = c.key === "symbol";
                  return (
                    <td
                      key={String(c.key)}
                      className={`px-3 py-2 ${c.numeric ? "text-right font-mono" : ""} ${
                        c.key === "rank_delta" && typeof v === "number"
                          ? v > 0
                            ? "text-[var(--accent)]"
                            : v < 0
                              ? "text-[var(--danger)]"
                              : ""
                          : ""
                      }`}
                    >
                      {isSymbol ? (
                        <Link
                          href={`/coin/${encodeURIComponent(r.symbol)}`}
                          className="font-semibold hover:text-[var(--accent)]"
                        >
                          {display}
                        </Link>
                      ) : (
                        display
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-[var(--fg-dim)]">
        {sorted.length} of {rows.length} rows. Click symbol to see trajectory.
      </div>
    </div>
  );
}
